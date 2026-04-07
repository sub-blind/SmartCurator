import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.content_service import ContentService
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500, description="사용자 질문")
    content_id: int | None = Field(default=None, description="현재 보고 있는 콘텐츠 ID")


class ChatResponse(BaseModel):
    answer: str
    sources: list
    confidence: float


@router.post("/ask", response_model=ChatResponse)
async def ask_ai_assistant(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Personal AI assistant question answering backed by user content."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="질문을 입력해주세요")

    try:
        if request.content_id is not None:
            content_service = ContentService(session)
            content = await content_service.get_content_by_id(request.content_id)
            if not content:
                raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
            if content.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="이 콘텐츠에 질문할 권한이 없습니다")

        logger.info(
            "RAG request: user_id=%s content_id=%s question=%r",
            current_user.id,
            request.content_id,
            request.question,
        )

        response = await rag_service.ask_question(
            question=request.question,
            user_id=current_user.id,
            content_id=request.content_id,
        )

        logger.info("RAG response complete: confidence=%s", response["confidence"])
        return ChatResponse(**response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Answer generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"답변 생성 중 오류: {str(e)}")


@router.get("/health")
async def chat_health():
    return {
        "status": "healthy",
        "service": "AI Chat Assistant",
        "features": ["RAG", "Semantic Search", "Personal Knowledge"],
    }
