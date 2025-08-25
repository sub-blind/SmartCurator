from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    # 기본 정보
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # 상태 정보
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # 프로필 정보
    full_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    
    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계 설정 (Content 모델과 연결, 3일차에 완성 예정)
    # contents = relationship("Content", back_populates="owner")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"
