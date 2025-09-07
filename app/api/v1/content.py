from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_async_session, get_db_session
from app.core.dependencies import get_current_user
from app.schemas.content import ContentCreate, ContentRead, ContentUpdate
from app.services.content_service import ContentService
from app.tasks.content_tasks import process_content_task
from app.models.user import User


router = APIRouter(prefix="/contents", tags=["contents"])


@router.post("/", response_model=ContentRead)
async def create_content(
    content: ContentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """새 컨텐츠 생성 및 백그라운드 처리 시작"""
    content_service = ContentService(session)
    new_content = await content_service.create_content(
        user_id=current_user.id,
        title=content.title,
        url=str(content.url) if content.url else None,
        raw_content=content.raw_content,
        content_type=content.content_type,
        is_public=content.is_public
    )
    process_content_task.delay(new_content.id)
    return new_content


@router.get("/my", response_model=List[ContentRead])
async def get_my_contents(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """현재 사용자 컨텐츠 목록 조회"""
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
    """특정 컨텐츠 상세 조회 및 접근 권한 체크"""
    content_service = ContentService(session)
    content = await content_service.get_content_by_id(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
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
    """컨텐츠 수정 (set된 필드만 업데이트)"""
    content_service = ContentService(session)
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
    """컨텐츠 삭제 권한 확인 후 삭제 처리"""
    content_service = ContentService(session)
    success = await content_service.delete_content(
        content_id=content_id,
        user_id=current_user.id
    )
    if success:
        return {"message": "컨텐츠가 성공적으로 삭제되었습니다"}
    raise HTTPException(status_code=500, detail="삭제 실패")


@router.post("/{content_id}/reprocess")
async def reprocess_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session)
):
    """컨텐츠 요약 재처리 요청 (백그라운드 작업 위임)"""
    content_service = ContentService(session)
    content = await content_service.get_content_by_id(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="컨텐츠를 찾을 수 없습니다")
    if content.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="재처리 권한이 없습니다")
    process_content_task.delay(content_id)
    return {"message": "컨텐츠 재처리가 시작되었습니다"}
