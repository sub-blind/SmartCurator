"""
test_text_chunking.py

text_chunking.py 의 순수 함수들을 단위 테스트한다.
"""

import pytest

from app.utils.text_chunking import normalize_text, split_into_chunks


# ─────────────────────────────────────────────────────────────
# normalize_text
# ─────────────────────────────────────────────────────────────
class TestNormalizeText:
    def test_empty_returns_empty(self):
        assert normalize_text("") == ""

    def test_strips_leading_trailing_whitespace(self):
        assert normalize_text("  텍스트  ") == "텍스트"

    def test_collapses_multiple_newlines(self):
        result = normalize_text("문단1\n\n\n\n문단2")
        assert result == "문단1\n\n문단2"

    def test_collapses_multiple_spaces(self):
        result = normalize_text("단어1   단어2")
        assert result == "단어1 단어2"

    def test_windows_line_endings_normalized(self):
        result = normalize_text("줄1\r\n줄2\r줄3")
        assert "\r" not in result
        assert "줄1" in result and "줄2" in result and "줄3" in result


# ─────────────────────────────────────────────────────────────
# split_into_chunks
# ─────────────────────────────────────────────────────────────
class TestSplitIntoChunks:
    def test_empty_text_returns_empty_list(self):
        assert split_into_chunks("") == []

    def test_short_text_becomes_single_chunk(self):
        text = "짧은 텍스트입니다."
        chunks = split_into_chunks(text, chunk_size=1100)
        assert len(chunks) == 1
        assert "짧은 텍스트입니다." in chunks[0]

    def test_long_text_split_into_multiple_chunks(self):
        # chunk_size=100 으로 설정해 강제로 여러 chunk 생성
        text = ("가나다라마바사아자차카타파하. " * 20).strip()
        chunks = split_into_chunks(text, chunk_size=100, overlap=0)
        assert len(chunks) > 1

    def test_all_content_preserved(self):
        # 모든 chunk 를 합쳤을 때 원본 핵심 단어가 남아있어야 한다
        text = "이강인\n\n손흥민\n\n황희찬\n\n김민재"
        chunks = split_into_chunks(text, chunk_size=1100)
        combined = " ".join(chunks)
        for name in ["이강인", "손흥민", "황희찬", "김민재"]:
            assert name in combined

    def test_chunk_size_respected(self):
        long_paragraph = "가" * 500  # 단일 문단 500자
        chunks = split_into_chunks(long_paragraph, chunk_size=200, overlap=0)
        for chunk in chunks:
            assert len(chunk) <= 200

    def test_overlap_adds_context_to_next_chunk(self):
        # overlap > 0 이면 앞 chunk 의 끝부분이 다음 chunk 앞에 붙는다
        text = ("문단A " * 30 + "\n\n" + "문단B " * 30).strip()
        chunks = split_into_chunks(text, chunk_size=100, overlap=30)
        if len(chunks) >= 2:
            # 두 번째 chunk 가 첫 번째 chunk 의 마지막 부분을 포함하는지 확인
            first_tail = chunks[0][-30:].strip()
            if first_tail:
                assert first_tail in chunks[1]

    def test_whitespace_only_returns_empty(self):
        assert split_into_chunks("   \n\n   ") == []
