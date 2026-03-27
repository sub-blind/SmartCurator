import asyncio
import re
from typing import Dict, Optional
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup
from youtube_transcript_api import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeTranscriptApi,
)


class ScraperService:
    """URL 본문 스크래핑 서비스."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 SmartCurator/1.0",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            }
        )
        self.timeout = 12

    async def extract_content(self, url: str) -> Dict[str, str]:
        """URL에서 본문 텍스트를 추출한다. 실패 시 reader fallback을 시도한다."""
        try:
            if self._is_youtube_url(url):
                return await self._extract_youtube_transcript(url)

            primary = await self._extract_via_html(url)
            if self._is_usable_text(primary.get("content", "")):
                return primary

            fallback = await self._extract_via_reader(url)
            if self._is_usable_text(fallback.get("content", "")):
                return fallback

            return {
                "error": "URL 본문 추출 실패: 접근 제한 또는 본문이 충분하지 않습니다.",
                "success": False,
            }
        except requests.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else None
            if status_code == 451:
                return {
                    "error": (
                        "해당 언론사/페이지는 정책 또는 지역 제한(451)으로 자동 수집이 차단되었습니다. "
                        "본문 텍스트 붙여넣기 또는 PDF/TXT 업로드를 이용해주세요."
                    ),
                    "success": False,
                }
            return {"error": f"HTTP 오류({status_code}): {e}", "success": False}
        except requests.RequestException as e:
            return {"error": f"네트워크 오류: {e}", "success": False}
        except Exception as e:
            return {"error": f"스크래핑 실패: {e}", "success": False}

    async def _extract_youtube_transcript(self, url: str) -> Dict[str, str]:
        """YouTube URL에서 자막을 추출한다."""
        video_id = self._extract_youtube_video_id(url)
        if not video_id:
            return {"error": "유튜브 URL에서 영상 ID를 찾을 수 없습니다.", "success": False}

        loop = asyncio.get_event_loop()
        try:
            transcript_items = await loop.run_in_executor(
                None,
                lambda: YouTubeTranscriptApi.get_transcript(video_id, languages=["ko", "en"]),
            )
        except NoTranscriptFound:
            return {
                "error": "해당 유튜브 영상에 사용 가능한 자막이 없습니다. 자막이 있는 영상으로 시도해주세요.",
                "success": False,
            }
        except TranscriptsDisabled:
            return {"error": "해당 유튜브 영상은 자막이 비활성화되어 있습니다.", "success": False}
        except VideoUnavailable:
            return {"error": "해당 유튜브 영상을 사용할 수 없습니다.", "success": False}
        except Exception as e:
            return {"error": f"유튜브 자막 추출 실패: {e}", "success": False}

        transcript_text = self._clean_youtube_transcript(transcript_items)
        if len(transcript_text) < 40:
            return {"error": "유튜브 자막 길이가 너무 짧아 요약하기 어렵습니다.", "success": False}

        title = await loop.run_in_executor(None, lambda: self._fetch_youtube_title(url, video_id))
        return {
            "title": title,
            "content": transcript_text,
            "description": "유튜브 자막 기반 추출",
            "url": url,
            "success": True,
        }

    async def _extract_via_html(self, url: str) -> Dict[str, str]:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.session.get(url, timeout=self.timeout),
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")
        title = self._extract_title(soup, url)
        content = self._extract_main_content(soup)
        description = self._extract_description(soup)

        return {
            "title": title,
            "content": content,
            "description": description,
            "url": url,
            "success": True,
        }

    async def _extract_via_reader(self, url: str) -> Dict[str, str]:
        """동적 페이지/차단 페이지 대비 텍스트 reader 경로 fallback."""
        reader_url = f"https://r.jina.ai/http://{url.lstrip('/').replace('https://', '').replace('http://', '')}"
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.session.get(reader_url, timeout=self.timeout + 6),
        )
        response.raise_for_status()

        raw_text = (response.text or "").strip()
        cleaned = self._clean_content(raw_text)

        title = self._extract_title_from_text(cleaned) or f"웹페이지 - {urlparse(url).netloc}"
        return {
            "title": title,
            "content": cleaned,
            "description": None,
            "url": url,
            "success": True,
        }

    def _extract_title(self, soup: BeautifulSoup, url: str) -> str:
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"].strip()

        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text().strip()

        h1_tag = soup.find("h1")
        if h1_tag:
            return h1_tag.get_text().strip()

        return f"웹페이지 - {urlparse(url).netloc}"

    def _extract_title_from_text(self, text: str) -> Optional[str]:
        if not text:
            return None
        first_line = text.splitlines()[0].strip()
        if 3 <= len(first_line) <= 120:
            return first_line
        return None

    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        for tag in soup(["script", "style", "nav", "footer", "aside", "form", "noscript"]):
            tag.decompose()

        main_content = soup.find("article") or soup.find("main")
        if main_content:
            return self._clean_content(main_content.get_text(separator=" ", strip=True))

        content_divs = soup.find_all(
            "div",
            class_=lambda x: x
            and any(
                keyword in x.lower()
                for keyword in ["content", "article", "post", "main", "story", "entry", "news"]
            ),
        )
        if content_divs:
            joined = " ".join(div.get_text(separator=" ", strip=True) for div in content_divs)
            return self._clean_content(joined)

        paragraphs = [p.get_text(separator=" ", strip=True) for p in soup.find_all("p")]
        paragraphs = [p for p in paragraphs if len(p) > 40]
        if paragraphs:
            return self._clean_content(" ".join(paragraphs))

        body = soup.find("body")
        if body:
            return self._clean_content(body.get_text(separator=" ", strip=True))

        return "내용을 추출할 수 없습니다."

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", property="og:description"
        )
        if meta_desc and meta_desc.get("content"):
            return meta_desc["content"].strip()
        return None

    def _is_usable_text(self, text: str) -> bool:
        normalized = " ".join((text or "").split()).strip().lower()
        if not normalized:
            return False
        if "내용을 추출할 수 없습니다" in normalized:
            return False
        if len(normalized) < 120:
            return False
        return True

    def _is_youtube_url(self, url: str) -> bool:
        try:
            host = (urlparse(url).netloc or "").lower()
            return "youtube.com" in host or "youtu.be" in host
        except Exception:
            return False

    def _extract_youtube_video_id(self, url: str) -> Optional[str]:
        try:
            parsed = urlparse(url)
            host = (parsed.netloc or "").lower()
            path = parsed.path or ""
            if "youtu.be" in host:
                video_id = path.strip("/").split("/")[0]
                return video_id or None

            if "youtube.com" in host:
                if path == "/watch":
                    query = parse_qs(parsed.query or "")
                    values = query.get("v", [])
                    return values[0] if values else None
                if path.startswith("/shorts/") or path.startswith("/embed/"):
                    parts = [p for p in path.split("/") if p]
                    return parts[1] if len(parts) >= 2 else None
        except Exception:
            return None
        return None

    def _fetch_youtube_title(self, url: str, video_id: str) -> str:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        try:
            response = self.session.get(oembed_url, timeout=self.timeout)
            if response.ok:
                payload = response.json() or {}
                title = (payload.get("title") or "").strip()
                if title:
                    return title
        except Exception:
            pass
        return f"YouTube 영상 {video_id}"

    def _clean_youtube_transcript(self, items: list[dict]) -> str:
        texts: list[str] = []
        for item in items:
            raw = str(item.get("text", "")).strip()
            if not raw:
                continue
            cleaned = re.sub(r"\[[^\]]+\]", " ", raw)
            cleaned = " ".join(cleaned.split())
            if cleaned:
                texts.append(cleaned)

        merged = " ".join(texts)
        return self._clean_content(merged)

    def _clean_content(self, text: str) -> str:
        if not text:
            return "내용을 추출할 수 없습니다."

        normalized = " ".join(text.split())
        noisy_keywords = [
            "쿠키",
            "광고",
            "구독",
            "로그인",
            "회원가입",
            "프린트",
            "URL복사",
        ]
        for keyword in noisy_keywords:
            normalized = normalized.replace(keyword, "")

        return normalized[:12000].strip() or "내용을 추출할 수 없습니다."
