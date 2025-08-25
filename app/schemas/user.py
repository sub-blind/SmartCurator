from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# 기본 사용자 스키마
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    bio: Optional[str] = None

# 회원가입용 스키마
class UserCreate(UserBase):
    password: str

# 사용자 정보 업데이트용 스키마
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    is_active: Optional[bool] = None

# API 응답용 스키마
class UserRead(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# 내부적으로 사용할 스키마 (비밀번호 해시 포함)
class UserInDB(UserRead):
    hashed_password: str
