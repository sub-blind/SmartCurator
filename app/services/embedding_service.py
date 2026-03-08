from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    """텍스트 임베딩 생성 및 유사도 계산 서비스"""
    
    def __init__(self):
        # 한국어 최적화 모델 (경량화된 버전)
        self.model = SentenceTransformer('jhgan/ko-sroberta-multitask')
        logger.info("🤖 임베딩 모델 로드 완료")
    
    def generate_embedding(self, text: str) -> List[float]:
        """단일 텍스트의 임베딩 벡터 생성"""
        if not text or not text.strip():
            return [0.0] * 768
            
        try:
            clean_text = self._preprocess_text(text)
            embedding = self.model.encode(clean_text)
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"임베딩 생성 오류: {e}")
            return [0.0] * 768
    
    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """여러 텍스트의 배치 임베딩 생성 (성능 최적화)"""
        if not texts:
            return []
            
        try:
            clean_texts = [self._preprocess_text(text) for text in texts]
            embeddings = self.model.encode(clean_texts, batch_size=32)
            return [emb.tolist() for emb in embeddings]
            
        except Exception as e:
            logger.error(f"배치 임베딩 생성 오류: {e}")
            return [[0.0] * 768 for _ in texts]
    
    def calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """두 임베딩 간 코사인 유사도 계산"""
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
                
            return float(dot_product / (norm1 * norm2))
            
        except Exception as e:
            logger.error(f"유사도 계산 오류: {e}")
            return 0.0
    
    def _preprocess_text(self, text: str) -> str:
        """임베딩 생성 전 텍스트 전처리"""
        if not text:
            return ""
            
        text = text.strip()
        text = text.replace('\n', ' ').replace('\r', ' ')
        text = ' '.join(text.split())
        
        # 검색 chunk를 충분히 보존하되 너무 길지는 않게 제한
        if len(text) > 1500:
            text = text[:1500]
            
        return text

embedding_service = EmbeddingService()
