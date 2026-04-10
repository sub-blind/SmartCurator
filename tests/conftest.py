"""
conftest.py — 테스트 전역 설정

무거운 외부 의존성(SentenceTransformer, Qdrant, OpenAI)이
임포트 시점에 실제 연결을 시도하지 않도록
sys.modules 레벨에서 미리 Mock으로 교체한 뒤 app 모듈을 불러온다.
"""

import os
import sys
from unittest.mock import AsyncMock, MagicMock

# ── 1. 필수 환경변수 설정 (Settings 검증 통과용) ──────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-long!")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-fake-key-for-testing-only")

# ── 2. 무거운 라이브러리 Mock (모델 로드 / 네트워크 연결 방지) ─────────────

# sentence_transformers: EmbeddingService.__init__ 에서 모델을 로드하는 것을 막는다
_mock_st = MagicMock()
_mock_st.SentenceTransformer.return_value.encode.return_value = [[0.0] * 768]
sys.modules["sentence_transformers"] = _mock_st

# qdrant_client: VectorDBConfig.__init__ 에서 QdrantClient 연결을 막는다
_mock_qdrant = MagicMock()
sys.modules["qdrant_client"] = _mock_qdrant
sys.modules["qdrant_client.http"] = MagicMock()
sys.modules["qdrant_client.http.models"] = MagicMock()

# openai: AIService.__init__ 에서 AsyncOpenAI 연결을 막는다
_mock_openai = MagicMock()
sys.modules["openai"] = _mock_openai

# celery / redis: Celery 앱 초기화를 막는다
_mock_celery = MagicMock()
sys.modules["celery"] = _mock_celery
sys.modules["redis"] = MagicMock()

# app.core.database_sync: 임포트 시점에 실제 DB에 연결 + 마이그레이션을 실행하므로 통째로 Mock
# (content_tasks.py 가 SessionLocal 을 import 할 때 DB 연결이 일어나는 것을 막는다)
_mock_db_sync = MagicMock()
_mock_db_sync.SessionLocal = MagicMock()
_mock_db_sync.get_sync_session = MagicMock()
sys.modules["app.core.database_sync"] = _mock_db_sync

# ── 3. 공용 픽스처 ────────────────────────────────────────────────────────
import pytest


def make_chunk(
    content_id: int = 1,
    title: str = "테스트 콘텐츠",
    chunk_text: str = "이강인이 파리 생제르맹에서 활약하고 있다.",
    similarity_score: float = 0.8,
    chunk_index: int = 0,
    tags: list | None = None,
) -> dict:
    """RAG / 검색 테스트용 chunk 딕셔너리 팩토리."""
    return {
        "content_id": content_id,
        "title": title,
        "chunk_text": chunk_text,
        "similarity_score": similarity_score,
        "chunk_index": chunk_index,
        "tags": tags or [],
    }
