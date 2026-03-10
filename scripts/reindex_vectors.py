import asyncio
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.database import async_engine
from app.models.content import Content
from app.services.vector_service import vector_service


async def reindex():
    """Rebuild vectors for completed contents."""
    session_maker = async_sessionmaker(async_engine, expire_on_commit=False)

    try:
        from app.core.vector_config import vector_db

        await vector_db.recreate_collection()

        async with session_maker() as session:
            result = await session.execute(
                select(Content).where(
                    Content.status == "completed",
                    Content.summary.isnot(None),
                )
            )
            rows = result.scalars().all()

            print(f"Contents to index: {len(rows)}")

            success_count = 0
            fail_count = 0

            for content in rows:
                print(f"\nProcessing: {content.title}")
                print(f"  - content_id={content.id}")
                print(f"  - summary_len={len(content.summary) if content.summary else 0}")

                try:
                    success = await vector_service.store_content_chunks(
                        content_id=content.id,
                        title=content.title or "",
                        summary=content.summary or "",
                        tags=content.tags or [],
                        user_id=content.user_id,
                        is_public=content.is_public or False,
                        raw_content=content.raw_content or "",
                    )

                    if success:
                        success_count += 1
                        print("  - success")
                    else:
                        fail_count += 1
                        print("  - failed (success=False)")

                except Exception as e:
                    fail_count += 1
                    print(f"  - exception: {e}")

            print("\n" + "=" * 50)
            print("Reindex finished")
            print(f"  success: {success_count}")
            print(f"  failed: {fail_count}")
            print(f"  total: {success_count + fail_count}")

    except Exception as e:
        print(f"Reindex error: {e}")
        import traceback

        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(reindex())
