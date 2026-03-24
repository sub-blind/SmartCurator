import json
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App Settings
    ENV: str = "development"
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    ALLOWED_ORIGIN_REGEX: Optional[str] = None

    # Database
    DATABASE_URL: str  # 동기/기본 연결
    ASYNC_DATABASE_URL: Optional[str] = None  # 비동기 전용 (FastAPI)

    # Celery / Broker
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: Optional[str] = "redis://localhost:6379/1"

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # Scraper
    scraper_timeout: int = 10

    # Content Limit
    max_content_length: int = 5000

    # OpenAI 설정
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    OPENAI_MAX_TOKENS: int = 4000
    OPENAI_TEMPERATURE: float = 0.3

    # 벡터 데이터베이스 설정
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333

    # 임베딩 모델 설정
    EMBEDDING_MODEL: str = "jhgan/ko-sroberta-multitask"
    EMBEDDING_DIMENSION: int = 768

    # RAG 시스템 설정
    MAX_SEARCH_RESULTS: int = 5
    SIMILARITY_THRESHOLD: float = 0.6
    MAX_CONTEXT_LENGTH: int = 3000

    class Config:
        env_file = ".env"
        case_sensitive = False

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value):
        """Allow JSON array or comma-separated origins in env values."""
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []

            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except json.JSONDecodeError:
                    pass

            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return value

    @property
    def async_database_url(self) -> str:
        """FastAPI/async 엔진이 사용할 접속 문자열"""
        if self.ASYNC_DATABASE_URL:
            return self.ASYNC_DATABASE_URL
        if "+asyncpg" in self.DATABASE_URL:
            return self.DATABASE_URL
        if "postgresql+psycopg2" in self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql+psycopg2", "postgresql+asyncpg")
        return self.DATABASE_URL

    @property
    def sync_database_url(self) -> str:
        """동기 컨텍스트(Celery, Alembic)용 접속 문자열"""
        if "+asyncpg" in self.DATABASE_URL:
            return self.DATABASE_URL.replace("+asyncpg", "+psycopg2")
        return self.DATABASE_URL


settings = Settings()
