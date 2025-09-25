from typing import List, Dict
from app.services.vector_service import vector_service
from app.services.ai_service import AIService
import logging

logger = logging.getLogger(__name__)

class RAGService:
    """RAG(Retrieval-Augmented Generation) 서비스"""
    
    def __init__(self):
        self.ai_service = AIService()
        self.max_context_length = 3000
    
    async def ask_question(self, question: str, user_id: int) -> Dict:
        """사용자 질문에 대한 RAG 기반 답변 생성"""
        try:
            # 1단계: 관련 컨텐츠 검색
            relevant_contents = await vector_service.search_similar_contents(
                query=question,
                user_id=user_id,
                limit=5,
                score_threshold=0.4
            )
            
            if not relevant_contents:
                return {
                    "answer": "죄송합니다. 질문과 관련된 저장된 내용을 찾을 수 없습니다. 더 많은 컨텐츠를 저장해보세요.",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # 2단계: 컨텍스트 구성
            context = self._build_context(relevant_contents)
            
            # 3단계: AI 답변 생성
            prompt = self._create_rag_prompt(question, context)
            ai_response = await self.ai_service.generate_response(prompt)
            
            if not ai_response.get("success"):
                return {
                    "answer": "답변 생성 중 오류가 발생했습니다.",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # 4단계: 응답 구성
            return {
                "answer": ai_response["response"],
                "sources": [
                    {
                        "content_id": content["content_id"],
                        "title": content["title"],
                        "similarity_score": content["similarity_score"]
                    }
                    for content in relevant_contents
                ],
                "confidence": self._calculate_confidence(relevant_contents)
            }
            
        except Exception as e:
            logger.error(f"RAG 질의응답 오류: {e}")
            return {
                "answer": "죄송합니다. 답변 생성 중 오류가 발생했습니다.",
                "sources": [],
                "confidence": 0.0
            }
    
    def _build_context(self, contents: List[Dict]) -> str:
        """검색된 컨텐츠로 컨텍스트 구성"""
        context_parts = []
        current_length = 0
        
        for content in contents:
            content_text = f"제목: {content['title']}\n요약: {content['summary']}\n태그: {', '.join(content['tags'])}\n"
            
            if current_length + len(content_text) > self.max_context_length:
                break
                
            context_parts.append(content_text)
            current_length += len(content_text)
        
        return "\n---\n".join(context_parts)
    
    def _create_rag_prompt(self, question: str, context: str) -> str:
        """RAG 프롬프트 생성"""
        return f"""당신은 사용자의 개인 지식 어시스턴트입니다. 아래 제공된 컨텍스트를 바탕으로 질문에 답변해주세요.

**컨텍스트:**
{context}

**질문:** {question}

**답변 가이드라인:**
1. 제공된 컨텍스트만을 사용하여 답변하세요
2. 컨텍스트에 없는 정보는 추측하지 마세요
3. 답변이 불확실하다면 솔직히 말하세요
4. 가능한 구체적이고 유용한 답변을 제공하세요
5. 한국어로 답변하세요

**답변:**"""
    
    def _calculate_confidence(self, contents: List[Dict]) -> float:
        """답변 신뢰도 계산"""
        if not contents:
            return 0.0
        
        avg_score = sum(content["similarity_score"] for content in contents) / len(contents)
        content_bonus = min(len(contents) * 0.1, 0.3)
        
        return min(avg_score + content_bonus, 1.0)

rag_service = RAGService()
