import re


TOKEN_PATTERN = re.compile(r"[\u3131-\u318E\uAC00-\uD7A3A-Za-z0-9]{2,}")

NOISE_TEXT_PATTERNS = [
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"\ub274\uc2a4\s*\ub4e3\uae30", re.IGNORECASE),
    re.compile(r"\uae30\uc0ac\s*\uc6d0\ubb38", re.IGNORECASE),
    re.compile(r"url\s*\ubcf5\uc0ac", re.IGNORECASE),
    re.compile(r"\ud504\ub9b0\ud2b8|\uae00\uc790\s*\ud06c\uae30", re.IGNORECASE),
    re.compile(r"\uacf5\uc720\s*\ud558\uae30", re.IGNORECASE),
    re.compile(r"\ud398\uc774\uc2a4\ubd81|\uce74\uce74\uc624\ud1a1|\ubc34\ub4dc|\ud2b8\uc704\ud130", re.IGNORECASE),
]

QUERY_STOPWORDS = {
    "\uad00\ub828",
    "\ub274\uc2a4",
    "\uc694\uc57d",
    "\uc694\uc57d\uc880",
    "\uc694\uc57d\ud574\uc918",
    "\uc815\ub9ac",
    "\uc815\ub9ac\ud574\uc918",
    "\uae30\uc0ac",
    "\ub0b4\uc6a9",
    "\uc124\uba85",
    "\uc54c\ub824\uc918",
    "\ubd80\ud0c1",
    "\ubd80\ud0c1\ud574",
    "\ud574\uc918",
    "\uc880",
    "\ub300\ud55c",
}


def tokenize_korean_text(text: str) -> set[str]:
    lowered = (text or "").lower()
    return {token for token in TOKEN_PATTERN.findall(lowered)}


def extract_anchor_terms(text: str) -> list[str]:
    ordered_tokens = TOKEN_PATTERN.findall((text or "").lower())
    anchors: list[str] = []
    for token in ordered_tokens:
        if token in QUERY_STOPWORDS:
            continue
        if token not in anchors:
            anchors.append(token)
    return anchors[:4]


def contains_anchor_terms(text: str, anchors: list[str]) -> bool:
    if not anchors:
        return True
    lowered = (text or "").lower()
    return any(anchor in lowered for anchor in anchors)


def is_noisy_text(text: str) -> bool:
    cleaned = (text or "").strip()
    if not cleaned:
        return True
    lowered = cleaned.lower()
    return any(pattern.search(lowered) for pattern in NOISE_TEXT_PATTERNS)


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
