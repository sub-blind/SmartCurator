from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    title = Column(String(500), nullable=False)
    url = Column(String(2000), nullable=True)
    raw_content = Column(Text, nullable=True)
    content_type = Column(String(50), default="url")  # url, text, pdf 등
    
    summary = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    
    status = Column(String(20), default="pending")
    is_public = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # User 모델과 1:N 반대 관계 설정 (back_populates 이름 꼭 맞춰야 함)
    owner = relationship("User", back_populates="contents")

    def __repr__(self):
        return f"<Content(id={self.id}, title={self.title[:50]})>"
