import json
import logging
import re
from typing import Any, Dict, List

from app.core.config import settings


logger = logging.getLogger(__name__)


class AIService:
    """OpenAI GPT를 활용한 AI 서비스"""

    def __init__(self):
        try:
            from openai import AsyncOpenAI

            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        except ImportError:
            import openai

            openai.api_key = settings.OPENAI_API_KEY
            self.client = None

        self.model_name = getattr(settings, "OPENAI_MODEL", "gpt-3.5-turbo")

    async def summarize_chunk(self, chunk: str, title: str = "", url: str = "") -> Dict[str, Any]:
        """개별 chunk를 짧게 요약한다."""
        prompt = self._create_chunk_summary_prompt(title, chunk, url)
        try:
            response = await self._chat_json(
                system_message=(
                    "당신은 기사/문서의 핵심만 압축해 정리하는 에디터입니다. "
                    "추측 없이 사실 위주로 정리하고, 수치/날짜/고유명사를 우선 반영하세요."
                ),
                user_message=prompt,
                max_tokens=350,
                temperature=0.2,
            )
            normalized = self._normalize_summary_payload(response, "문단 요약을 생성할 수 없습니다.")
            return {
                "summary": normalized["summary"],
                "key_points": normalized["key_points"][:4],
                "success": True,
            }
        except Exception as e:
            logger.error(f"chunk 요약 실패: {e}")
            return {"success": False, "error": str(e), "summary": ""}

    async def summarize_content(self, content: str, title: str = "", url: str = "") -> Dict[str, Any]:
        """짧은 컨텐츠용 단일 요약. 긴 문서는 synthesize_chunk_summaries와 함께 사용한다."""
        content_truncated = content[:12000] if len(content) > 12000 else content
        prompt = self._create_summary_prompt(title, content_truncated, url)
        try:
            response = await self._chat_json(
                system_message=(
                    "당신은 전문적인 콘텐츠 큐레이터입니다. "
                    "정확한 근거만 사용해 한국어 요약/태그를 생성하고, "
                    "사실과 해석을 구분해 표현하세요."
                ),
                user_message=prompt,
                max_tokens=700,
                temperature=0.2,
            )
            normalized = self._normalize_summary_payload(response, "요약을 생성할 수 없습니다.")
            return {
                "summary": normalized["summary"],
                "tags": normalized["tags"],
                "key_points": normalized["key_points"],
                "insight": normalized["insight"],
                "success": True,
            }
        except Exception as e:
            logger.error(f"AI 요약 실패: {e}")
            return {"error": f"AI 요약 실패: {str(e)}", "success": False}

    async def synthesize_chunk_summaries(
        self,
        title: str,
        url: str,
        chunk_summaries: List[str],
    ) -> Dict[str, Any]:
        """chunk 요약들을 합쳐 최종 요약/태그/핵심포인트를 만든다."""
        prepared_chunk_summaries = self._prepare_chunk_summaries(chunk_summaries)
        combined = "\n".join(
            f"- Chunk {index + 1}: {summary}"
            for index, summary in enumerate(prepared_chunk_summaries)
            if summary.strip()
        )
        prompt = self._create_final_summary_prompt(title, url, combined)
        try:
            response = await self._chat_json(
                system_message=(
                    "당신은 여러 문단 요약을 종합해 최종 기사 요약을 만드는 시니어 에디터입니다. "
                    "중복을 제거하고 충돌 정보를 조정해 핵심 주장과 중요한 세부사항을 구조적으로 정리하세요."
                ),
                user_message=prompt,
                max_tokens=800,
                temperature=0.2,
            )
            normalized = self._normalize_summary_payload(response, "요약을 생성할 수 없습니다.")
            return {
                "summary": normalized["summary"],
                "tags": normalized["tags"],
                "key_points": normalized["key_points"],
                "insight": normalized["insight"],
                "success": True,
            }
        except Exception as e:
            logger.error(f"최종 요약 합성 실패: {e}")
            return {"success": False, "error": str(e)}

    async def answer_question(self, question: str, context: str) -> Dict[str, Any]:
        """chunk 기반 컨텍스트를 활용한 RAG 답변."""
        prompt = f"""당신은 사용자의 개인 지식 어시스턴트입니다.

사용자가 저장한 지식 근거:
{context}

사용자 질문: {question}

지침:
- 반드시 제공된 근거만 사용하세요
- 근거가 부족하면 모른다고 답하세요
- 추측하거나 일반 상식으로 메우지 마세요
- 답변은 핵심 답변 먼저, 이후 근거 요약 순서로 작성하세요
- 답변 마지막에 참고한 출처 번호를 간단히 적으세요
"""
        try:
            logger.info(f"🤖 RAG 질답 시작: question='{question[:50]}...'")
            response = await self._chat_completion(
                system_message=(
                    "당신은 사용자의 개인 지식 어시스턴트입니다. "
                    "근거가 없는 정보는 답변하지 말고, 정확성과 출처를 우선하세요."
                ),
                user_message=prompt,
                max_tokens=600,
                temperature=0.2,
            )
            answer = (response.choices[0].message.content or "").strip()
            logger.info(f"✅ RAG 질답 완료: {answer[:50]}...")
            return {
                "success": True,
                "answer": answer,
                "token_used": response.usage.total_tokens,
            }
        except Exception as e:
            logger.error(f"❌ RAG 질답 실패: {e}", exc_info=True)
            return {"success": False, "error": str(e), "answer": ""}

    def _create_chunk_summary_prompt(self, title: str, chunk: str, url: str) -> str:
        return f"""
다음은 기사 또는 문서의 일부 문단입니다.

제목: {title}
URL: {url}
문단:
{chunk}

작성 규칙:
- 사실만 쓰고 추측 금지
- 중복 문장 제거
- 수치/날짜/고유명사(기관명, 인물명, 지명)를 우선 반영
- 문단에 의견/전망이 있으면 사실과 구분해 표현

아래 JSON만 반환하세요.
{{
  "summary": "이 문단의 핵심 요약 2~3문장",
  "key_points": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"]
}}
"""

    def _create_summary_prompt(self, title: str, content: str, url: str) -> str:
        return f"""
다음 콘텐츠를 한국어로 구조화해 요약해주세요.

제목: {title}
URL: {url}
내용:
{content}

광고/중복/장식적 문장을 최대한 배제하고, 아래 JSON만 반환하세요.
추가 규칙:
- 핵심 사실을 먼저 제시하고 해석은 분리
- 가능한 경우 수치/날짜/비교대상 포함
- 같은 의미의 key_points/tag는 하나로 합치기
{{
  "summary": "핵심 내용을 3~4문장으로 요약",
  "key_points": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"],
  "tags": ["태그1", "태그2", "태그3"],
  "insight": "이 콘텐츠를 읽고 얻을 수 있는 한 줄 인사이트"
}}
"""

    def _create_final_summary_prompt(self, title: str, url: str, chunk_summaries: str) -> str:
        return f"""
아래는 긴 콘텐츠를 chunk 단위로 나눠 요약한 결과입니다.

제목: {title}
URL: {url}
chunk 요약들:
{chunk_summaries}

이 정보를 바탕으로 전체 문서를 대표하는 최종 요약을 작성하세요.
추가 규칙:
- chunk 간 중복은 제거
- 서로 충돌하는 주장/수치가 있으면 '출처별 차이'로 명시
- 과도한 일반화 금지, 근거가 없는 해석 금지
반드시 아래 JSON만 반환하세요.
{{
  "summary": "전체 문서 최종 요약 3~4문장",
  "key_points": ["가장 중요한 포인트1", "가장 중요한 포인트2", "가장 중요한 포인트3"],
  "tags": ["태그1", "태그2", "태그3"],
  "insight": "실무적으로 왜 중요한지 한 줄"
}}
"""

    async def _chat_json(
        self,
        system_message: str,
        user_message: str,
        max_tokens: int,
        temperature: float,
    ) -> Dict[str, Any]:
        response = await self._chat_completion(
            system_message=system_message,
            user_message=user_message,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        raw = response.choices[0].message.content or "{}"
        return self._extract_json(raw)

    async def _chat_completion(
        self,
        system_message: str,
        user_message: str,
        max_tokens: int,
        temperature: float,
    ):
        if self.client:
            return await self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
            )

        import openai

        return await openai.ChatCompletion.acreate(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )

    def _extract_json(self, response: str) -> Dict[str, Any]:
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            start = response.find("{")
            end = response.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(response[start : end + 1])
            raise

    def _prepare_chunk_summaries(self, chunk_summaries: List[str]) -> List[str]:
        seen = set()
        prepared: List[str] = []
        for summary in chunk_summaries:
            normalized = self._normalize_text(summary)
            if not normalized:
                continue
            if normalized in seen:
                continue
            seen.add(normalized)
            prepared.append(normalized)
        return prepared

    def _normalize_summary_payload(self, payload: Dict[str, Any], default_summary: str) -> Dict[str, Any]:
        summary = self._dedupe_sentences(str(payload.get("summary", "")).strip()) or default_summary
        key_points = self._normalize_list(payload.get("key_points", []), max_items=5)
        tags = self._normalize_tags(payload.get("tags", []), max_items=5)
        insight = self._normalize_text(str(payload.get("insight", "")).strip())
        return {
            "summary": summary,
            "key_points": key_points,
            "tags": tags,
            "insight": insight,
        }

    def _normalize_list(self, items: Any, max_items: int = 5) -> List[str]:
        if not isinstance(items, list):
            return []
        seen = set()
        normalized: List[str] = []
        for item in items:
            text = self._normalize_text(str(item))
            if len(text) < 2 or text in seen:
                continue
            seen.add(text)
            normalized.append(text)
            if len(normalized) >= max_items:
                break
        return normalized

    def _normalize_tags(self, items: Any, max_items: int = 5) -> List[str]:
        raw_tags = self._normalize_list(items, max_items=max_items * 2)
        cleaned: List[str] = []
        seen = set()
        for tag in raw_tags:
            tag = re.sub(r"[\[\]\(\)\{\}#\"']", "", tag).strip()
            if len(tag) < 2:
                continue
            key = tag.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(tag)
            if len(cleaned) >= max_items:
                break
        return cleaned or ["일반"]

    def _normalize_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", text or "").strip()

    def _dedupe_sentences(self, text: str) -> str:
        normalized = self._normalize_text(text)
        if not normalized:
            return ""
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", normalized) if p.strip()]
        if len(parts) <= 1:
            return normalized
        seen = set()
        deduped: List[str] = []
        for part in parts:
            key = part.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(part)
        return " ".join(deduped)
