import logging
import asyncio
import json
from typing import Dict, List
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIService:
    """OpenAI GPT를 활용한 AI 서비스"""
    
    def __init__(self):
        # OpenAI 클라이언트 초기화 (새로운 방식)
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        except ImportError:
            # 구버전 openai 패키지 대응
            import openai
            openai.api_key = settings.OPENAI_API_KEY
            self.client = None
            
        # 모델명 설정
        self.model_name = getattr(settings, "OPENAI_MODEL", "gpt-3.5-turbo")
        
    async def summarize_content(self, content: str, title: str = "", url: str = "") -> Dict:
        """컨텐츠 요약 및 태그 생성"""
        
        # 토큰 제한을 위한 내용 잘라내기
        content_truncated = content[:4000] if len(content) > 4000 else content
        
        # 프롬프트 생성
        prompt = self._create_summary_prompt(title, content_truncated, url)
        
        try:
            if self.client:
                # 새로운 OpenAI 클라이언트 사용
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {
                            "role": "system", 
                            "content": "당신은 전문적인 콘텐츠 큐레이터입니다. 주어진 내용을 정확하고 간결하게 요약하며, 관련 키워드를 추출합니다."
                        },
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    max_tokens=600,
                    temperature=0.3,
                )
            else:
                # 구버전 openai 패키지 대응
                import openai
                response = await openai.ChatCompletion.acreate(
                    model=self.model_name,
                    messages=[
                        {
                            "role": "system", 
                            "content": "당신은 전문적인 콘텐츠 큐레이터입니다. 주어진 내용을 정확하고 간결하게 요약하며, 관련 키워드를 추출합니다."
                        },
                        {
                            "role": "user", 
                            "content": prompt
                        }
                    ],
                    max_tokens=600,
                    temperature=0.3,
                )
            
            # 응답 파싱
            ai_response = response.choices[0].message.content
            parsed_result = self._parse_ai_response(ai_response)
            
            return {
                "summary": parsed_result["summary"],
                "tags": parsed_result["tags"],
                "success": True,
                "token_used": response.usage.total_tokens
            }
            
        except Exception as e:
            logger.error(f"AI 요약 실패: {e}")
            return {
                "error": f"AI 요약 실패: {str(e)}",
                "success": False
            }
    
    async def generate_response(self, prompt: str) -> Dict:
        """
        RAG 시스템용 텍스트 생성
        주어진 프롬프트로 OpenAI GPT 모델 응답 생성
        """
        try:
            if self.client:
                # 새로운 OpenAI 클라이언트 사용
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": "당신은 도움이 되는 개인 지식 어시스턴트입니다."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1000,
                    temperature=0.7
                )
            else:
                # 구버전 openai 패키지 대응
                import openai
                response = await openai.ChatCompletion.acreate(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": "당신은 도움이 되는 개인 지식 어시스턴트입니다."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1000,
                    temperature=0.7
                )
            
            return {
                "success": True,
                "response": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            }
            
        except Exception as e:
            logger.error(f"AI 응답 생성 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _create_summary_prompt(self, title: str, content: str, url: str) -> str:
        """요약 프롬프트 생성"""
        return f"""
다음 웹 컨텐츠를 분석하여 한국어로 요약하고 태그를 생성해주세요.

제목: {title}
URL: {url}
내용:
{content}

요청사항:
1. 핵심 내용을 3-4문장으로 간결하게 요약
2. 관련 키워드/태그 5개 이하 추출 (한국어)
3. 아래 형식으로 응답:

요약: [여기에 요약 내용]
태그: [태그1, 태그2, 태그3, 태그4, 태그5]

주의사항:
- 정확한 정보만 포함
- 광고성 내용 제외
- 객관적 관점 유지
"""
    
    def _parse_ai_response(self, response: str) -> Dict:
        """AI 응답을 파싱하여 요약과 태그 분리"""
        try:
            lines = response.strip().split('\n')
            summary = ""
            tags = []
            
            for line in lines:
                line = line.strip()
                if line.startswith('요약:'):
                    summary = line.replace('요약:', '').strip()
                elif line.startswith('태그:'):
                    tag_text = line.replace('태그:', '').strip()
                    # 태그 파싱: "[태그1, 태그2]" 또는 "태그1, 태그2" 형식 처리
                    tag_text = tag_text.strip('[]')
                    tags = [tag.strip() for tag in tag_text.split(',') if tag.strip()]
            
            return {
                "summary": summary if summary else "요약을 생성할 수 없습니다.",
                "tags": tags[:5]  # 최대 5개 태그만
            }
            
        except Exception:
            # 파싱 실패시 전체 응답을 요약으로 사용
            return {
                "summary": response[:500] if len(response) > 500 else response,
                "tags": []
            }

    async def generate_tags_only(self, title: str, summary: str) -> List[str]:
        """요약된 내용으로부터 태그만 생성"""
        prompt = f"""
제목: {title}
요약: {summary}

위 내용과 관련된 한국어 키워드 5개를 생성해주세요.
형식: 키워드1, 키워드2, 키워드3, 키워드4, 키워드5
"""
        
        try:
            if self.client:
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=100,
                    temperature=0.3
                )
            else:
                import openai
                response = await openai.ChatCompletion.acreate(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=100,
                    temperature=0.3
                )
            
            tags_text = response.choices[0].message.content.strip()
            tags = [tag.strip() for tag in tags_text.split(',')]
            return tags[:5]
            
        except Exception as e:
            logger.error(f"태그 생성 실패: {e}")
            return ["일반"]
