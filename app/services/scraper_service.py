import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import asyncio
from typing import Dict, Optional


class ScraperService:
    """웹 페이지 크롤링 서비스

    requests 라이브러리를 기반으로 하며, 비동기 환경에서 작동하도록
    별도의 스레드에서 동기 HTTP 요청을 실행함.
    """

    def __init__(self):
        # requests 세션 생성 및 User-Agent 헤더 설정 (차단 방지 목적)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 SmartCurator/1.0'
        })
        self.timeout = 10  # 요청 타임아웃 10초 지정

    async def extract_content(self, url: str) -> Dict[str, str]:
        """
        주어진 URL에서 웹페이지 내용을 추출하여 반환.

        비동기 함수지만 내부적으로 requests의 동기 get() 함수를 별도 스레드에서 실행.

        Returns:
            성공 시 dict: title, content, description, url, success=True 포함
            실패 시 dict: error 메시지, success=False 포함
        """
        try:
            # 이벤트 루프에서 별도 스레드로 requests.get 호출
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.session.get(url, timeout=self.timeout)
            )
            response.raise_for_status()

            # HTML 파싱
            soup = BeautifulSoup(response.content, 'html.parser')

            # 제목, 본문, 메타 설명 추출
            title = self._extract_title(soup, url)
            content = self._extract_main_content(soup)
            description = self._extract_description(soup)

            return {
                "title": title,
                "content": content,
                "description": description,
                "url": url,
                "success": True
            }

        except requests.RequestException as e:
            return {
                "error": f"네트워크 오류: {str(e)}",
                "success": False
            }
        except Exception as e:
            return {
                "error": f"크롤링 실패: {str(e)}",
                "success": False
            }

    def _extract_title(self, soup: BeautifulSoup, url: str) -> str:
        """
        제목 추출 - 우선순위: og:title > <title> > <h1>

        Args:
            soup (BeautifulSoup): 파싱된 HTML 객체
            url (str): 크롤링한 URL (기본 제목 생성용)

        Returns:
            str: 추출된 제목 또는 기본 제목 문자열
        """
        # Open Graph 메타태그 제목
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"].strip()

        # <title> 태그
        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text().strip()

        # <h1> 태그
        h1_tag = soup.find("h1")
        if h1_tag:
            return h1_tag.get_text().strip()

        # 기본값: URL 도메인명 포함 문자열
        return f"웹페이지 - {urlparse(url).netloc}"

    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """
        웹페이지의 주요 본문 텍스트 추출.

        자바스크립트, 스타일, 네비게이션, 푸터 등 불필요한 태그 제거 후,
        <article>, <main> 태그 우선 추출하고, 특정 클래스명 포함 div로도 시도.
        최후에 <body> 텍스트 일부 반환.

        Args:
            soup (BeautifulSoup): 파싱된 HTML 객체

        Returns:
            str: 추출된 텍스트 본문 (최대 5000자 제한)
        """
        # 불필요 태그 제거
        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()

        # <article> 또는 <main> 태그 우선 탐색
        main_content = soup.find("article") or soup.find("main")
        if main_content:
            return main_content.get_text(separator=" ", strip=True)

        # 특정 클래스명을 포함하는 div 탐색 (content, article, post, main)
        content_divs = soup.find_all(
            "div",
            class_=lambda x: x and any(
                keyword in x.lower() for keyword in ["content", "article", "post", "main"]
            )
        )
        if content_divs:
            return " ".join(div.get_text(separator=" ", strip=True) for div in content_divs)

        # <body> 텍스트 반환 (최대 5000자)
        body = soup.find("body")
        if body:
            return body.get_text(separator=" ", strip=True)[:5000]

        return "내용을 추출할 수 없습니다."

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        """
        메타 설명(description) 태그 추출.

        Args:
            soup (BeautifulSoup): 파싱된 HTML 객체

        Returns:
            Optional[str]: 메타 설명 내용 또는 None
        """
        meta_desc = (
            soup.find("meta", attrs={"name": "description"}) or
            soup.find("meta", property="og:description")
        )

        if meta_desc and meta_desc.get("content"):
            return meta_desc["content"].strip()

        return None
