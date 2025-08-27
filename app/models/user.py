from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    full_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Content 모델과 1:N 관계 설정 - 반드시 back_populates 이름 맞추기
    contents = relationship("Content", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"
