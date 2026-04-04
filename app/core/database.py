from typing import AsyncGenerator
from urllib.parse import parse_qs, urlparse

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

    _backfill_youtube_thumbnails(sync_conn)


def _extract_youtube_video_id(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        path = parsed.path or ""
        if "youtu.be" in host:
            video_id = path.strip("/").split("/")[0]
            return video_id or None
        if "youtube.com" in host:
            query = parse_qs(parsed.query or "")
            values = query.get("v", [])
            if values:
                return values[0]
            if path.startswith("/shorts/") or path.startswith("/embed/"):
                parts = [part for part in path.split("/") if part]
                if len(parts) >= 2:
                    return parts[1]
    except Exception:
        return None
    return None


def _build_youtube_thumbnail_url(video_id: str | None) -> str | None:
    if not video_id:
        return None
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def _backfill_youtube_thumbnails(sync_conn) -> None:
    rows = sync_conn.execute(
        text(
            """
            SELECT id, url
            FROM contents
            WHERE (thumbnail_url IS NULL OR thumbnail_url = '')
              AND url IS NOT NULL
              AND (url ILIKE '%youtube.com%' OR url ILIKE '%youtu.be%')
            """
        )
    ).fetchall()

    for content_id, url in rows:
        thumbnail_url = _build_youtube_thumbnail_url(_extract_youtube_video_id(url))
        if not thumbnail_url:
            continue
        sync_conn.execute(
            text("UPDATE contents SET thumbnail_url = :thumbnail_url WHERE id = :content_id"),
            {"thumbnail_url": thumbnail_url, "content_id": content_id},
        )
