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
            logger.info(f"🤔 RAG 질문: '{question}' (user_id={user_id})")
            
            # 1단계: 관련 컨텐츠 검색
            relevant_contents = await vector_service.search_similar_contents(
                query=question,
                user_id=user_id,
                limit=5,
                score_threshold=0.3
            )
            
            logger.info(f"📚 검색된 컨텐츠: {len(relevant_contents)}개")
            
            if not relevant_contents:
                logger.warning(f"⚠️ 관련 컨텐츠 없음: question='{question}'")
                return {
                    "answer": "죄송합니다. 질문과 관련된 저장된 내용을 찾을 수 없습니다. 더 많은 컨텐츠를 저장해보세요.",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # 2단계: 컨텍스트 구성
            context = self._build_context(relevant_contents)
            logger.info(f"📄 컨텍스트 길이: {len(context)} chars")
            
            # 3단계: AI 답변 생성 (질답용)
            logger.info(f"🤖 OpenAI 질답 호출...")
            ai_response = await self.ai_service.answer_question(
                question=question,
                context=context
            )
            
            if not ai_response.get("success"):
                logger.error(f"❌ AI 답변 생성 실패: {ai_response.get('error')}")
                return {
                    "answer": "답변 생성 중 오류가 발생했습니다.",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # 4단계: 응답 구성
            response = {
                "answer": ai_response.get("answer", "답변을 생성할 수 없습니다."),
                "sources": [
                    {
                        "content_id": content["content_id"],
                        "title": content["title"],
                        "similarity_score": round(content["similarity_score"], 3)
                    }
                    for content in relevant_contents
                ],
                "confidence": self._calculate_confidence(relevant_contents)
            }
            
            logger.info(f"✅ RAG 답변 생성 완료 (신뢰도: {response['confidence']:.2f})")
            return response
            
        except Exception as e:
            logger.error(f"❌ RAG 질의응답 오류: {e}", exc_info=True)
            return {
                "answer": "죄송합니다. 답변 생성 중 오류가 발생했습니다.",
                "sources": [],
                "confidence": 0.0
            }
    
    def _build_context(self, contents: List[Dict]) -> str:
        """검색된 컨텐츠로 컨텍스트 구성"""
        context_parts = []
        current_length = 0
        
        for i, content in enumerate(contents, 1):
            content_text = f"""
[출처 {i}] {content['title']}
요약: {content['summary']}
관련도: {content['similarity_score']:.1%}
---"""
            
            if current_length + len(content_text) > self.max_context_length:
                break
                
            context_parts.append(content_text)
            current_length += len(content_text)
        
        return "\n".join(context_parts)
    
    def _calculate_confidence(self, contents: List[Dict]) -> float:
        """답변 신뢰도 계산"""
        if not contents:
            return 0.0
        
        avg_score = sum(content["similarity_score"] for content in contents) / len(contents)
        content_bonus = min(len(contents) * 0.1, 0.3)
        
        confidence = min(avg_score + content_bonus, 1.0)
        return round(confidence, 3)


rag_service = RAGService()
