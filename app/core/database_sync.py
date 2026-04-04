from typing import Generator
from urllib.parse import parse_qs, urlparse

from sqlalchemy import create_engine, inspect, text
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

with sync_engine.begin() as conn:
    inspector = inspect(conn)
    if "contents" in inspector.get_table_names():
        column_names = {column["name"] for column in inspector.get_columns("contents")}
        if "thumbnail_url" not in column_names:
            conn.execute(text("ALTER TABLE contents ADD COLUMN thumbnail_url VARCHAR(2000)"))
        _rows = conn.execute(
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
        for content_id, url in _rows:
            parsed = urlparse(url or "")
            host = (parsed.netloc or "").lower()
            path = parsed.path or ""
            video_id = None
            if "youtu.be" in host:
                video_id = path.strip("/").split("/")[0] or None
            elif "youtube.com" in host:
                query = parse_qs(parsed.query or "")
                values = query.get("v", [])
                if values:
                    video_id = values[0]
                elif path.startswith("/shorts/") or path.startswith("/embed/"):
                    parts = [part for part in path.split("/") if part]
                    if len(parts) >= 2:
                        video_id = parts[1]
            if video_id:
                conn.execute(
                    text("UPDATE contents SET thumbnail_url = :thumbnail_url WHERE id = :content_id"),
                    {
                        "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                        "content_id": content_id,
                    },
                )

SessionLocal = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False, class_=Session)


def get_sync_session() -> Generator[Session, None, None]:
    """동기 컨텍스트에서 사용할 수 있는 의존성/헬퍼."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

