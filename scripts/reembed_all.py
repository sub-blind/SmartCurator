"""
기존 콘텐츠 벡터를 새 임베딩 모델로 재처리하는 스크립트.

Usage:
    python scripts/reembed_all.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.content import Content
from app.services.vector_service import vector_service

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def reembed_all():
    async with async_session_maker() as db:
        result = await db.execute(
            select(Content).where(
                Content.status == "completed",
                Content.summary.isnot(None),
            )
        )
        contents = result.scalars().all()
        logger.info("재처리 대상 콘텐츠: %d개", len(contents))

        success, fail = 0, 0
        for content in contents:
            try:
                ok = await vector_service.store_content_chunks(
                    content_id=content.id,
                    title=content.title or "",
                    summary=content.summary or "",
                    tags=content.tags or [],
                    user_id=content.user_id,
                    is_public=content.is_public or False,
                    raw_content=content.raw_content or "",
                )
                if ok:
                    success += 1
                    logger.info("✅ content_id=%d", content.id)
                else:
                    fail += 1
                    logger.warning("⚠️ 벡터 저장 실패: content_id=%d", content.id)
            except Exception as e:
                fail += 1
                logger.error("❌ content_id=%d error=%s", content.id, e)

        logger.info("완료 — 성공: %d / 실패: %d", success, fail)


if __name__ == "__main__":
    asyncio.run(reembed_all())
