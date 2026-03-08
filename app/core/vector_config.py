from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from app.core.config import settings
import logging


logger = logging.getLogger(__name__)


class VectorDBConfig:
    """Qdrant 벡터 데이터베이스 설정 및 관리"""
    
    def __init__(self):
        # Qdrant 클라이언트 초기화
        self.client = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
            timeout=30
        )
        self.collection_name = "content_embeddings"
        self.vector_size = 768  # 한국어 임베딩 모델 차원
        
    async def setup_collection(self):
        """벡터 컬렉션 초기 설정"""
        try:
            collections = self.client.get_collections()
            collection_names = [col.name for col in collections.collections]
            
            if self.collection_name not in collection_names:
                # ⭐ on_disk_payload=False 추가 (중요!)
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE  # 코사인 유사도 사용
                    ),
                    on_disk_payload=False  # ← 메모리 인덱싱 사용
                )
                logger.info(f"✅ Qdrant 컬렉션 생성: {self.collection_name}")
            else:
                logger.info(f"📁 기존 컬렉션 사용: {self.collection_name}")
                
        except Exception as e:
            logger.error(f"❌ Qdrant 설정 오류: {e}")
            raise

    async def recreate_collection(self):
        """기존 컬렉션을 삭제 후 새 구조로 재생성."""
        try:
            self.client.delete_collection(self.collection_name)
            logger.info(f"🗑️ 기존 Qdrant 컬렉션 삭제: {self.collection_name}")
        except Exception:
            logger.info("삭제할 기존 컬렉션이 없거나 이미 비어 있습니다.")

        await self.setup_collection()


vector_db = VectorDBConfig()
