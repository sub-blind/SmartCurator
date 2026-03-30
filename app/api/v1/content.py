import logging
from io import BytesIO
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.content import ContentCreate, ContentRead, ContentUpdate
from app.services.content_service import ContentService
from app.tasks.content_tasks import process_content_task

router = APIRouter(prefix="/contents", tags=["contents"])
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_EXTRACTED_CHARS = 120_000


@router.post("/", response_model=ContentRead)
async def create_content(
    content: ContentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    content_service = ContentService(session)
    new_content = await content_service.create_content(
        user_id=current_user.id,
        title=content.title,
        url=str(content.url) if content.url else None,
        raw_content=content.raw_content,
        content_type=content.content_type,
        is_public=content.is_public,
    )
    try:
        process_content_task.delay(new_content.id)
    except Exception as e:
        logger.error("백그라운드 작업 등록 실패: content_id=%s error=%s", new_content.id, str(e))
    return new_content


@router.post("/upload", response_model=ContentRead)
async def upload_content_file(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    is_public: bool = Form(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    filename = file.filename or "uploaded-file"
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="비어 있는 파일입니다.")
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하여야 합니다.")

    lowered = filename.lower()
    content_type = "pdf" if lowered.endswith(".pdf") else "text"

    try:
        if content_type == "pdf":
            reader = PdfReader(BytesIO(raw_bytes))
            extracted_pages = [(page.extract_text() or "").strip() for page in reader.pages[:MAX_PDF_PAGES]]
            extracted_text = "\n\n".join(part for part in extracted_pages if part)
        else:
            extracted_text = raw_bytes.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 처리 실패: {str(e)}")

    if not extracted_text:
        raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출하지 못했습니다.")
    if len(extracted_text) > MAX_EXTRACTED_CHARS:
        extracted_text = extracted_text[:MAX_EXTRACTED_CHARS]

    safe_title = (title or "").strip() or filename
    content_service = ContentService(session)
    new_content = await content_service.create_content(
        user_id=current_user.id,
        title=safe_title,
        url=None,
        raw_content=extracted_text,
        content_type=content_type,
        is_public=is_public,
    )
    try:
        process_content_task.delay(new_content.id)
    except Exception as e:
        logger.error("파일 업로드 작업 등록 실패: content_id=%s error=%s", new_content.id, str(e))
    return new_content


@router.get("/my", response_model=List[ContentRead])
async def get_my_contents(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    content_service = ContentService(session)
    return await content_service.get_user_contents(user_id=current_user.id, skip=skip, limit=limit)


@router.get("/{content_id}", response_model=ContentRead)
async def get_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    content_service = ContentService(session)
    content = await content_service.get_content_by_id(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    if content.user_id != current_user.id and not content.is_public:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    return content


@router.put("/{content_id}", response_model=ContentRead)
async def update_content(
    content_id: int,
    content_update: ContentUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    content_service = ContentService(session)
    update_data = content_update.dict(exclude_unset=True)
    return await content_service.update_content(content_id=content_id, user_id=current_user.id, **update_data)


@router.delete("/{content_id}")
async def delete_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    content_service = ContentService(session)
    success = await content_service.delete_content(content_id=content_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="삭제에 실패했습니다.")
    return {"message": "콘텐츠가 삭제되었습니다."}


@router.post("/{content_id}/reprocess")
async def reprocess_content(
    content_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    content_service = ContentService(session)
    content = await content_service.get_content_by_id(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다.")
    if content.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="재처리 권한이 없습니다.")

    content.status = "pending"
    content.processing_error = None
    await session.commit()

    process_content_task.delay(content_id)
    return {"message": "콘텐츠 재처리를 시작했습니다."}
