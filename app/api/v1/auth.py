from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db_session
from app.core.dependencies import get_current_user
from app.core.security import decode_refresh_token
from app.models.user import User
from app.schemas.auth import RefreshTokenRequest, UserLogin, TokenResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
async def register(
    user: UserCreate,
    session: AsyncSession = Depends(get_db_session),
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

    access_token, refresh_token = auth_service.create_tokens_for_user(authenticated)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """리프레시 토큰으로 액세스/리프레시 토큰 재발급"""
    payload = decode_refresh_token(request.refresh_token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await session.execute(select(User).where(User.id == int(user_id)))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not available")

    auth_service = AuthService(session)
    access_token, refresh_token = auth_service.create_tokens_for_user(user)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.get("/me", response_model=UserRead)
async def read_me(
    current_user=Depends(get_current_user),
):
    """현재 인증된 사용자 정보 조회"""
    return current_user


@router.put("/profile", response_model=UserRead)
async def update_profile(
    update: UserUpdate,
    session: AsyncSession = Depends(get_db_session),
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


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
):
    """
    JWT 기반 로그아웃.
    서버는 토큰 상태를 보관하지 않으므로 클라이언트 측 토큰 삭제가 핵심이며,
    본 엔드포인트는 명시적 로그아웃 액션/감사용 훅으로 사용한다.
    """
    return {
        "message": "로그아웃되었습니다. 클라이언트 토큰을 삭제하세요.",
        "user_id": current_user.id,
    }
