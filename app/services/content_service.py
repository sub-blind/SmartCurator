from typing import List, Optional
import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.content import Content
from app.services.scraper_service import ScraperService
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)


class ContentService:
    """컨텐츠 관련 비즈니스 로직"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.scraper = ScraperService()
        self.ai_service = AIService()

    async def create_content(
        self,
        user_id: int,
        title: str,
        url: Optional[str] = None,
        raw_content: Optional[str] = None,
        content_type: str = "url",
        is_public: bool = False
    ) -> Content:
        """새 컨텐츠 생성 및 Celery 백그라운드 태스크 등록"""
        if not url and not raw_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL 또는 텍스트 내용이 필요합니다"
            )

        new_content = Content(
            user_id=user_id,
            title=title,
            url=url,
            raw_content=raw_content,
            content_type=content_type,
            is_public=is_public,
            status="pending"
        )

        self.db.add(new_content)
        await self.db.commit()
        await self.db.refresh(new_content)

        from app.tasks.content_tasks import process_content_task
        task = process_content_task.delay(new_content.id)
        logger.info(f"백그라운드 태스크 시작: content_id={new_content.id}, task_id={task.id}")

        return new_content

    async def get_content_by_id(self, content_id: int) -> Optional[Content]:
        """단일 컨텐츠 조회"""
        result = await self.db.execute(select(Content).where(Content.id == content_id))
        return result.scalars().first()

    async def get_user_contents(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[Content]:
        """사용자 컨텐츠 목록 조회"""
        result = await self.db.execute(
            select(Content)
            .where(Content.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def update_content(
        self,
        content_id: int,
        user_id: int,
        **fields
    ) -> Content:
        """컨텐츠 수정"""
        content = await self.get_content_by_id(content_id)
        if not content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="컨텐츠를 찾을 수 없습니다")
        if content.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="수정 권한이 없습니다")

        for key, value in fields.items():
            setattr(content, key, value)

        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def delete_content(self, content_id: int, user_id: int) -> bool:
        """컨텐츠 및 벡터 동시 삭제"""
        content = await self.get_content_by_id(content_id)
        if not content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="컨텐츠를 찾을 수 없습니다")
        if content.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다")

        await self.db.delete(content)
        await self.db.commit()

        # 벡터 삭제
        from app.services.vector_service import vector_service
        await vector_service.delete_content_vector(content_id)
        logger.info(f"🗑️ 벡터 삭제 완료: content_id={content_id}")
        return True

    async def update_content_status(self, content_id: int, status: str) -> None:
        """
        컨텐츠 상태만 업데이트
        flush 후 커밋은 호출하는 쪽에서!
        """
        result = await self.db.execute(select(Content).where(Content.id == content_id))
        content = result.scalars().first()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="컨텐츠를 찾을 수 없습니다"
            )
        content.status = status
        await self.db.flush()  # ← 추가: flush로 변경사항 반영

    async def process_content_async(self, content_id: int) -> Content:
        """
        컨텐츠 비동기 처리 (크롤링 + AI 요약)
        """
        content = await self.get_content_by_id(content_id)
        if not content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="컨텐츠를 찾을 수 없습니다"
            )

        try:
            logger.info(f"🔄 컨텐츠 처리 시작: content_id={content_id}")

            # URL 크롤링 처리
            if content.content_type == "url" and content.url:
                logger.info(f"🌐 크롤링 시작: {content.url}")
                scraped = await self.scraper.extract_content(content.url)
                
                if scraped.get("success"):
                    content.raw_content = scraped.get("content")
                    if not content.title or content.title == "웹페이지":
                        content.title = scraped.get("title", content.title)
                    logger.info(f"✅ 크롤링 완료: {len(content.raw_content)} chars")
                else:
                    error_msg = scraped.get("error", "크롤링 실패")
                    logger.error(f"❌ 크롤링 실패: {error_msg}")
                    content.status = "failed"
                    await self.db.flush()
                    raise Exception(error_msg)

            # AI 요약 처리
            if content.raw_content:
                logger.info(f"🤖 AI 요약 시작: content_id={content_id}")
                ai_res = await self.ai_service.summarize_content(
                    content.raw_content,
                    content.title or "",
                    content.url or ""
                )
                
                if ai_res.get("success"):
                    content.summary = ai_res.get("summary")
                    content.tags = ai_res.get("tags", [])
                    content.status = "completed"
                    logger.info(f"✅ AI 요약 완료: {len(content.summary)} chars, {len(content.tags)} tags")
                else:
                    error_msg = ai_res.get("error", "AI 요약 실패")
                    logger.error(f"❌ AI 요약 실패: {error_msg}")
                    content.status = "failed"
                    await self.db.flush()
                    raise Exception(error_msg)

            # DB에 flush
            await self.db.flush()
            logger.info(f"💾 DB flush 완료: content_id={content_id}, status={content.status}")

            return content

        except Exception as e:
            logger.error(f"❌ 컨텐츠 처리 실패: content_id={content_id}, error={e}", exc_info=True)
            content.status = "failed"
            await self.db.flush()
            raise
