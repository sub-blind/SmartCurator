from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime

class ContentCreate(BaseModel):
    """컨텐츠 생성 스키마"""
    title: str
    url: Optional[HttpUrl] = None                # URL 형식 검증
    raw_content: Optional[str] = None            # 직접 입력 텍스트
    content_type: str = "url"                    # url, text, pdf
    is_public: bool = False

class ContentUpdate(BaseModel):
    """컨텐츠 수정 스키마"""
    title: Optional[str] = None
    is_public: Optional[bool] = None

class ContentRead(BaseModel):
    """컨텐츠 응답 스키마"""
    id: int
    title: str
    url: Optional[str] = None
    content_type: str
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    status: str
    is_public: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
