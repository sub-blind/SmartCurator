import unittest

from app.utils.text_chunking import normalize_text, split_into_chunks


class TextChunkingTestCase(unittest.TestCase):
    def test_normalize_text_compacts_spaces_and_linebreaks(self):
        source = "A   B\r\n\r\n\r\nC\t\tD"
        normalized = normalize_text(source)
        self.assertEqual(normalized, "A B\n\nC D")

    def test_split_empty_text_returns_empty_list(self):
        self.assertEqual(split_into_chunks(""), [])

    def test_split_short_text_returns_single_chunk(self):
        text = "짧은 테스트 문장입니다."
        chunks = split_into_chunks(text, chunk_size=100, overlap=10)
        self.assertEqual(chunks, [text])

    def test_split_long_paragraph_produces_multiple_chunks(self):
        text = "가" * 260
        chunks = split_into_chunks(text, chunk_size=100, overlap=20)
        self.assertGreaterEqual(len(chunks), 3)
        self.assertTrue(all(len(chunk) > 0 for chunk in chunks))

    def test_overlap_keeps_previous_context_prefix(self):
        text = "첫번째 문단입니다.\n\n두번째 문단입니다.\n\n세번째 문단입니다."
        chunks = split_into_chunks(text, chunk_size=20, overlap=5)
        self.assertGreaterEqual(len(chunks), 2)
        previous_tail = chunks[0][-5:].strip()
        self.assertIn(previous_tail, chunks[1])


if __name__ == "__main__":
    unittest.main()
