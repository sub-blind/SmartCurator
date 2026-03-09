import logging
import re
from time import perf_counter
from typing import Dict, List, Set

from app.core.config import settings
from app.services.ai_service import AIService
from app.services.vector_service import vector_service

logger = logging.getLogger(__name__)


class RAGService:
    """RAG (Retrieval-Augmented Generation) service."""

    def __init__(self):
        self.ai_service = AIService()
        # Keep default at 3000 if MAX_CONTEXT_LENGTH is missing.
        self.max_context_length = getattr(settings, "MAX_CONTEXT_LENGTH", 3000)

        # Tunable rerank weights and diversity cap.
        self.rerank_similarity_weight = 0.8
        self.rerank_overlap_weight = 0.2
        self.max_chunks_per_content = 2

    def _sanitize_query_for_log(self, text: str) -> str:
        """Hide raw query text in production logs to reduce privacy risk."""
        cleaned = (text or "").strip()
        if settings.ENV.lower() == "production":
            return f"[masked len={len(cleaned)}]"
        return cleaned

    async def ask_question(self, question: str, user_id: int) -> Dict:
        """Answer a user question with retrieval + generation."""
        start_time = perf_counter()
        try:
            logger.info(
                "RAG question received: question=%r user_id=%s",
                self._sanitize_query_for_log(question),
                user_id,
            )

            relevant_chunks = await vector_service.search_similar_chunks(
                query=question,
                user_id=user_id,
                limit=12,
                score_threshold=0.30,
                fallback_threshold=0.15,
            )
            relevant_chunks = self._rerank_chunks(question, relevant_chunks)[:8]

            if not relevant_chunks:
                latency_ms = int((perf_counter() - start_time) * 1000)
                logger.info(
                    "RAG_LOG query=%r retrieved_chunks=%d context_length=%d source_count=%d confidence=%.3f answer_latency_ms=%d",
                    self._sanitize_query_for_log(question),
                    0,
                    0,
                    0,
                    0.0,
                    latency_ms,
                )
                return {
                    "answer": "죄송합니다. 질문과 관련된 저장된 내용을 찾지 못했습니다. 더 많은 콘텐츠를 저장해보세요.",
                    "sources": [],
                    "confidence": 0.0,
                }

            context = self._build_context(relevant_chunks)

            ai_response = await self.ai_service.answer_question(
                question=question,
                context=context,
            )

            if not ai_response.get("success"):
                latency_ms = int((perf_counter() - start_time) * 1000)
                logger.error("AI answer generation failed: %s", ai_response.get("error"))
                logger.info(
                    "RAG_LOG query=%r retrieved_chunks=%d context_length=%d source_count=%d confidence=%.3f answer_latency_ms=%d",
                    self._sanitize_query_for_log(question),
                    len(relevant_chunks),
                    len(context),
                    0,
                    0.0,
                    latency_ms,
                )
                return {
                    "answer": "답변 생성 중 오류가 발생했습니다.",
                    "sources": [],
                    "confidence": 0.0,
                }

            sources = [
                {
                    "content_id": chunk["content_id"],
                    "title": chunk["title"],
                    "chunk_index": chunk["chunk_index"],
                    "snippet": chunk["chunk_text"][:220],
                    "similarity_score": round(chunk["similarity_score"], 3),
                }
                for chunk in relevant_chunks[:5]
            ]
            confidence = self._calculate_confidence(relevant_chunks)

            response = {
                "answer": ai_response.get("answer", "답변을 생성하지 못했습니다."),
                "sources": sources,
                "confidence": confidence,
            }

            latency_ms = int((perf_counter() - start_time) * 1000)
            logger.info(
                "RAG_LOG query=%r retrieved_chunks=%d context_length=%d source_count=%d confidence=%.3f answer_latency_ms=%d",
                self._sanitize_query_for_log(question),
                len(relevant_chunks),
                len(context),
                len(sources),
                confidence,
                latency_ms,
            )
            return response

        except Exception as e:
            logger.error("RAG ask_question error: %s", e, exc_info=True)
            return {
                "answer": "죄송합니다. 답변 생성 중 오류가 발생했습니다.",
                "sources": [],
                "confidence": 0.0,
            }

    def _build_context(self, chunks: List[Dict]) -> str:
        """Build model context from retrieved chunks within max length."""
        context_parts: List[str] = []
        current_length = 0

        for i, chunk in enumerate(chunks, 1):
            content_text = (
                f"\n[출처 {i}] {chunk['title']} (chunk {chunk['chunk_index']})\n"
                f"내용:\n{chunk['chunk_text']}\n"
                f"관련도: {chunk['similarity_score']:.1%}\n---"
            )

            if current_length + len(content_text) > self.max_context_length:
                break

            context_parts.append(content_text)
            current_length += len(content_text)

        return "\n".join(context_parts)

    def _rerank_chunks(self, question: str, chunks: List[Dict]) -> List[Dict]:
        """Rerank by semantic score + token overlap and keep source diversity."""
        if not chunks:
            return []

        query_terms = self._tokenize(question)
        scored: List[Dict] = []
        for chunk in chunks:
            chunk_terms = self._tokenize(chunk.get("chunk_text", ""))
            overlap = len(query_terms & chunk_terms) / max(len(query_terms), 1)
            hybrid_score = (
                chunk.get("similarity_score", 0.0) * self.rerank_similarity_weight
                + overlap * self.rerank_overlap_weight
            )
            scored.append({**chunk, "_hybrid_score": hybrid_score})

        scored.sort(key=lambda row: row["_hybrid_score"], reverse=True)

        per_content_count: Dict[int, int] = {}
        diversified: List[Dict] = []
        for item in scored:
            content_id = item["content_id"]
            used = per_content_count.get(content_id, 0)
            if used >= self.max_chunks_per_content:
                continue
            per_content_count[content_id] = used + 1
            diversified.append(item)

        for item in diversified:
            item.pop("_hybrid_score", None)
        return diversified

    def _tokenize(self, text: str) -> Set[str]:
        lowered = (text or "").lower()
        return {tok for tok in re.findall(r"[0-9a-zA-Z가-힣]{2,}", lowered)}

    def _calculate_confidence(self, contents: List[Dict]) -> float:
        """Estimate confidence from retrieval scores and breadth."""
        if not contents:
            return 0.0

        avg_score = sum(content["similarity_score"] for content in contents) / len(contents)
        top_score_bonus = min(contents[0]["similarity_score"] * 0.2, 0.2)
        content_bonus = min(len(contents) * 0.05, 0.2)

        confidence = min(avg_score + content_bonus + top_score_bonus, 1.0)
        return round(confidence, 3)


rag_service = RAGService()
