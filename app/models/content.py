from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Content(Base):
    """사용자 컨텐츠 모델 - URL, 텍스트, 파일 등을 저장"""
    __tablename__ = "contents"

    # 기본 식별자
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 컨텐츠 기본 정보
    title = Column(String(500), nullable=False)              # 제목
    url = Column(String(2000), nullable=True)                # 원본 URL (있는 경우)
    raw_content = Column(Text, nullable=True)                # 원본 텍스트 내용
    content_type = Column(String(50), default="url")         # url, text, pdf 등
    
    # AI 처리 결과 저장
    summary = Column(Text, nullable=True)                    # GPT 요약 결과
    tags = Column(JSON, nullable=True)                       # 자동 생성된 태그 배열
    
    # 상태 관리
    status = Column(String(20), default="pending")           # pending, processing, completed, failed
    is_public = Column(Boolean, default=False)               # 공개 여부
    
    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # User 모델과의 관계 설정 (N:1)
    owner = relationship("User", back_populates="contents")

    def __repr__(self):
        return f"<Content(id={self.id}, title={self.title[:50]})>"
