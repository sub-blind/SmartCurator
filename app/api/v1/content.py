from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.schemas.content import ContentCreate, ContentRead, ContentUpdate
from app.services.content_service import ContentService
from app.models.user import User

router = APIRouter(prefix="/contents", tags=["contents"])

@router.post("/", response_model=ContentRead)
async def create_content(
    content: ContentCreate,
    background_tasks: BackgroundTasks,  # 백그라운드 작업용
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """새 컨텐츠 저장 (URL 또는 직접 텍스트)"""
    
    content_service = ContentService(session)
    
    # 컨텐츠 생성
    new_content = await content_service.create_content(
        user_id=current_user.id,
        title=content.title,
        url=str(content.url) if content.url else None,
        raw_content=content.raw_content,
        content_type=content.content_type,
        is_public=content.is_public
    )
    
    # 백그라운드에서 크롤링 + AI 요약 처리
    background_tasks.add_task(
        process_content_in_background, 
        new_content.id, 
        session
    )
    
    return new_content

async def process_content_in_background(content_id: int, session: AsyncSession):
    """백그라운드에서 실행되는 컨텐츠 처리 함수"""
    try:
        content_service = ContentService(session)
        await content_service.process_content_async(content_id)
    except Exception as e:
        print(f"백그라운드 작업 실패: {e}")  # 로깅 시스템으로 대체 예정

@router.get("/my", response_model=List[ContentRead])
async def get_my_contents(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """내 컨텐츠 목록 조회"""
    
    content_service = ContentService(session)
    contents = await content_service.get_user_contents(
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    
    return contents

@router.get("/{content_id}", response_model=ContentRead)
async def get_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """특정 컨텐츠 상세 조회"""
    
    content_service = ContentService(session)
    content = await content_service.get_content_by_id(content_id)
    
    if not content:
        raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
    
    # 소유자이거나 공개 컨텐츠인 경우만 조회 가능
    if content.user_id != current_user.id and not content.is_public:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    
    return content

@router.put("/{content_id}", response_model=ContentRead)
async def update_content(
    content_id: int,
    content_update: ContentUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """컨텐츠 수정 (제목, 공개 여부만)"""
    
    content_service = ContentService(session)
    
    # 업데이트할 필드만 추출
    update_data = content_update.dict(exclude_unset=True)
    
    updated_content = await content_service.update_content(
        content_id=content_id,
        user_id=current_user.id,
        **update_data
    )
    
    return updated_content

@router.delete("/{content_id}")
async def delete_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """컨텐츠 삭제"""
    
    content_service = ContentService(session)
    success = await content_service.delete_content(
        content_id=content_id,
        user_id=current_user.id
    )
    
    if success:
        return {"message": "컨텐츠가 성공적으로 삭제되었습니다"}
    else:
        raise HTTPException(status_code=500, detail="삭제 실패")

@router.post("/{content_id}/reprocess")
async def reprocess_content(
    content_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """컨텐츠 재처리 (요약 다시 생성)"""
    
    content_service = ContentService(session)
    content = await content_service.get_content_by_id(content_id)
    
    if not content:
        raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
    
    if content.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="재처리 권한이 없습니다")
    
    # 백그라운드에서 재처리
    background_tasks.add_task(
        process_content_in_background, 
        content_id, 
        session
    )
    
    return {"message": "컨텐츠 재처리가 시작되었습니다"}
