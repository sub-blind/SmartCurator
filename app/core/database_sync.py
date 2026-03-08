from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

"""
동기 SQLAlchemy 세션 (Celery, 스크립트, Alembic 등에서 사용)
FastAPI는 app.core.database 의 async 엔진을 사용하고,
워커 / 동기 컨텍스트는 이 모듈의 SessionLocal 을 사용한다.
"""

sync_engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False, class_=Session)


def get_sync_session() -> Generator[Session, None, None]:
    """동기 컨텍스트에서 사용할 수 있는 의존성/헬퍼."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

