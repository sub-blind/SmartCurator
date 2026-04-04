import asyncio
import logging
import math
import re
from urllib.parse import urlparse

from app.core.celery_app import celery_app
from app.core.database_sync import SessionLocal
from app.models.content import Content
from app.services.ai_service import AIService
from app.services.scraper_service import ScraperService
from app.services.vector_service import vector_service
from app.utils.text_chunking import split_into_chunks

logger = logging.getLogger(__name__)
MAX_SUMMARY_CHUNKS = 8
MIN_SCRAPED_CONTENT_CHARS = 120
AUTO_TITLE_MARKERS = {"", "제목 없음", "자동 생성 제목", "웹페이지"}
SCRAPE_FAILURE_MARKERS = (
    "내용을 추출할 수 없습니다",
    "unable to extract content",
    "content could not be extracted",
)
DIRECT_SUMMARY_CHAR_LIMIT = 2200
DIRECT_SUMMARY_MAX_CHUNKS = 2


def _merge_chunks_for_summary(chunks: list[str], max_chunks: int = MAX_SUMMARY_CHUNKS) -> list[str]:
    """요약 API 호출 수를 줄이기 위해 과도한 chunk를 묶는다."""
    if len(chunks) <= max_chunks:
        return chunks

    group_size = math.ceil(len(chunks) / max_chunks)
    merged: list[str] = []
    for start in range(0, len(chunks), group_size):
        part = "\n\n".join(chunks[start : start + group_size]).strip()
        if part:
            merged.append(part)
    return merged


def _is_valid_scraped_content(text: str) -> bool:
    """크롤링 결과가 실제 본문으로 볼 수 있는지 최소 검증."""
    normalized = " ".join((text or "").split()).strip()
    if not normalized:
        return False
    lowered = normalized.lower()
    if any(marker in lowered for marker in SCRAPE_FAILURE_MARKERS):
        return False
    if len(normalized) < MIN_SCRAPED_CONTENT_CHARS:
        return False
    return True


def _needs_auto_title(title: str | None) -> bool:
    normalized = (title or "").strip()
    if normalized in AUTO_TITLE_MARKERS:
        return True
    return normalized.startswith("웹페이지 - ") or normalized.startswith("유튜브 링크 - ")


def _clean_generated_title(title: str, fallback: str) -> str:
    normalized = " ".join((title or "").split()).strip().strip('"\'')
    if len(normalized) >= 4:
        return normalized[:60].strip()
    fallback_normalized = " ".join((fallback or "").split()).strip()
    if fallback_normalized:
        return fallback_normalized[:60].strip()
    return "요약 콘텐츠"


def _is_usable_scraped_title(title: str | None) -> bool:
    normalized = " ".join((title or "").split()).strip()
    if len(normalized) < 8:
        return False
    lowered = normalized.lower()
    generic_markers = (
        "youtube",
        "youtu.be",
        "naver",
        "news",
        "기사",
        "웹페이지",
    )
    if normalized in AUTO_TITLE_MARKERS:
        return False
    return not any(marker in lowered and len(normalized) <= 18 for marker in generic_markers)


def _generate_title_with_ai(ai_service: AIService, raw_content: str, url: str, fallback: str) -> str:
    prompt = f"""
다음 본문을 바탕으로 한국어 제목 1개를 만들어 주세요.
조건:
- 18~36자 권장
- 핵심 주제가 바로 드러나게 작성
- 자극적인 표현 금지

URL: {url}
본문:
{(raw_content or '')[:2200]}

아래 JSON만 반환:
{{
  "title": "생성된 제목"
}}
"""
    try:
        response = asyncio.run(
            ai_service._chat_json(  # noqa: SLF001 - 내부 유틸 재사용
                system_message=(
                    "당신은 뉴스/문서 제목을 간결하게 정리하는 편집자다. "
                    "본문 핵심을 한 줄 제목으로 만든다."
                ),
                user_message=prompt,
                max_tokens=140,
                temperature=0.2,
            )
        )
        return _clean_generated_title(str(response.get("title", "")), fallback)
    except Exception:
        return _clean_generated_title("", fallback)


def _is_youtube_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        host = (urlparse(url).netloc or "").lower()
        return "youtube.com" in host or "youtu.be" in host
    except Exception:
        return False


def _sentence_count(text: str) -> int:
    parts = [p.strip() for p in re.split(r"[.!?]\s+|[.!?]$", (text or "").strip()) if p.strip()]
    return len(parts)


def _should_use_direct_summary(raw_content: str, chunks: list[str]) -> bool:
    if not raw_content:
        return False
    return len(raw_content) <= DIRECT_SUMMARY_CHAR_LIMIT and len(chunks) <= DIRECT_SUMMARY_MAX_CHUNKS


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_content_task(self, content_id: int):
    """콘텐츠 처리 태스크."""
    try:
        logger.info("🚀 Celery 태스크 시작: content_id=%s", content_id)
        result = _process_content_sync(content_id)
        logger.info("✅ Celery 태스크 완료: content_id=%s", content_id)
        return result
    except Exception as exc:
        logger.error("❌ 태스크 실패: content_id=%s, error=%s", content_id, exc)

        if self.request.retries < self.max_retries:
            countdown = self.default_retry_delay * (2 ** self.request.retries)
            logger.info("🔁 재시도: content_id=%s, retry=%s", content_id, self.request.retries + 1)
            raise self.retry(exc=exc, countdown=countdown)

        logger.error("🛑 최대 재시도 초과: content_id=%s", content_id)
        try:
            session = SessionLocal()
            content = session.get(Content, content_id)
            if content:
                content.status = "failed"
                content.processing_error = str(exc)[:1000]
                session.commit()
        except Exception as e:  # pragma: no cover
            logger.warning("실패 상태 업데이트 실패: %s", e)
        finally:
            try:
                session.close()
            except Exception:
                pass
        raise


def _process_content_sync(content_id: int):
    """Celery 워커에서 실행되는 동기 처리 파이프라인."""
    session = SessionLocal()
    scraper = ScraperService()
    ai_service = AIService()

    try:
        logger.info("🔄 콘텐츠 처리 시작: content_id=%s", content_id)

        content = session.get(Content, content_id)
        if not content:
            logger.error("콘텐츠를 찾을 수 없음: content_id=%s", content_id)
            return {"content_id": content_id, "status": "not_found"}

        content.status = "processing"
        content.processing_error = None
        session.commit()

        if content.content_type == "url" and content.url:
            logger.info("🕷️ 크롤링 시작: %s", content.url)
            scraped = asyncio.run(scraper.extract_content(content.url))
            if scraped.get("success"):
                scraped_content = (scraped.get("content") or "").strip()
                if not _is_valid_scraped_content(scraped_content):
                    error_msg = "URL 본문 추출 실패: 접근 제한 또는 본문이 충분하지 않습니다."
                    logger.error("❌ 크롤링 실패: %s", error_msg)
                    content.status = "failed"
                    content.processing_error = error_msg
                    session.commit()
                    return {"content_id": content_id, "status": "failed", "error": error_msg}

                content.raw_content = scraped_content
                scraped_title = (scraped.get("title") or "").strip()
                scraped_thumbnail_url = (scraped.get("thumbnail_url") or "").strip()
                if scraped_thumbnail_url:
                    content.thumbnail_url = scraped_thumbnail_url
                if _needs_auto_title(content.title):
                    content.title = (
                        scraped_title
                        if _is_usable_scraped_title(scraped_title)
                        else _generate_title_with_ai(
                            ai_service=ai_service,
                            raw_content=scraped_content,
                            url=content.url or "",
                            fallback=scraped_title,
                        )
                    )
                logger.info("✅ 크롤링 완료: %s chars", len(content.raw_content or ""))
            else:
                error_msg = scraped.get("error", "스크래핑 실패")
                logger.error("❌ 크롤링 실패: %s", error_msg)
                content.status = "failed"
                content.processing_error = error_msg
                session.commit()
                return {"content_id": content_id, "status": "failed", "error": error_msg}

        if content.raw_content:
            logger.info("🤖 AI 요약 시작: content_id=%s", content_id)
            chunks = split_into_chunks(content.raw_content, chunk_size=1100, overlap=180)
            chunks = _merge_chunks_for_summary(chunks or [content.raw_content])
            use_direct_summary = _should_use_direct_summary(content.raw_content, chunks)

            if use_direct_summary:
                ai_res = asyncio.run(
                    ai_service.summarize_content(
                        content.raw_content,
                        content.title or "",
                        content.url or "",
                    )
                )
            else:
                chunk_summaries = []

                for chunk in chunks:
                    chunk_res = asyncio.run(
                        ai_service.summarize_chunk(
                            chunk,
                            content.title or "",
                            content.url or "",
                        )
                    )
                    if not chunk_res.get("success"):
                        error_msg = chunk_res.get("error", "chunk 요약 실패")
                        logger.error("❌ chunk 요약 실패: %s", error_msg)
                        content.status = "failed"
                        content.processing_error = error_msg
                        session.commit()
                        return {"content_id": content_id, "status": "failed", "error": error_msg}
                    chunk_summaries.append(chunk_res.get("summary", ""))

                ai_res = asyncio.run(
                    ai_service.synthesize_chunk_summaries(
                        title=content.title or "",
                        url=content.url or "",
                        chunk_summaries=chunk_summaries,
                    )
                )

            if ai_res.get("success"):
                content.summary = ai_res.get("summary")
                content.tags = ai_res.get("tags", [])

                if _is_youtube_url(content.url):
                    summary_text = content.summary or ""
                    is_too_short = len(summary_text) < 320 or _sentence_count(summary_text) < 5
                    if is_too_short:
                        expanded_res = asyncio.run(
                            ai_service.expand_youtube_summary(
                                content=content.raw_content or "",
                                current_summary=summary_text,
                                title=content.title or "",
                                url=content.url or "",
                            )
                        )
                        if expanded_res.get("success"):
                            content.summary = expanded_res.get("summary", content.summary)
                            content.tags = expanded_res.get("tags", content.tags or [])

                content.status = "completed"
                content.processing_error = None
                logger.info(
                    "✅ AI 요약 완료: %s chars, %s tags",
                    len(content.summary or ""),
                    len(content.tags or []),
                )
            else:
                error_msg = ai_res.get("error", "AI 요약 실패")
                logger.error("❌ AI 요약 실패: %s", error_msg)
                content.status = "failed"
                content.processing_error = error_msg
                session.commit()
                return {"content_id": content_id, "status": "failed", "error": error_msg}

        session.commit()

        if content.status == "completed" and content.summary:
            logger.info("🧠 벡터 저장 시작: content_id=%s", content_id)
            asyncio.run(
                vector_service.store_content_chunks(
                    content_id=content.id,
                    title=content.title,
                    summary=content.summary,
                    tags=content.tags or [],
                    user_id=content.user_id,
                    is_public=content.is_public,
                    raw_content=content.raw_content or "",
                )
            )
            logger.info("✅ 벡터 저장 완료")

        return {
            "content_id": content_id,
            "status": content.status,
            "title": content.title,
            "summary_length": len(content.summary or "") if content.summary else 0,
        }

    except Exception as e:
        logger.error("❌ 처리 실패: content_id=%s, error=%s", content_id, e, exc_info=True)
        try:
            content = session.get(Content, content_id)
            if content:
                content.status = "failed"
                content.processing_error = str(e)[:1000]
                session.commit()
        except Exception:
            logger.warning("실패 상태 업데이트 중 예외 발생", exc_info=True)
        raise
    finally:
        session.close()


@celery_app.task
def health_check():
    """헬스체크."""
    import datetime

    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
    }

