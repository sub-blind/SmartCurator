from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import get_current_user
from app.services.vector_service import vector_service
from app.models.user import User

router = APIRouter(prefix="/search", tags=["search"])

@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., description="검색 쿼리", min_length=2),
    limit: int = Query(10, ge=1, le=50, description="결과 개수"),
    score_threshold: float = Query(0.4, ge=0.0, le=1.0, description="유사도 임계값"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)

    
):
    """
    의미론적 검색 API
    - 사용자의 자연어 쿼리를 임베딩으로 변환
    - 저장된 컨텐츠와 유사도 계산하여 관련 결과 반환
    """
    try:
        results = await vector_service.search_similar_contents(
            query=q,
            user_id=current_user.id,
            limit=limit,
            score_threshold=score_threshold
        )
        
        return {
            "query": q,
            "total": len(results),
            "results": results,
            "search_type": "semantic"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검색 중 오류: {str(e)}")

@router.get("/public")
async def public_semantic_search(
    q: str = Query(..., description="검색 쿼리", min_length=2),
    limit: int = Query(10, ge=1, le=50, description="결과 개수"),
    score_threshold: float = Query(0.4, ge=0.0, le=1.0, description="유사도 임계값"),
    session: AsyncSession = Depends(get_db_session)
):
    """
    공개 컨텐츠 의미론적 검색
    - 로그인 없이 공개된 컨텐츠만 검색
    """
    try:
        results = await vector_service.search_similar_contents(
            query=q,
            user_id=None,  # 모든 사용자의 공개 컨텐츠
            limit=limit,
            score_threshold=score_threshold
        )
        
        return {
            "query": q,
            "total": len(results),
            "results": results,
            "search_type": "public_semantic"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검색 중 오류: {str(e)}")

@router.get("/health")
async def search_health():
    """검색 서비스 상태 확인"""
    return {
        "status": "healthy",
        "service": "Semantic Search",
        "features": ["Vector Search", "Similarity Matching", "Multi-user Support"]
    }
