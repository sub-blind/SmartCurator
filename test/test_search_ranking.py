import unittest

from app.utils.search_ranking import (
    compute_hybrid_score,
    compute_token_overlap,
    tokenize_korean_text,
)


class SearchRankingTestCase(unittest.TestCase):
    def test_tokenize_korean_text_keeps_korean_english_and_numbers(self):
        tokens = tokenize_korean_text("RAG 구조 2026 정리")
        self.assertEqual(tokens, {"rag", "구조", "2026", "정리"})

    def test_compute_token_overlap_returns_zero_when_no_match(self):
        overlap = compute_token_overlap("로봇 기사", "흙의 날 칼럼")
        self.assertEqual(overlap, 0.0)

    def test_compute_token_overlap_returns_ratio_for_matching_terms(self):
        overlap = compute_token_overlap("로봇 관련 기사", "로봇 투자 관련 기사 요약")
        self.assertGreaterEqual(overlap, 2 / 3)

    def test_compute_hybrid_score_rewards_token_match(self):
        robot_score = compute_hybrid_score(
            query="로봇 관련 기사",
            text="LG CNS 로봇 투자 관련 기사",
            similarity_score=0.04,
        )
        soil_score = compute_hybrid_score(
            query="로봇 관련 기사",
            text="흙의 날 칼럼",
            similarity_score=0.10,
        )
        self.assertGreater(robot_score, soil_score)


if __name__ == "__main__":
    unittest.main()
