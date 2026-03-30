from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, HttpUrl


class ContentCreate(BaseModel):
    title: str
    url: Optional[HttpUrl] = None
    raw_content: Optional[str] = None
    content_type: str = "url"
    is_public: bool = False


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    is_public: Optional[bool] = None


class ContentRead(BaseModel):
    id: int
    title: str
    url: Optional[str] = None
    content_type: str
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    processing_error: Optional[str] = None
    status: str
    is_public: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
