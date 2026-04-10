"""
test_content_pipeline.py

content_tasks.py 의 순수 헬퍼 함수들을 단위 테스트한다.
Celery / DB / AI 호출이 없는 함수들만 다룬다.
"""

import pytest

from app.tasks.content_tasks import (
    DIRECT_SUMMARY_CHAR_LIMIT,
    DIRECT_SUMMARY_MAX_CHUNKS,
    MIN_SCRAPED_CONTENT_CHARS,
    _clean_generated_title,
    _is_usable_scraped_title,
    _is_valid_scraped_content,
    _is_youtube_url,
    _merge_chunks_for_summary,
    _needs_auto_title,
    _sentence_count,
    _should_use_direct_summary,
)


# ─────────────────────────────────────────────────────────────
# _merge_chunks_for_summary
# ─────────────────────────────────────────────────────────────
class TestMergeChunksForSummary:
    def test_no_merge_when_under_limit(self):
        chunks = ["chunk1", "chunk2", "chunk3"]
        result = _merge_chunks_for_summary(chunks, max_chunks=8)
        assert result == chunks

    def test_merges_when_over_limit(self):
        chunks = [f"chunk{i}" for i in range(20)]
        result = _merge_chunks_for_summary(chunks, max_chunks=8)
        assert len(result) <= 8

    def test_merged_preserves_all_content(self):
        chunks = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        result = _merge_chunks_for_summary(chunks, max_chunks=4)
        full = "\n".join(result)
        for item in chunks:
            assert item in full

    def test_exact_limit_no_merge(self):
        chunks = ["chunk"] * 8
        result = _merge_chunks_for_summary(chunks, max_chunks=8)
        assert result == chunks

    def test_single_chunk_unchanged(self):
        chunks = ["단일 청크"]
        assert _merge_chunks_for_summary(chunks) == chunks


# ─────────────────────────────────────────────────────────────
# _is_valid_scraped_content
# ─────────────────────────────────────────────────────────────
class TestIsValidScrapedContent:
    def test_normal_content_is_valid(self):
        # 충분히 긴 한국어 텍스트
        text = "이강인이 파리 생제르맹에서 활약하고 있다. " * 10
        assert _is_valid_scraped_content(text) is True

    def test_empty_string_invalid(self):
        assert _is_valid_scraped_content("") is False

    def test_whitespace_only_invalid(self):
        assert _is_valid_scraped_content("   \n\t  ") is False

    def test_failure_marker_korean_invalid(self):
        assert _is_valid_scraped_content("내용을 추출할 수 없습니다") is False

    def test_failure_marker_english_invalid(self):
        assert _is_valid_scraped_content("unable to extract content") is False

    def test_too_short_invalid(self):
        # MIN_SCRAPED_CONTENT_CHARS = 120
        assert _is_valid_scraped_content("짧은 텍스트") is False

    def test_exactly_at_minimum_valid(self):
        text = "가" * MIN_SCRAPED_CONTENT_CHARS
        assert _is_valid_scraped_content(text) is True


# ─────────────────────────────────────────────────────────────
# _needs_auto_title
# ─────────────────────────────────────────────────────────────
class TestNeedsAutoTitle:
    def test_none_needs_auto_title(self):
        assert _needs_auto_title(None) is True

    def test_empty_string_needs_auto_title(self):
        assert _needs_auto_title("") is True

    def test_placeholder_title_needs_auto(self):
        assert _needs_auto_title("제목 없음") is True
        assert _needs_auto_title("자동 생성 제목") is True
        assert _needs_auto_title("웹페이지") is True

    def test_webpage_prefix_needs_auto(self):
        assert _needs_auto_title("웹페이지 - example.com") is True
        assert _needs_auto_title("유튜브 링크 - https://youtu.be/abc") is True

    def test_real_title_no_auto(self):
        assert _needs_auto_title("이강인, PSG와 계약 연장 협상 중") is False
        assert _needs_auto_title("FastAPI 공식 문서 — 시작하기") is False


# ─────────────────────────────────────────────────────────────
# _is_usable_scraped_title
# ─────────────────────────────────────────────────────────────
class TestIsUsableScrapedTitle:
    def test_good_korean_title_usable(self):
        assert _is_usable_scraped_title("이강인 파리생제르맹 챔피언스리그 2골 1어시스트") is True

    def test_none_not_usable(self):
        assert _is_usable_scraped_title(None) is False

    def test_empty_not_usable(self):
        assert _is_usable_scraped_title("") is False

    def test_too_short_not_usable(self):
        # 8자 미만
        assert _is_usable_scraped_title("뉴스") is False
        assert _is_usable_scraped_title("YouTube") is False

    def test_generic_youtube_short_not_usable(self):
        # "youtube" 포함 + 18자 이하 → not usable
        assert _is_usable_scraped_title("YouTube") is False

    def test_auto_title_marker_not_usable(self):
        assert _is_usable_scraped_title("제목 없음") is False

    def test_long_youtube_title_can_be_usable(self):
        # 19자 초과 유튜브 제목은 usable
        title = "이강인의 파리생제르맹 데뷔 골 하이라이트 모음"
        assert _is_usable_scraped_title(title) is True


# ─────────────────────────────────────────────────────────────
# _should_use_direct_summary
# ─────────────────────────────────────────────────────────────
class TestShouldUseDirectSummary:
    def test_short_content_few_chunks_uses_direct(self):
        short_text = "짧은 내용. " * 50  # ~350자
        chunks = ["chunk1", "chunk2"]  # <= DIRECT_SUMMARY_MAX_CHUNKS
        assert _should_use_direct_summary(short_text, chunks) is True

    def test_long_content_uses_chunk_path(self):
        long_text = "긴 내용입니다. " * 400  # > DIRECT_SUMMARY_CHAR_LIMIT
        chunks = ["chunk"] * 5
        assert _should_use_direct_summary(long_text, chunks) is False

    def test_many_chunks_uses_chunk_path(self):
        short_text = "짧은 내용. " * 50
        many_chunks = ["chunk"] * (DIRECT_SUMMARY_MAX_CHUNKS + 1)
        assert _should_use_direct_summary(short_text, many_chunks) is False

    def test_empty_content_returns_false(self):
        assert _should_use_direct_summary("", ["chunk"]) is False

    def test_boundary_char_limit(self):
        # 정확히 DIRECT_SUMMARY_CHAR_LIMIT 글자 → True (<=)
        boundary_text = "가" * DIRECT_SUMMARY_CHAR_LIMIT
        chunks = ["chunk1"]
        assert _should_use_direct_summary(boundary_text, chunks) is True


# ─────────────────────────────────────────────────────────────
# _is_youtube_url
# ─────────────────────────────────────────────────────────────
class TestIsYoutubeUrl:
    def test_youtube_com_detected(self):
        assert _is_youtube_url("https://www.youtube.com/watch?v=abc123") is True

    def test_youtu_be_detected(self):
        assert _is_youtube_url("https://youtu.be/abc123") is True

    def test_non_youtube_not_detected(self):
        assert _is_youtube_url("https://www.google.com") is False
        assert _is_youtube_url("https://naver.com/news") is False

    def test_none_returns_false(self):
        assert _is_youtube_url(None) is False

    def test_empty_string_returns_false(self):
        assert _is_youtube_url("") is False

    def test_youtube_in_path_not_domain(self):
        # 도메인이 아닌 경로에 youtube 가 들어가는 경우
        assert _is_youtube_url("https://example.com/youtube/video") is False


# ─────────────────────────────────────────────────────────────
# _sentence_count
# ─────────────────────────────────────────────────────────────
class TestSentenceCount:
    def test_three_sentences(self):
        text = "첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다."
        assert _sentence_count(text) == 3

    def test_single_sentence_no_period(self):
        assert _sentence_count("하나의 문장") == 1

    def test_empty_returns_zero(self):
        assert _sentence_count("") == 0

    def test_mixed_terminators(self):
        text = "정말? 그렇구나! 맞아."
        assert _sentence_count(text) == 3


# ─────────────────────────────────────────────────────────────
# _clean_generated_title
# ─────────────────────────────────────────────────────────────
class TestCleanGeneratedTitle:
    def test_normal_title_returned_as_is(self):
        result = _clean_generated_title("이강인 PSG 계약 연장 협상", "fallback")
        assert result == "이강인 PSG 계약 연장 협상"

    def test_strips_surrounding_quotes(self):
        result = _clean_generated_title('"이강인 PSG 계약 연장"', "fallback")
        assert result == "이강인 PSG 계약 연장"

    def test_too_short_uses_fallback(self):
        # 4자 미만이면 fallback 사용
        result = _clean_generated_title("짧", "fallback 제목입니다")
        assert result == "fallback 제목입니다"

    def test_empty_title_uses_fallback(self):
        result = _clean_generated_title("", "대체 제목")
        assert result == "대체 제목"

    def test_truncated_at_60_chars(self):
        long_title = "가" * 100
        result = _clean_generated_title(long_title, "fallback")
        assert len(result) <= 60

    def test_both_empty_returns_default(self):
        result = _clean_generated_title("", "")
        assert result == "요약 콘텐츠"
