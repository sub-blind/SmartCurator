from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from typing import AsyncGenerator
from app.core.config import settings

# ===== 비동기 엔진 =====
async_engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    future=True
)

async_session_maker = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 베이스 클래스
Base = declarative_base()


# FastAPI 의존성 주입용
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 엔드포인트용 비동기 세션"""
    async with async_session_maker() as session:
        yield session


# 추가: get_async_session (기존 코드 호환성)
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """get_db_session과 동일 (호환성 유지)"""
    async with async_session_maker() as session:
        yield session


async def init_db():
    """데이터베이스 초기화"""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
