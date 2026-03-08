import re
from typing import List


def normalize_text(text: str) -> str:
    """청킹 전 공백과 줄바꿈을 정리한다."""
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def split_into_chunks(text: str, chunk_size: int = 1100, overlap: int = 180) -> List[str]:
    """
    문단 우선 청킹.
    - 먼저 빈 줄 기준으로 문단을 나누고
    - 너무 긴 문단은 다시 문자 기준으로 분할
    - 인접 chunk 간 일부 문맥(overlap)을 유지한다.
    """
    normalized = normalize_text(text)
    if not normalized:
        return []

    paragraphs = [part.strip() for part in normalized.split("\n\n") if part.strip()]
    chunks: List[str] = []
    current = ""

    def flush_current() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            flush_current()
            start = 0
            while start < len(paragraph):
                end = start + chunk_size
                piece = paragraph[start:end].strip()
                if piece:
                    chunks.append(piece)
                if end >= len(paragraph):
                    break
                start = max(end - overlap, start + 1)
            continue

        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if len(candidate) <= chunk_size:
            current = candidate
            continue

        flush_current()
        current = paragraph

    flush_current()

    if overlap <= 0 or len(chunks) <= 1:
        return chunks

    stitched: List[str] = []
    for index, chunk in enumerate(chunks):
        if index == 0:
            stitched.append(chunk)
            continue
        prev_tail = chunks[index - 1][-overlap:].strip()
        stitched.append(f"{prev_tail}\n\n{chunk}".strip())
    return stitched

