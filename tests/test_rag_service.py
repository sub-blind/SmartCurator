"""
test_rag_service.py

RAGService 의 핵심 로직을 Mock 기반으로 테스트한다.
- vector_service, AIService 를 Mock으로 교체해 외부 호출 없이 실행한다.
- _rerank_chunks, _filter_visible_chunks, _build_sources, _calculate_confidence,
  ask_question 흐름을 검증한다.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import make_chunk


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def rag_service():
    """외부 의존성을 Mock 처리한 RAGService 인스턴스."""
    with (
        patch("app.services.rag_service.AIService") as mock_ai_cls,
        patch("app.services.rag_service.vector_service"),
    ):
        mock_ai_cls.return_value = MagicMock()
        from app.services.rag_service import RAGService
        service = RAGService()
        service.ai_service = MagicMock()
        return service


# ─────────────────────────────────────────────────────────────
# _rerank_chunks
# ─────────────────────────────────────────────────────────────
class TestRerankChunks:
    def test_noisy_chunks_excluded(self, rag_service):
        chunks = [
            make_chunk(1, "정상 기사", "이강인이 득점을 기록했다.", 0.8),
            make_chunk(2, "노이즈", "javascript: void(0)", 0.9),  # noisy
        ]
        result = rag_service._rerank_chunks("이강인 득점", chunks)
        content_ids = [c["content_id"] for c in result]
        assert 1 in content_ids
        assert 2 not in content_ids

    def test_anchor_match_boosts_score(self, rag_service):
        # 질문 anchor "이강인" 을 포함하는 chunk 가 더 높은 점수를 받아야 한다
        chunks = [
            make_chunk(1, "무관한 기사", "트럼프 미국 대선 발언", 0.7),
            make_chunk(2, "이강인 기사", "이강인 챔피언스리그 골", 0.7),
        ]
        result = rag_service._rerank_chunks("이강인 관련 뉴스 요약", chunks)
        # 이강인 기사가 더 앞에 와야 함
        assert result[0]["content_id"] == 2

    def test_max_chunks_per_content_enforced(self, rag_service):
        # 같은 content_id 에서 최대 2개만 허용 (max_chunks_per_content=2)
        chunks = [
            make_chunk(1, "기사A", "이강인 첫 번째 청크", 0.9, chunk_index=0),
            make_chunk(1, "기사A", "이강인 두 번째 청크", 0.85, chunk_index=1),
            make_chunk(1, "기사A", "이강인 세 번째 청크", 0.8, chunk_index=2),
        ]
        result = rag_service._rerank_chunks("이강인", chunks)
        from_content_1 = [c for c in result if c["content_id"] == 1]
        assert len(from_content_1) <= rag_service.max_chunks_per_content

    def test_empty_input_returns_empty(self, rag_service):
        assert rag_service._rerank_chunks("질문", []) == []

    def test_sorted_by_hybrid_score_descending(self, rag_service):
        chunks = [
            make_chunk(1, "저점수", "손흥민 골", 0.4),
            make_chunk(2, "고점수", "이강인 득점 챔피언스", 0.9),
        ]
        result = rag_service._rerank_chunks("이강인 챔피언스", chunks)
        if len(result) >= 2:
            assert result[0]["_hybrid_score"] >= result[1]["_hybrid_score"]


# ─────────────────────────────────────────────────────────────
# _filter_visible_chunks
# ─────────────────────────────────────────────────────────────
class TestFilterVisibleChunks:
    def test_empty_input_returns_empty(self, rag_service):
        assert rag_service._filter_visible_chunks([]) == []

    def test_high_score_chunks_visible(self, rag_service):
        chunks = [
            {**make_chunk(1, "A", "텍스트", 0.9), "_hybrid_score": 0.88},
            {**make_chunk(2, "B", "텍스트", 0.88), "_hybrid_score": 0.85},
        ]
        result = rag_service._filter_visible_chunks(chunks)
        assert len(result) >= 1

    def test_very_low_score_filtered(self, rag_service):
        # top score 0.9 기준 0.10 이상 차이나는 chunk 는 제외된다
        chunks = [
            {**make_chunk(1, "A", "텍스트", 0.9), "_hybrid_score": 0.88},
            {**make_chunk(2, "B", "텍스트", 0.2), "_hybrid_score": 0.15},
        ]
        result = rag_service._filter_visible_chunks(chunks)
        content_ids = [c["content_id"] for c in result]
        assert 1 in content_ids
        assert 2 not in content_ids

    def test_fallback_returns_at_least_one(self, rag_service):
        # 필터 조건을 만족하는 chunk 가 없어도 최소 1개는 반환
        chunks = [
            {**make_chunk(1, "유일한 chunk", "텍스트", 0.15), "_hybrid_score": 0.12},
        ]
        result = rag_service._filter_visible_chunks(chunks)
        assert len(result) >= 1


# ─────────────────────────────────────────────────────────────
# _build_sources
# ─────────────────────────────────────────────────────────────
class TestBuildSources:
    def test_deduplicates_same_content_id(self, rag_service):
        chunks = [
            make_chunk(1, "기사A", "첫 번째 청크", 0.9, chunk_index=0),
            make_chunk(1, "기사A", "두 번째 청크", 0.7, chunk_index=1),
        ]
        sources = rag_service._build_sources(chunks)
        assert len(sources) == 1

    def test_keeps_highest_score_per_content(self, rag_service):
        chunks = [
            make_chunk(1, "기사A", "낮은 점수 청크", 0.6, chunk_index=0),
            make_chunk(1, "기사A", "높은 점수 청크", 0.9, chunk_index=1),
        ]
        sources = rag_service._build_sources(chunks)
        assert sources[0]["similarity_score"] == 0.9

    def test_sorted_by_score_descending(self, rag_service):
        chunks = [
            make_chunk(1, "낮은기사", "텍스트", 0.5),
            make_chunk(2, "높은기사", "텍스트", 0.9),
        ]
        sources = rag_service._build_sources(chunks)
        assert sources[0]["similarity_score"] >= sources[-1]["similarity_score"]

    def test_max_5_sources_returned(self, rag_service):
        chunks = [make_chunk(i, f"기사{i}", "텍스트", 0.8) for i in range(10)]
        sources = rag_service._build_sources(chunks)
        assert len(sources) <= 5

    def test_source_contains_required_fields(self, rag_service):
        chunks = [make_chunk(1, "테스트 기사", "본문 내용", 0.8)]
        sources = rag_service._build_sources(chunks)
        required = {"content_id", "title", "snippet", "similarity_score", "chunk_index"}
        assert required.issubset(sources[0].keys())


# ─────────────────────────────────────────────────────────────
# _calculate_confidence
# ─────────────────────────────────────────────────────────────
class TestCalculateConfidence:
    def test_empty_returns_zero(self, rag_service):
        assert rag_service._calculate_confidence([]) == 0.0

    def test_high_scores_give_high_confidence(self, rag_service):
        chunks = [make_chunk(i, "기사", "텍스트", 0.95) for i in range(3)]
        confidence = rag_service._calculate_confidence(chunks)
        assert confidence > 0.7

    def test_low_scores_give_low_confidence(self, rag_service):
        chunks = [make_chunk(i, "기사", "텍스트", 0.2) for i in range(3)]
        confidence = rag_service._calculate_confidence(chunks)
        assert confidence < 0.6

    def test_confidence_bounded_zero_to_one(self, rag_service):
        chunks = [make_chunk(i, "기사", "텍스트", 1.0) for i in range(10)]
        confidence = rag_service._calculate_confidence(chunks)
        assert 0.0 <= confidence <= 1.0

    def test_more_chunks_increases_confidence(self, rag_service):
        few_chunks = [make_chunk(i, "기사", "텍스트", 0.7) for i in range(1)]
        many_chunks = [make_chunk(i, "기사", "텍스트", 0.7) for i in range(4)]
        assert (
            rag_service._calculate_confidence(many_chunks)
            >= rag_service._calculate_confidence(few_chunks)
        )


# ─────────────────────────────────────────────────────────────
# ask_question (통합 흐름)
# ─────────────────────────────────────────────────────────────
class TestAskQuestion:
    @pytest.mark.asyncio
    async def test_returns_answer_and_sources_on_success(self):
        """정상 흐름: 벡터 검색 → 리랭킹 → GPT 답변 → 소스 반환."""
        mock_chunks = [
            make_chunk(1, "이강인 기사", "이강인이 챔피언스리그에서 득점했다.", 0.85),
            make_chunk(2, "PSG 기사", "PSG가 16강에 진출했다.", 0.75),
        ]
        mock_ai_response = {
            "success": True,
            "answer": "이강인은 챔피언스리그에서 득점을 기록했습니다.",
        }

        with (
            patch("app.services.rag_service.AIService"),
            patch("app.services.rag_service.vector_service") as mock_vs,
        ):
            mock_vs.search_similar_chunks = AsyncMock(return_value=mock_chunks)

            from app.services.rag_service import RAGService
            service = RAGService()
            service.ai_service = MagicMock()
            service.ai_service.answer_question = AsyncMock(return_value=mock_ai_response)

            result = await service.ask_question("이강인 관련 뉴스", user_id=1)

        assert "answer" in result
        assert "sources" in result
        assert "confidence" in result
        assert result["answer"] == mock_ai_response["answer"]
        assert len(result["sources"]) > 0

    @pytest.mark.asyncio
    async def test_returns_fallback_when_no_chunks(self):
        """검색 결과가 없으면 근거 없음 메시지를 반환해야 한다."""
        with (
            patch("app.services.rag_service.AIService"),
            patch("app.services.rag_service.vector_service") as mock_vs,
        ):
            mock_vs.search_similar_chunks = AsyncMock(return_value=[])

            from app.services.rag_service import RAGService
            service = RAGService()
            service.ai_service = MagicMock()

            result = await service.ask_question("존재하지 않는 내용", user_id=1)

        assert result["confidence"] == 0.0
        assert result["sources"] == []
        assert "근거" in result["answer"] or "찾지 못" in result["answer"]

    @pytest.mark.asyncio
    async def test_returns_error_message_when_ai_fails(self):
        """AI 답변 생성이 실패하면 에러 메시지를 반환해야 한다."""
        mock_chunks = [make_chunk(1, "기사", "이강인 내용", 0.85)]

        with (
            patch("app.services.rag_service.AIService"),
            patch("app.services.rag_service.vector_service") as mock_vs,
        ):
            mock_vs.search_similar_chunks = AsyncMock(return_value=mock_chunks)

            from app.services.rag_service import RAGService
            service = RAGService()
            service.ai_service = MagicMock()
            service.ai_service.answer_question = AsyncMock(
                return_value={"success": False, "error": "OpenAI timeout"}
            )

            result = await service.ask_question("이강인", user_id=1)

        assert result["confidence"] == 0.0
        assert result["sources"] == []
        assert "오류" in result["answer"]
