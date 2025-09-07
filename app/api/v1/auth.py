from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db_session, get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserLogin, TokenResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
async def register(
    user: UserCreate,
    session: AsyncSession = Depends(get_async_session),
):
    """회원 가입 - 이메일 중복 체크 후 신규 사용자 등록"""
    result = await session.execute(select(User).where(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    auth_service = AuthService(session)
    new_user = await auth_service.register_user(
        email=user.email,
        password=user.password,
        full_name=user.full_name,
        bio=user.bio,
    )
    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(
    user: UserLogin,
    session: AsyncSession = Depends(get_db_session),
):
    """로그인 처리 및 JWT 토큰 발급"""
    auth_service = AuthService(session)
    authenticated = await auth_service.authenticate_user(user.email, user.password)
    if not authenticated:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = auth_service.create_token_for_user(authenticated)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserRead)
async def read_me(
    current_user=Depends(get_current_user),
):
    """현재 인증된 사용자 정보 조회"""
    return current_user


@router.put("/profile", response_model=UserRead)
async def update_profile(
    update: UserUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
):
    """로그인 사용자 프로필 업데이트"""
    if update.full_name is not None:
        current_user.full_name = update.full_name
    if update.bio is not None:
        current_user.bio = update.bio
    if update.is_active is not None:
        current_user.is_active = update.is_active

    await session.commit()
    await session.refresh(current_user)
    return current_user
