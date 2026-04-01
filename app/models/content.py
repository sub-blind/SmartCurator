from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Content(Base):
    """사용자 저장 콘텐츠 모델."""

    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String(500), nullable=False)
    url = Column(String(2000), nullable=True)
    thumbnail_url = Column(String(2000), nullable=True)
    raw_content = Column(Text, nullable=True)
    content_type = Column(String(50), default="url")

    summary = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    processing_error = Column(Text, nullable=True)

    status = Column(String(20), default="pending")
    is_public = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="contents")

    def __repr__(self):
        return f"<Content(id={self.id}, title={self.title[:50]})>"
