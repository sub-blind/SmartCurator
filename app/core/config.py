from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    ENV: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"  # JWT 알고리즘
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Scraper
    scraper_timeout: int = 10

    # Content Limit
    max_content_length: int = 5000

    # OpenAI 설정
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-3.5-turbo"  # ← 이 줄 추가
    OPENAI_MAX_TOKENS: int = 4000
    OPENAI_TEMPERATURE: float = 0.3

    # 벡터 데이터베이스 설정
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    
    # 임베딩 모델 설정
    EMBEDDING_MODEL: str = "jhgan/ko-sroberta-multitask"
    EMBEDDING_DIMENSION: int = 768
    
    # RAG 시스템 설정
    MAX_SEARCH_RESULTS: int = 5
    SIMILARITY_THRESHOLD: float = 0.6
    MAX_CONTEXT_LENGTH: int = 3000
    
    # AI 어시스턴트 설정
    AI_MODEL_NAME: str = "gpt-3.5-turbo"
    MAX_RESPONSE_TOKENS: int = 1000
    AI_TEMPERATURE: float = 0.7
    class Config:
        env_file = ".env"

settings = Settings()

try:
    # 콘텐츠 처리 로직
    ...
except Exception as e:
    import traceback
    print("백그라운드 작업 실패:", e)
    traceback.print_exc()
    # DB에 status='failed' 저장
