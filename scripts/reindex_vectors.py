import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker
from app.core.database import engine
from app.models.content import Content
from app.services.vector_service import vector_service

async def reindex():
    AsyncSessionMaker = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSessionMaker() as session:
        q = await session.execute(
            Content.__table__.select().where(
                Content.status == "completed",
                Content.summary.isnot(None)
            )
        )
        rows = q.fetchall()
        count = 0
        for row in rows:
            c = row[0] if isinstance(row, tuple) else row
            await vector_service.store_content_vector(
                content_id=c.id,
                title=c.title or "",
                summary=c.summary or "",
                tags=c.tags or [],
                user_id=c.user_id,
                is_public=c.is_public or False,
            )
            count += 1
        print(f"Reindexed {count} contents")

if __name__ == "__main__":
    asyncio.run(reindex())