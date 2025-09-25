from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db_session
from app.core.dependencies import get_current_user
from app.services.rag_service import rag_service
from app.models.user import User

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    question: str
    
class ChatResponse(BaseModel):
    answer: str
    sources: list
    confidence: float

@router.post("/ask", response_model=ChatResponse)
async def ask_ai_assistant(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    """개인 AI 어시스턴트 질의응답"""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="질문을 입력해주세요")
    
    try:
        response = await rag_service.ask_question(
            question=request.question,
            user_id=current_user.id
        )
        
        return ChatResponse(**response)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"답변 생성 중 오류: {str(e)}")

@router.get("/health")
async def chat_health():
    """채팅 서비스 상태 확인"""
    return {
        "status": "healthy",
        "service": "AI Chat Assistant",
        "features": ["RAG", "Semantic Search", "Personal Knowledge"]
    }
