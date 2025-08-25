from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Content(Base):
    __tablename__ = "contents"
    
    # 기본 정보
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 컨텐츠 정보
    title = Column(String(500), nullable=False)
    url = Column(String(2000), nullable=True)  # URL이 있는 경우
    raw_content = Column(Text, nullable=True)  # 크롤링된 원본 텍스트
    content_type = Column(String(50), default="url")  # url, text, pdf 등
    
    # AI 처리 결과 (3일차에 활용)
    summary = Column(Text, nullable=True)  # GPT 요약
    tags = Column(JSON, nullable=True)  # 자동 생성된 태그들
    
    # 상태 정보
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    is_public = Column(Boolean, default=False)
    
    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정
    owner = relationship("User", back_populates="contents")
    
    def __repr__(self):
        return f"<Content(id={self.id}, title={self.title[:50]})>"
