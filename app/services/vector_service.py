from typing import List, Dict, Optional
from qdrant_client.http.models import PointStruct, Filter, FieldCondition, MatchValue
from app.core.vector_config import vector_db
from app.services.embedding_service import embedding_service
import logging
import uuid

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
        is_public: bool
    ):
        """컨텐츠 벡터를 Qdrant에 저장"""
        try:
            # 검색 대상 텍스트 구성 (제목 + 요약 + 태그)
            search_text = f"{title} {summary} {' '.join(tags)}"
            
            # 임베딩 생성
            embedding = embedding_service.generate_embedding(search_text)
            
            # Qdrant 포인트 생성
            point = PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={
                    "content_id": content_id,
                    "user_id": user_id,
                    "title": title,
                    "summary": summary[:200],
                    "tags": tags,
                    "search_text": search_text[:300],
                    "is_public": is_public  # ← 추가
                }
            )
            
            # 벡터 저장
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )
            
            logger.info(f"✅ 벡터 저장: content_id={content_id}")
            
        except Exception as e:
            logger.error(f"❌ 벡터 저장 실패: content_id={content_id}, error={e}")
            raise
    
    async def search_similar_contents(
        self, 
        query: str, 
        user_id: Optional[int] = None,
        limit: int = 10,
        score_threshold: float = 0.7
    ) -> List[Dict]:
        """유사도 기반 컨텐츠 검색"""
        try:
            # 검색 쿼리 임베딩 생성
            query_embedding = embedding_service.generate_embedding(query)
            
            # 사용자 필터링 (개인 컨텐츠만 또는 전체)
            search_filter = None
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
            
            
            # 벡터 유사도 검색 실행
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=search_filter,
                limit=limit,
                score_threshold=score_threshold
            )
            
            # 검색 결과 포맷팅
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
            
            logger.info(f"🔍 검색 완료: '{query}' → {len(results)}개 결과")
            return results
            
        except Exception as e:
            logger.error(f"❌ 검색 실패: '{query}', error={e}")
            return []
    
    async def delete_content_vector(self, content_id: int):
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
            
            # 삭제할 벡터 찾기
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=[0.0] * vector_db.vector_size,
                query_filter=search_filter,
                limit=10
            )
            
            if search_results:
                point_ids = [result.id for result in search_results]
                self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=point_ids
                )
                logger.info(f"🗑️ 벡터 삭제: content_id={content_id}")
                
        except Exception as e:
            logger.error(f"❌ 벡터 삭제 실패: content_id={content_id}, error={e}")

vector_service = VectorService()
