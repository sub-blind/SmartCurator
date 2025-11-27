from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.dependencies import get_current_user
from app.services.rag_service import rag_service
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500, description="사용자 질문")


class ChatResponse(BaseModel):
    answer: str
    sources: list
    confidence: float


@router.post("/ask", response_model=ChatResponse)
async def ask_ai_assistant(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """개인 AI 어시스턴트 질의응답 (RAG 기반)"""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="질문을 입력해주세요")
    
    try:
        logger.info(f"🤖 RAG 요청: user_id={current_user.id}, question='{request.question}'")
        
        response = await rag_service.ask_question(
            question=request.question,
            user_id=current_user.id
        )
        
        logger.info(f"✅ RAG 답변 완료: confidence={response['confidence']}")
        return ChatResponse(**response)
        
    except Exception as e:
        logger.error(f"❌ 답변 생성 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"답변 생성 중 오류: {str(e)}")


@router.get("/health")
async def chat_health():
    """채팅 서비스 상태 확인"""
    return {
        "status": "healthy",
        "service": "AI Chat Assistant",
        "features": ["RAG", "Semantic Search", "Personal Knowledge"]
    }
