import re


TOKEN_PATTERN = re.compile(r"[\uac00-\ud7a30-9A-Za-z]{2,}")


def tokenize_korean_text(text: str) -> set[str]:
    lowered = (text or "").lower()
    return {token for token in TOKEN_PATTERN.findall(lowered)}


def compute_token_overlap(query: str, text: str) -> float:
    query_terms = tokenize_korean_text(query)
    if not query_terms:
        return 0.0

    text_terms = tokenize_korean_text(text)
    if not text_terms:
        return 0.0

    return len(query_terms & text_terms) / len(query_terms)


def compute_hybrid_score(
    query: str,
    text: str,
    similarity_score: float,
    similarity_weight: float = 0.7,
    overlap_weight: float = 0.3,
) -> float:
    overlap = compute_token_overlap(query, text)
    return similarity_score * similarity_weight + overlap * overlap_weight
