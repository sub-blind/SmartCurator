from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.vector_service import vector_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., description="검색 쿼리", min_length=2),
    limit: int = Query(10, ge=1, le=50, description="결과 개수"),
    score_threshold: float = Query(0.05, ge=0.0, le=1.0, description="유사도 임계값"),
    current_user: User = Depends(get_current_user),
):
    try:
        results = await vector_service.search_similar_contents(
            query=q,
            user_id=current_user.id,
            limit=limit,
            score_threshold=score_threshold,
        )
        return {
            "query": q,
            "total": len(results),
            "results": results,
            "search_type": "semantic",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검색 중 오류: {str(e)}")


@router.get("/public")
async def public_semantic_search(
    q: str = Query(..., description="검색 쿼리", min_length=2),
    limit: int = Query(10, ge=1, le=50, description="결과 개수"),
    score_threshold: float = Query(0.05, ge=0.0, le=1.0, description="유사도 임계값"),
):
    try:
        results = await vector_service.search_similar_contents(
            query=q,
            user_id=None,
            limit=limit,
            score_threshold=score_threshold,
        )
        return {
            "query": q,
            "total": len(results),
            "results": results,
            "search_type": "public_semantic",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검색 중 오류: {str(e)}")


@router.get("/health")
async def search_health():
    return {
        "status": "healthy",
        "service": "Semantic Search",
        "features": ["Vector Search", "Similarity Matching", "Multi-user Support"],
    }
