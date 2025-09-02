from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from typing import List, Optional
from app.models.content import Content
from app.models.user import User
from app.services.scraper_service import ScraperService
from app.services.ai_service import AIService
import traceback

class ContentService:
    """컨텐츠 관련 비즈니스 로직"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.scraper = ScraperService()
        self.ai_service = AIService()
    
    async def create_content(self, user_id: int, title: str, url: str = None, 
                           raw_content: str = None, content_type: str = "url", 
                           is_public: bool = False) -> Content:
        """새 컨텐츠 생성"""
        
        # URL과 raw_content 중 하나는 반드시 있어야 함
        if not url and not raw_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL 또는 텍스트 내용이 필요합니다"
            )
        
        # 새 컨텐츠 객체 생성
        new_content = Content(
            user_id=user_id,
            title=title,
            url=url,
            raw_content=raw_content,
            content_type=content_type,
            is_public=is_public,
            status="pending"  # 처리 대기 상태
        )
        
        self.db.add(new_content)
        await self.db.commit()
        await self.db.refresh(new_content)
        
        return new_content
    
    async def process_content_async(self, content_id: int) -> Content:
        """컨텐츠 비동기 처리 (크롤링 + AI 요약)"""
        
        # 컨텐츠 조회
        content = await self.get_content_by_id(content_id)
        if not content:
            raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
        
        try:
            print(f"[DEBUG] 콘텐츠 처리 시작: {content_id}")
            content.status = "processing"
            await self.db.commit()

            if content.content_type == "url" and content.url:
                print(f"[DEBUG] 크롤링 시작: {content.url}")
                scraped_data = await self.scraper.extract_content(content.url)
                print(f"[DEBUG] 크롤링 결과: {scraped_data}")
                if scraped_data["success"]:
                    content.raw_content = scraped_data["content"]
                    if not content.title or content.title == "웹페이지":
                        content.title = scraped_data["title"]
                else:
                    print(f"[ERROR] 크롤링 실패: {scraped_data['error']}")
                    content.status = "failed"
                    await self.db.commit()
                    raise Exception(scraped_data["error"])

            if content.raw_content:
                print(f"[DEBUG] AI 요약 시작")
                ai_result = await self.ai_service.summarize_content(
                    content.raw_content, 
                    content.title,
                    content.url or ""
                )
                print(f"[DEBUG] AI 요약 결과: {ai_result}")
                if ai_result["success"]:
                    content.summary = ai_result["summary"]
                    content.tags = ai_result["tags"]
                    content.status = "completed"
                else:
                    print(f"[ERROR] AI 요약 실패: {ai_result['error']}")
                    content.status = "failed"
                    raise Exception(ai_result["error"])

            await self.db.commit()
            await self.db.refresh(content)
            print(f"[DEBUG] 콘텐츠 처리 완료: {content_id}, status={content.status}")
            return content

        except Exception as e:
            print(f"[EXCEPTION] 콘텐츠 처리 실패: {e}")
            traceback.print_exc()
            content.status = "failed"
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"컨텐츠 처리 실패: {str(e)}"
            )
    
    async def get_user_contents(self, user_id: int, skip: int = 0, limit: int = 20) -> List[Content]:
        """사용자의 컨텐츠 목록 조회"""
        result = await self.db.execute(
            select(Content)
            .where(Content.user_id == user_id)
            .order_by(Content.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
    
    async def get_content_by_id(self, content_id: int) -> Optional[Content]:
        """ID로 컨텐츠 조회"""
        result = await self.db.execute(
            select(Content).where(Content.id == content_id)
        )
        return result.scalars().first()
    
    async def update_content(self, content_id: int, user_id: int, **updates) -> Content:
        """컨텐츠 업데이트 (소유자만 가능)"""
        content = await self.get_content_by_id(content_id)
        
        if not content:
            raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
        
        if content.user_id != user_id:
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다")
        
        # 업데이트 적용
        for key, value in updates.items():
            if hasattr(content, key) and value is not None:
                setattr(content, key, value)
        
        await self.db.commit()
        await self.db.refresh(content)
        return content
    
    async def delete_content(self, content_id: int, user_id: int) -> bool:
        """컨텐츠 삭제 (소유자만 가능)"""
        content = await self.get_content_by_id(content_id)
        
        if not content:
            raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
        
        if content.user_id != user_id:
            raise HTTPException(status_code=403, detail="삭제 권한이 없습니다")
        
        await self.db.delete(content)
        await self.db.commit()
        return True
