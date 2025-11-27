from typing import List, Dict, Optional
from qdrant_client.http.models import PointStruct, Filter, FieldCondition, MatchValue
from app.core.vector_config import vector_db
from app.services.embedding_service import embedding_service
import logging
import uuid
import time  # ← 추가

logger = logging.getLogger(__name__)


class VectorService:
    """벡터 저장, 검색, 관리 서비스"""
    
    def __init__(self):
        self.client = vector_db.client
        self.collection_name = vector_db.collection_name
    
    async def store_content_vector(
        self, 
        content_id: int, 
        title: str, 
        summary: str, 
        tags: List[str], 
        user_id: int,
        is_public: bool = False
    ) -> bool:
        """컨텐츠 벡터를 Qdrant에 저장"""
        try:
            search_text = f"{title} {summary} {' '.join(tags)}"
            
            embedding = embedding_service.generate_embedding(search_text)
            
            if not embedding or len(embedding) == 0 or sum(embedding) == 0:
                logger.error(f"❌ 임베딩 생성 실패: content_id={content_id}")
                return False
            
            point_id = str(uuid.uuid4())
            
            point = PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "content_id": content_id,
                    "user_id": user_id,
                    "title": title,
                    "summary": summary[:500],
                    "tags": tags,
                    "is_public": is_public
                }
            )
            
            # 벡터 저장
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point],
                wait=True
            )
            
            logger.info(f"✅ 벡터 저장: content_id={content_id}, title={title}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 벡터 저장 실패: content_id={content_id}, error={e}", exc_info=True)
            return False
    
    async def search_similar_contents(
        self, 
        query: str, 
        user_id: Optional[int] = None,
        limit: int = 5,
        score_threshold: float = 0.5
    ) -> List[Dict]:
        """유사도 기반 컨텐츠 검색"""
        try:
            query_embedding = embedding_service.generate_embedding(query)
            
            if not query_embedding or len(query_embedding) == 0 or sum(query_embedding) == 0:
                logger.error(f"❌ 쿼리 임베딩 생성 실패")
                return []
            
            if user_id:
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id)
                        )
                    ]
                )
            else:
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="is_public",
                            match=MatchValue(value=True)
                        )
                    ]
                )
            
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=limit,
                score_threshold=score_threshold
            )
            
            results = []
            for result in search_results:
                results.append({
                    "content_id": result.payload["content_id"],
                    "title": result.payload["title"],
                    "summary": result.payload["summary"],
                    "tags": result.payload["tags"],
                    "similarity_score": float(result.score),
                    "user_id": result.payload["user_id"]
                })
            
            logger.info(f"✅ 검색 완료: '{query}' → {len(results)}개")
            return results
            
        except Exception as e:
            logger.error(f"❌ 검색 실패: {e}", exc_info=True)
            return []
    
    async def delete_content_vector(self, content_id: int) -> bool:
        """컨텐츠 삭제 시 해당 벡터도 삭제"""
        try:
            search_filter = Filter(
                must=[
                    FieldCondition(
                        key="content_id",
                        match=MatchValue(value=content_id)
                    )
                ]
            )
            
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=search_filter
            )
            logger.info(f"🗑️ 벡터 삭제: content_id={content_id}")
            return True
                
        except Exception as e:
            logger.error(f"❌ 벡터 삭제 실패: {e}")
            return False


vector_service = VectorService()
