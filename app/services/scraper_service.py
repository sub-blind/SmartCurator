import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import asyncio
from typing import Dict, Optional

class ScraperService:
    """웹 페이지 크롤링 서비스"""
    
    def __init__(self):
        self.session = requests.Session()
        # User-Agent 설정으로 차단 방지
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 SmartCurator/1.0'
        })
        self.timeout = 10  # 10초 타임아웃
    
    async def extract_content(self, url: str) -> Dict[str, str]:
        """URL에서 컨텐츠 추출"""
        try:
            # 비동기 처리를 위해 requests를 별도 스레드에서 실행
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: self.session.get(url, timeout=self.timeout)
            )
            response.raise_for_status()
            
            # HTML 파싱
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 제목 추출 (여러 방법 시도)
            title = self._extract_title(soup, url)
            # 본문 추출
            content = self._extract_main_content(soup)
            # 메타 설명 추출
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
        """제목 추출 (우선순위: og:title > title > h1)"""
        # Open Graph 제목
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"].strip()
        
        # HTML title 태그
        title_tag = soup.find("title")
        if title_tag:
            return title_tag.get_text().strip()
        
        # h1 태그
        h1_tag = soup.find("h1")
        if h1_tag:
            return h1_tag.get_text().strip()
        
        # 기본값
        return f"웹페이지 - {urlparse(url).netloc}"
    
    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """본문 내용 추출"""
        # 불필요한 태그 제거
        for tag in soup(["script", "style", "nav", "footer", "aside"]):
            tag.decompose()
        
        # article, main 태그 우선 확인
        main_content = soup.find("article") or soup.find("main")
        if main_content:
            return main_content.get_text(separator=" ", strip=True)
        
        # div class가 content, article, post 등을 포함하는 것 찾기
        content_divs = soup.find_all("div", class_=lambda x: x and any(
            keyword in x.lower() for keyword in ["content", "article", "post", "main"]
        ))
        
        if content_divs:
            return " ".join([div.get_text(separator=" ", strip=True) for div in content_divs])
        
        # 전체 body 텍스트 (최후 수단)
        body = soup.find("body")
        if body:
            return body.get_text(separator=" ", strip=True)[:5000]  # 5000자 제한
        
        return "내용을 추출할 수 없습니다."
    
    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        """메타 설명 추출"""
        # meta description
        meta_desc = soup.find("meta", attrs={"name": "description"}) or \
                   soup.find("meta", property="og:description")
        
        if meta_desc and meta_desc.get("content"):
            return meta_desc["content"].strip()
        
        return None
