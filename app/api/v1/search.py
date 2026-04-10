from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.vector_service import vector_service

router = APIRouter(prefix="/search", tags=["search"])


class SearchMode(str, Enum):
    precise = "precise"    # 정확 — 유사도 높은 결과만
    balanced = "balanced"  # 균형 — 기본값
    broad = "broad"        # 넓게 — 더 많은 결과


# 모드별 score_threshold 매핑
_MODE_THRESHOLDS: dict[SearchMode, float] = {
    SearchMode.precise: 0.45,
    SearchMode.balanced: 0.25,
    SearchMode.broad: 0.12,
}

# 모드별 한국어 레이블 (응답에 포함)
_MODE_LABELS: dict[SearchMode, str] = {
    SearchMode.precise: "정확",
    SearchMode.balanced: "균형",
    SearchMode.broad: "넓게",
}


@router.get("/semantic")
async def semantic_search(
    q: str = Query(..., description="검색 쿼리", min_length=2),
    mode: SearchMode = Query(
        SearchMode.balanced,
        description="검색 범위 — precise(정확) / balanced(균형) / broad(넓게)",
    ),
    limit: int = Query(10, ge=1, le=50, description="결과 개수"),
    current_user: User = Depends(get_current_user),
):
    score_threshold = _MODE_THRESHOLDS[mode]
    try:
        results = await vector_service.search_similar_contents(
            query=q,
            user_id=current_user.id,
            limit=limit,
            score_threshold=score_threshold,
        )
        return {
            "query": q,
            "mode": mode,
            "mode_label": _MODE_LABELS[mode],
            "score_threshold": score_threshold,
            "total": len(results),
            "results": results,
            "search_type": "semantic",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"검색 중 오류: {str(e)}")


@router.get("/public")
async def public_semantic_search(
    q: str = Query(..., description="검색 쿼리", min_length=2),
    mode: SearchMode = Query(
        SearchMode.balanced,
        description="검색 범위 — precise(정확) / balanced(균형) / broad(넓게)",
    ),
    limit: int = Query(10, ge=1, le=50, description="결과 개수"),
):
    score_threshold = _MODE_THRESHOLDS[mode]
    try:
        results = await vector_service.search_similar_contents(
            query=q,
            user_id=None,
            limit=limit,
            score_threshold=score_threshold,
        )
        return {
            "query": q,
            "mode": mode,
            "mode_label": _MODE_LABELS[mode],
            "score_threshold": score_threshold,
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
        "modes": {mode.value: _MODE_LABELS[mode] for mode in SearchMode},
    }
