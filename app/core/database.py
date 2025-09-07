from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from typing import AsyncGenerator
from app.core.config import settings

# 비동기 엔진 생성
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

# 비동기 세션 팩토리
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base 클래스
Base = declarative_base()

# 일반 async generator (직접 사용용)
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

# FastAPI 의존성 주입 전용 함수
async def get_db_session() -> AsyncSession:
    async with async_session_maker() as session:
        return session

# 데이터베이스 초기화 함수
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
