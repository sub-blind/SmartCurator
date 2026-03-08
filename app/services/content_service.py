from typing import List, Optional
import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.content import Content

logger = logging.getLogger(__name__)


class ContentService:
    """컨텐츠 관련 비즈니스 로직"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_content(
        self,
        user_id: int,
        title: str,
        url: Optional[str] = None,
        raw_content: Optional[str] = None,
        content_type: str = "url",
        is_public: bool = False,
    ) -> Content:
        """새 컨텐츠 생성 (태스크 발행은 API 레이어에서 담당)"""
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

