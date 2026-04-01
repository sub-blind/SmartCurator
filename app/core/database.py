from typing import AsyncGenerator

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings


async_engine = create_async_engine(
    settings.async_database_url,
    echo=settings.DEBUG,
    future=True,
)

async_session_maker = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 라우트용 비동기 세션."""
    async with async_session_maker() as session:
        yield session


async def init_db():
    """기본 테이블과 필요한 컬럼을 보장한다."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_schema_updates)


def _ensure_schema_updates(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "contents" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("contents")}
    if "thumbnail_url" not in column_names:
        sync_conn.execute(text("ALTER TABLE contents ADD COLUMN thumbnail_url VARCHAR(2000)"))
