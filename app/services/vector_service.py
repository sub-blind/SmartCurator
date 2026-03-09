import logging
import uuid
from collections import defaultdict
from typing import Dict, List, Optional

from qdrant_client.http.models import FieldCondition, Filter, FilterSelector, MatchValue, PointStruct

from app.core.config import settings
from app.core.vector_config import vector_db
from app.services.embedding_service import embedding_service
from app.utils.text_chunking import split_into_chunks

logger = logging.getLogger(__name__)


class VectorService:
    """Service for storing and searching chunk-based vectors."""

    def __init__(self):
        self.client = vector_db.client
        self.collection_name = vector_db.collection_name

    def _enhance_query(self, query: str) -> str:
        """Light query expansion for very short user queries."""
        cleaned = (query or "").strip()
        if len(cleaned) < 2:
            return cleaned
        if len(cleaned) <= 4:
            return f"{cleaned} 관련 이슈/정의 배경과 맥락 내용"
        return cleaned

    def _sanitize_query_for_log(self, text: str) -> str:
        """Hide raw query text in production logs to reduce privacy risk."""
        cleaned = (text or "").strip()
        if settings.ENV.lower() == "production":
            return f"[masked len={len(cleaned)}]"
        return cleaned

    async def store_content_chunks(
        self,
        content_id: int,
        title: str,
        summary: str,
        tags: List[str],
        user_id: int,
        is_public: bool = False,
        raw_content: str = "",
    ) -> bool:
        """Split content into chunks and upsert vectors to Qdrant."""
        try:
            await self.delete_content_vector(content_id)

            chunks = split_into_chunks(raw_content or summary or title, chunk_size=1100, overlap=180)
            if not chunks:
                chunks = [summary or title]

            points: List[PointStruct] = []
            for index, chunk_text in enumerate(chunks):
                search_text = f"{title} {chunk_text} {' '.join(tags)}"
                embedding = embedding_service.generate_embedding(search_text)
                if not embedding or len(embedding) == 0 or sum(embedding) == 0:
                    logger.warning(
                        "Skip chunk due to empty embedding: content_id=%s, chunk=%s",
                        content_id,
                        index,
                    )
                    continue

                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=embedding,
                        payload={
                            "content_id": content_id,
                            "chunk_index": index,
                            "chunk_text": chunk_text[:1500],
                            "title": title,
                            "summary": (summary or "")[:800],
                            "tags": tags,
                            "user_id": user_id,
                            "is_public": is_public,
                        },
                    )
                )

            if not points:
                logger.error("No vectors to upsert: content_id=%s", content_id)
                return False

            self.client.upsert(
                collection_name=self.collection_name,
                points=points,
                wait=True,
            )
            logger.info("Stored content vectors: content_id=%s, chunk_count=%s", content_id, len(points))
            return True
        except Exception as e:
            logger.error("Failed to store vectors: content_id=%s, error=%s", content_id, e, exc_info=True)
            return False

    async def search_similar_chunks(
        self,
        query: str,
        user_id: Optional[int] = None,
        limit: int = 12,
        score_threshold: float = 0.30,
        fallback_threshold: float = 0.15,
        query_enhance: bool = True,
    ) -> List[Dict]:
        """Search similar chunks with optional fallback threshold retry."""
        try:
            cleaned_query = (query or "").strip()
            should_enhance = query_enhance and len(cleaned_query) <= 4
            enhanced_query = self._enhance_query(cleaned_query) if should_enhance else cleaned_query

            query_embedding = embedding_service.generate_embedding(enhanced_query)
            if not query_embedding or len(query_embedding) == 0 or sum(query_embedding) == 0:
                logger.error("Failed to generate query embedding")
                return []

            if user_id is not None:
                search_filter = Filter(
                    must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
                )
            else:
                search_filter = Filter(
                    must=[FieldCondition(key="is_public", match=MatchValue(value=True))]
                )

            initial_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=limit,
                score_threshold=score_threshold,
            )

            fallback_used = False
            search_results = initial_results
            if len(initial_results) == 0:
                fallback_used = True
                search_results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_embedding,
                    query_filter=search_filter,
                    limit=limit,
                    score_threshold=fallback_threshold,
                )

            results: List[Dict] = []
            for result in search_results:
                results.append(
                    {
                        "content_id": result.payload["content_id"],
                        "chunk_index": result.payload.get("chunk_index", 0),
                        "chunk_text": result.payload.get("chunk_text", ""),
                        "title": result.payload["title"],
                        "summary": result.payload.get("summary", ""),
                        "tags": result.payload.get("tags", []),
                        "similarity_score": float(result.score),
                        "user_id": result.payload["user_id"],
                    }
                )

            top_scores = [row["similarity_score"] for row in results[:limit]]
            top1_score = top_scores[0] if top_scores else 0.0
            avg_topk_score = sum(top_scores) / len(top_scores) if top_scores else 0.0

            logger.info(
                "RETRIEVAL_LOG query=%r enhanced_query=%r initial_hits=%d fallback_used=%s final_hits=%d top1_score=%.4f avg_topk_score=%.4f",
                self._sanitize_query_for_log(cleaned_query),
                self._sanitize_query_for_log(enhanced_query),
                len(initial_results),
                fallback_used,
                len(results),
                top1_score,
                avg_topk_score,
            )
            return results
        except Exception as e:
            logger.error("Failed to search chunks: %s", e, exc_info=True)
            return []

    async def search_similar_contents(
        self,
        query: str,
        user_id: Optional[int] = None,
        limit: int = 6,
        score_threshold: float = 0.30,
    ) -> List[Dict]:
        """Group chunk-level retrieval results into content-level results."""
        chunk_results = await self.search_similar_chunks(
            query=query,
            user_id=user_id,
            limit=max(limit * 4, 8),
            score_threshold=score_threshold,
        )
        if not chunk_results:
            return []

        grouped: Dict[int, Dict] = {}
        grouped_chunks: Dict[int, List[Dict]] = defaultdict(list)

        for item in chunk_results:
            grouped_chunks[item["content_id"]].append(item)
            current = grouped.get(item["content_id"])
            if current is None or item["similarity_score"] > current["similarity_score"]:
                grouped[item["content_id"]] = {
                    "content_id": item["content_id"],
                    "title": item["title"],
                    "summary": item["summary"],
                    "tags": item["tags"],
                    "similarity_score": item["similarity_score"],
                    "user_id": item["user_id"],
                }

        results: List[Dict] = []
        for content_id, meta in grouped.items():
            chunks = sorted(
                grouped_chunks[content_id],
                key=lambda row: row["similarity_score"],
                reverse=True,
            )[:3]
            meta["matched_chunks"] = chunks
            meta["top_snippet"] = chunks[0]["chunk_text"] if chunks else ""
            results.append(meta)

        results.sort(key=lambda row: row["similarity_score"], reverse=True)
        return results[:limit]

    async def delete_content_vector(self, content_id: int) -> bool:
        """Delete all chunks for a specific content id."""
        try:
            search_filter = Filter(
                must=[FieldCondition(key="content_id", match=MatchValue(value=content_id))]
            )
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=FilterSelector(filter=search_filter),
            )
            logger.info("Deleted vectors: content_id=%s", content_id)
            return True
        except Exception as e:
            logger.error("Failed to delete vectors: %s", e)
            return False


vector_service = VectorService()
