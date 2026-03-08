import re
from typing import Dict, List, Set
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
            
            # 1단계: 관련 chunk 검색
            relevant_chunks = await vector_service.search_similar_chunks(
                query=question,
                user_id=user_id,
                limit=12,
                score_threshold=0.30
            )
            relevant_chunks = self._rerank_chunks(question, relevant_chunks)[:8]
            
            logger.info(f"📚 검색된 chunk: {len(relevant_chunks)}개")
            
            if not relevant_chunks:
                logger.warning(f"⚠️ 관련 컨텐츠 없음: question='{question}'")
                return {
                    "answer": "죄송합니다. 질문과 관련된 저장된 내용을 찾을 수 없습니다. 더 많은 컨텐츠를 저장해보세요.",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # 2단계: 컨텍스트 구성
            context = self._build_context(relevant_chunks)
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
                        "content_id": chunk["content_id"],
                        "title": chunk["title"],
                        "chunk_index": chunk["chunk_index"],
                        "snippet": chunk["chunk_text"][:220],
                        "similarity_score": round(chunk["similarity_score"], 3)
                    }
                    for chunk in relevant_chunks[:5]
                ],
                "confidence": self._calculate_confidence(relevant_chunks)
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
    
    def _build_context(self, chunks: List[Dict]) -> str:
        """검색된 chunk로 컨텍스트 구성"""
        context_parts = []
        current_length = 0
        
        for i, chunk in enumerate(chunks, 1):
            content_text = f"""
[출처 {i}] {chunk['title']} (chunk {chunk['chunk_index']})
근거:
{chunk['chunk_text']}
관련도: {chunk['similarity_score']:.1%}
---"""
            
            if current_length + len(content_text) > self.max_context_length:
                break
                
            context_parts.append(content_text)
            current_length += len(content_text)
        
        return "\n".join(context_parts)

    def _rerank_chunks(self, question: str, chunks: List[Dict]) -> List[Dict]:
        """유사도 + 키워드 겹침으로 재정렬하고 content 다양성을 보장."""
        if not chunks:
            return []

        query_terms = self._tokenize(question)
        scored: List[Dict] = []
        for chunk in chunks:
            chunk_terms = self._tokenize(chunk.get("chunk_text", ""))
            overlap = len(query_terms & chunk_terms) / max(len(query_terms), 1)
            hybrid_score = (chunk.get("similarity_score", 0.0) * 0.8) + (overlap * 0.2)
            scored.append({**chunk, "_hybrid_score": hybrid_score})

        scored.sort(key=lambda row: row["_hybrid_score"], reverse=True)

        per_content_count: Dict[int, int] = {}
        diversified: List[Dict] = []
        for item in scored:
            content_id = item["content_id"]
            used = per_content_count.get(content_id, 0)
            if used >= 2:
                continue
            per_content_count[content_id] = used + 1
            diversified.append(item)

        for item in diversified:
            item.pop("_hybrid_score", None)
        return diversified

    def _tokenize(self, text: str) -> Set[str]:
        lowered = (text or "").lower()
        return {tok for tok in re.findall(r"[0-9a-zA-Z가-힣]{2,}", lowered)}
    
    def _calculate_confidence(self, contents: List[Dict]) -> float:
        """답변 신뢰도 계산"""
        if not contents:
            return 0.0
        
        avg_score = sum(content["similarity_score"] for content in contents) / len(contents)
        top_score_bonus = min(contents[0]["similarity_score"] * 0.2, 0.2)
        content_bonus = min(len(contents) * 0.05, 0.2)
        
        confidence = min(avg_score + content_bonus + top_score_bonus, 1.0)
        return round(confidence, 3)


rag_service = RAGService()
