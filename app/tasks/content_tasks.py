import asyncio
import logging

from app.core.celery_app import celery_app
from app.core.database_sync import SessionLocal
from app.models.content import Content
from app.services.scraper_service import ScraperService
from app.services.ai_service import AIService
from app.services.vector_service import vector_service
from app.utils.text_chunking import split_into_chunks


logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_content_task(self, content_id: int):
    """컨텐츠 처리 태스크 (동기 + 별도 DB 세션 사용)"""
    try:
        logger.info(f"🚀 Celery 태스크 시작: content_id={content_id}")
        
        result = _process_content_sync(content_id)
        
        logger.info(f"✅ Celery 태스크 완료: content_id={content_id}")
        return result
        
    except Exception as exc:
        logger.error(f"❌ 태스크 실패: content_id={content_id}, error={exc}")
        
        if self.request.retries < self.max_retries:
            countdown = self.default_retry_delay * (2 ** self.request.retries)
            logger.info(f"🔄 재시도: content_id={content_id}, retry={self.request.retries+1}")
            raise self.retry(exc=exc, countdown=countdown)
        else:
            logger.error(f"💀 재시도 포기: content_id={content_id}")
            # 실패 상태 저장
            try:
                session = SessionLocal()
                content = session.get(Content, content_id)
                if content:
                    content.status = "failed"
                    session.commit()
            except Exception as e:
                logger.warning(f"실패 상태 업데이트 실패: {e}")
            finally:
                try:
                    session.close()
                except Exception:
                    pass
            raise


def _process_content_sync(content_id: int):
    """
    Celery 워커에서 실행되는 동기 처리 파이프라인.
    - 동기 DB 세션(SessionLocal) 사용
    - 크롤링/AI 요약/벡터 저장은 async 함수이므로 asyncio.run 으로 감쌈
    """
    session = SessionLocal()
    scraper = ScraperService()
    ai_service = AIService()

    try:
        logger.info(f"🔄 컨텐츠 처리 시작: content_id={content_id}")

        content = session.get(Content, content_id)
        if not content:
            logger.error(f"컨텐츠를 찾을 수 없음: content_id={content_id}")
            return {"content_id": content_id, "status": "not_found"}

        # 상태: processing
        content.status = "processing"
        session.commit()

        # 1) URL 크롤링
        if content.content_type == "url" and content.url:
            logger.info(f"🌐 크롤링 시작: {content.url}")
            scraped = asyncio.run(scraper.extract_content(content.url))
            if scraped.get("success"):
                content.raw_content = scraped.get("content")
                if not content.title or content.title == "웹페이지":
                    content.title = scraped.get("title", content.title)
                logger.info(f"✅ 크롤링 완료: {len(content.raw_content or '')} chars")
            else:
                error_msg = scraped.get("error", "크롤링 실패")
                logger.error(f"❌ 크롤링 실패: {error_msg}")
                content.status = "failed"
                session.commit()
                return {"content_id": content_id, "status": "failed", "error": error_msg}

        # 2) AI 요약 (chunk 기반 2단계)
        if content.raw_content:
            logger.info(f"🤖 AI 요약 시작: content_id={content_id}")
            chunks = split_into_chunks(content.raw_content, chunk_size=1100, overlap=180)
            chunk_summaries = []

            for chunk in chunks or [content.raw_content]:
                chunk_res = asyncio.run(
                    ai_service.summarize_chunk(
                        chunk,
                        content.title or "",
                        content.url or "",
                    )
                )
                if not chunk_res.get("success"):
                    error_msg = chunk_res.get("error", "chunk 요약 실패")
                    logger.error(f"❌ chunk 요약 실패: {error_msg}")
                    content.status = "failed"
                    session.commit()
                    return {"content_id": content_id, "status": "failed", "error": error_msg}
                chunk_summaries.append(chunk_res.get("summary", ""))

            if len(chunk_summaries) == 1:
                ai_res = asyncio.run(
                    ai_service.summarize_content(
                        content.raw_content,
                        content.title or "",
                        content.url or "",
                    )
                )
            else:
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
                content.status = "completed"
                logger.info(
                    f"✅ AI 요약 완료: {len(content.summary or '')} chars,"
                    f" {len(content.tags or [])} tags"
                )
            else:
                error_msg = ai_res.get("error", "AI 요약 실패")
                logger.error(f"❌ AI 요약 실패: {error_msg}")
                content.status = "failed"
                session.commit()
                return {"content_id": content_id, "status": "failed", "error": error_msg}

        session.commit()

        # 3) 벡터 저장 (요약이 성공한 경우)
        if content.status == "completed" and content.summary:
            logger.info(f"🔢 벡터 저장 시작: content_id={content_id}")
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
        logger.error(f"❌ 처리 실패: content_id={content_id}, error={e}", exc_info=True)
        try:
            content = session.get(Content, content_id)
            if content:
                content.status = "failed"
                session.commit()
        except Exception:
            logger.warning("실패 상태 업데이트 중 예외 발생", exc_info=True)
        raise
    finally:
        session.close()


@celery_app.task
def health_check():
    """헬스체크"""
    import datetime
    return {
        "status": "healthy", 
        "timestamp": datetime.datetime.now().isoformat()
    }
