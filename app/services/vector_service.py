import logging
import uuid
from collections import defaultdict
from typing import Dict, List, Optional

from qdrant_client.http.models import FieldCondition, Filter, FilterSelector, MatchValue, PointStruct

from app.core.vector_config import vector_db
from app.services.embedding_service import embedding_service
from app.utils.text_chunking import split_into_chunks

logger = logging.getLogger(__name__)


class VectorService:
    """chunk 기반 벡터 저장, 검색, 관리 서비스"""

    def __init__(self):
        self.client = vector_db.client
        self.collection_name = vector_db.collection_name

    def _enhance_query(self, query: str) -> str:
        """짧은 질의의 임베딩 품질을 높이기 위한 경량 쿼리 확장."""
        cleaned = (query or "").strip()
        if len(cleaned) < 2:
            return cleaned
        if len(cleaned) <= 4:
            return f"{cleaned} 관련 뉴스/이슈 배경과 핵심 내용"
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
        """컨텐츠 원문을 chunk 단위로 잘라 Qdrant에 저장한다."""
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
                    logger.warning(f"임베딩 생성 실패로 chunk 건너뜀: content_id={content_id}, chunk={index}")
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
                logger.error(f"❌ 저장할 chunk 벡터가 없음: content_id={content_id}")
                return False

            self.client.upsert(
                collection_name=self.collection_name,
                points=points,
                wait=True,
            )
            logger.info(f"✅ chunk 벡터 저장: content_id={content_id}, chunk_count={len(points)}")
            return True
        except Exception as e:
            logger.error(f"❌ chunk 벡터 저장 실패: content_id={content_id}, error={e}", exc_info=True)
            return False

    async def search_similar_chunks(
        self,
        query: str,
        user_id: Optional[int] = None,
        limit: int = 8,
        score_threshold: float = 0.45,
    ) -> List[Dict]:
        """chunk 단위 유사도 검색."""
        try:
            enhanced_query = self._enhance_query(query)
            query_embedding = embedding_service.generate_embedding(enhanced_query)
            if not query_embedding or len(query_embedding) == 0 or sum(query_embedding) == 0:
                logger.error("❌ 쿼리 임베딩 생성 실패")
                return []

            if user_id is not None:
                search_filter = Filter(
                    must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
                )
            else:
                search_filter = Filter(
                    must=[FieldCondition(key="is_public", match=MatchValue(value=True))]
                )

            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=limit,
                score_threshold=score_threshold,
            )

            # 짧은 질의에서 결과가 없으면 threshold를 완화해 한 번 더 시도
            if len(search_results) == 0:
                relaxed_threshold = max(score_threshold - 0.15, 0.15)
                search_results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_embedding,
                    query_filter=search_filter,
                    limit=limit,
                    score_threshold=relaxed_threshold,
                )
                logger.info(
                    "🔁 검색 재시도: query='%s', threshold %.2f -> %.2f, hits=%d",
                    query,
                    score_threshold,
                    relaxed_threshold,
                    len(search_results),
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

            logger.info(f"✅ chunk 검색 완료: '{query}' → {len(results)}개")
            return results
        except Exception as e:
            logger.error(f"❌ chunk 검색 실패: {e}", exc_info=True)
            return []

    async def search_similar_contents(
        self,
        query: str,
        user_id: Optional[int] = None,
        limit: int = 5,
        score_threshold: float = 0.45,
    ) -> List[Dict]:
        """chunk 검색 결과를 content 단위로 묶어 반환한다."""
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
        """컨텐츠 삭제 시 해당하는 모든 chunk 벡터를 삭제."""
        try:
            search_filter = Filter(
                must=[FieldCondition(key="content_id", match=MatchValue(value=content_id))]
            )
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=FilterSelector(filter=search_filter),
            )
            logger.info(f"🗑️ 벡터 삭제: content_id={content_id}")
            return True
        except Exception as e:
            logger.error(f"❌ 벡터 삭제 실패: {e}")
            return False


vector_service = VectorService()
