"""
test_search_ranking.py

search_ranking.py 의 순수 함수들을 단위 테스트한다.
외부 의존성이 없으므로 Mock 없이 직접 임포트한다.
"""

import pytest

from app.utils.search_ranking import (
    compute_hybrid_score,
    compute_token_overlap,
    contains_anchor_terms,
    extract_anchor_terms,
    is_noisy_text,
    tokenize_korean_text,
)


# ─────────────────────────────────────────────────────────────
# tokenize_korean_text
# ─────────────────────────────────────────────────────────────
class TestTokenizeKoreanText:
    def test_korean_tokens_extracted(self):
        result = tokenize_korean_text("이강인 파리생제르맹 이적")
        assert "이강인" in result
        assert "파리생제르맹" in result

    def test_english_lowercased(self):
        result = tokenize_korean_text("Python FastAPI")
        assert "python" in result
        assert "fastapi" in result

    def test_mixed_korean_english(self):
        result = tokenize_korean_text("딥러닝 tutorial")
        assert "딥러닝" in result
        assert "tutorial" in result

    def test_empty_string_returns_empty_set(self):
        assert tokenize_korean_text("") == set()

    def test_single_char_tokens_excluded(self):
        # TOKEN_PATTERN 은 2자 이상만 매칭한다
        result = tokenize_korean_text("나 는 학 교")
        assert result == set()

    def test_returns_set_no_duplicates(self):
        result = tokenize_korean_text("이강인 이강인 이강인")
        assert result == {"이강인"}


# ─────────────────────────────────────────────────────────────
# extract_anchor_terms
# ─────────────────────────────────────────────────────────────
class TestExtractAnchorTerms:
    def test_stopwords_filtered(self):
        anchors = extract_anchor_terms("이강인 관련 뉴스 요약좀 해줘")
        assert "관련" not in anchors
        assert "뉴스" not in anchors
        assert "요약좀" not in anchors

    def test_meaningful_terms_kept(self):
        anchors = extract_anchor_terms("이강인 관련 뉴스 요약좀 해줘")
        assert "이강인" in anchors

    def test_max_4_anchors(self):
        long_query = "파리 이강인 득점 챔피언스리그 결승 바르셀로나 미드필더"
        anchors = extract_anchor_terms(long_query)
        assert len(anchors) <= 4

    def test_empty_query_returns_empty(self):
        assert extract_anchor_terms("") == []

    def test_all_stopwords_returns_empty(self):
        assert extract_anchor_terms("관련 뉴스 요약 정리 해줘") == []

    def test_deduplication(self):
        anchors = extract_anchor_terms("이강인 이강인 이강인")
        assert anchors.count("이강인") == 1

    def test_order_preserved(self):
        anchors = extract_anchor_terms("파리 이강인")
        assert anchors.index("파리") < anchors.index("이강인")


# ─────────────────────────────────────────────────────────────
# contains_anchor_terms
# ─────────────────────────────────────────────────────────────
class TestContainsAnchorTerms:
    def test_anchor_present(self):
        assert contains_anchor_terms("이강인이 득점을 기록했다", ["이강인"]) is True

    def test_anchor_absent(self):
        assert contains_anchor_terms("손흥민이 골을 넣었다", ["이강인"]) is False

    def test_empty_anchors_always_true(self):
        # 필터 자체가 없으면 항상 통과
        assert contains_anchor_terms("아무 텍스트나", []) is True

    def test_one_of_multiple_anchors_matches(self):
        # any() 이므로 하나만 일치해도 True
        assert contains_anchor_terms("이강인 소식", ["이강인", "손흥민"]) is True

    def test_case_insensitive_via_lowercase(self):
        # contains_anchor_terms 는 lowered 비교이므로 소문자 anchor 기준
        assert contains_anchor_terms("PSG 경기", ["psg"]) is True


# ─────────────────────────────────────────────────────────────
# is_noisy_text
# ─────────────────────────────────────────────────────────────
class TestIsNoisyText:
    def test_empty_string_is_noisy(self):
        assert is_noisy_text("") is True

    def test_whitespace_only_is_noisy(self):
        assert is_noisy_text("   ") is True

    def test_javascript_colon_is_noisy(self):
        assert is_noisy_text("javascript: void(0)") is True

    def test_news_listen_is_noisy(self):
        assert is_noisy_text("뉴스 듣기") is True

    def test_share_button_is_noisy(self):
        assert is_noisy_text("공유하기") is True

    def test_sns_names_are_noisy(self):
        assert is_noisy_text("페이스북 카카오톡 밴드 트위터 공유") is True

    def test_url_copy_is_noisy(self):
        assert is_noisy_text("URL복사") is True

    def test_normal_article_text_not_noisy(self):
        assert is_noisy_text(
            "이강인이 파리 생제르맹에서 챔피언스리그 8강에 출전해 결승골을 넣었다."
        ) is False

    def test_technical_content_not_noisy(self):
        assert is_noisy_text(
            "FastAPI는 Python 3.8+ 기반의 고성능 웹 프레임워크입니다."
        ) is False


# ─────────────────────────────────────────────────────────────
# compute_token_overlap
# ─────────────────────────────────────────────────────────────
class TestComputeTokenOverlap:
    def test_full_overlap(self):
        # 질의 토큰이 모두 텍스트에 포함
        score = compute_token_overlap("이강인 파리", "이강인 파리 생제르맹 뉴스")
        assert score == 1.0

    def test_no_overlap(self):
        score = compute_token_overlap("이강인", "손흥민 득점")
        assert score == 0.0

    def test_partial_overlap(self):
        score = compute_token_overlap("이강인 파리", "이강인 바르셀로나")
        assert 0.0 < score < 1.0

    def test_empty_query_returns_zero(self):
        assert compute_token_overlap("", "이강인") == 0.0

    def test_empty_text_returns_zero(self):
        assert compute_token_overlap("이강인", "") == 0.0

    def test_score_bounded_zero_to_one(self):
        score = compute_token_overlap("이강인 파리 득점 챔피언스", "이강인")
        assert 0.0 <= score <= 1.0


# ─────────────────────────────────────────────────────────────
# compute_hybrid_score
# ─────────────────────────────────────────────────────────────
class TestComputeHybridScore:
    def test_no_overlap_uses_similarity_only(self):
        # overlap=0 → score = similarity * 0.7
        score = compute_hybrid_score(
            query="이강인",
            text="손흥민 골",
            similarity_score=0.9,
        )
        assert abs(score - 0.9 * 0.7) < 0.01

    def test_full_overlap_full_similarity(self):
        score = compute_hybrid_score(
            query="이강인",
            text="이강인 득점",
            similarity_score=1.0,
        )
        # overlap=1.0 → score = 1.0*0.7 + 1.0*0.3 = 1.0
        assert abs(score - 1.0) < 0.01

    def test_custom_weights_applied(self):
        score = compute_hybrid_score(
            query="이강인",
            text="이강인",
            similarity_score=0.5,
            similarity_weight=0.5,
            overlap_weight=0.5,
        )
        # overlap=1.0 → score = 0.5*0.5 + 1.0*0.5 = 0.75
        assert abs(score - 0.75) < 0.01

    def test_score_increases_with_overlap(self):
        score_no_overlap = compute_hybrid_score("이강인", "손흥민", 0.7)
        score_with_overlap = compute_hybrid_score("이강인", "이강인 뉴스", 0.7)
        assert score_with_overlap > score_no_overlap
