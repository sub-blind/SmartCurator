from typing import List, Optional
import logging
import traceback

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

        # 지연 임포트로 순환참조 방지
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
        """컨텐츠 수정 (제목, 공개 여부 등 동적 필드 업데이트)"""
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
        """컨텐츠 삭제"""
        content = await self.get_content_by_id(content_id)
        if not content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="컨텐츠를 찾을 수 없습니다")
        if content.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="삭제 권한이 없습니다")

        await self.db.delete(content)
        await self.db.commit()
        return True

    async def process_content_async(self, content_id: int) -> Content:
        """컨텐츠 비동기 처리 (크롤링 + AI 요약)"""
        content = await self.get_content_by_id(content_id)
        if not content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="컨텐츠를 찾을 수 없습니다")

        try:
            logger.debug(f"콘텐츠 처리 시작: {content_id}")
            content.status = "processing"
            await self.db.commit()

            # URL 크롤링 처리
            if content.content_type == "url" and content.url:
                scraped = await self.scraper.extract_content(content.url)
                if scraped.get("success"):
                    content.raw_content = scraped.get("content")
                    if not content.title or content.title == "웹페이지":
                        content.title = scraped.get("title", content.title)
                else:
                    content.status = "failed"
                    await self.db.commit()
                    raise Exception(scraped.get("error", "크롤링 실패"))

            # AI 요약 처리
            if content.raw_content:
                ai_res = await self.ai_service.summarize_content(
                    content.raw_content,
                    content.title or "",
                    content.url or ""
                )
                if ai_res.get("success"):
                    content.summary = ai_res.get("summary")
                    content.tags = ai_res.get("tags", [])
                    content.status = "completed"
                else:
                    content.status = "failed"
                    raise Exception(ai_res.get("error", "AI 요약 실패"))

            await self.db.commit()
            await self.db.refresh(content)
            logger.debug(f"콘텐츠 처리 완료: {content_id}, status={content.status}")
            return content

        except Exception as e:
            logger.error(f"콘텐츠 처리 예외: {e}", exc_info=True)
            content.status = "failed"
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"컨텐츠 처리 실패: {str(e)}"
            )

    async def update_content_status(self, content_id: int, status: str) -> None:
        """컨텐츠 상태만 업데이트"""
        result = await self.db.execute(select(Content).where(Content.id == content_id))
        content = result.scalars().first()
        if not content:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="컨텐츠를 찾을 수 없습니다")
        content.status = status
        await self.db.commit()