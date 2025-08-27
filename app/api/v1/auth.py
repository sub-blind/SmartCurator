from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import AuthService
from app.core.dependencies import get_current_user
from sqlalchemy.future import select
from app.models.user import User
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserRead)
async def register(user: UserCreate, session: AsyncSession = Depends(get_async_session)):
    existing_user = await session.execute(
        select(User).where(User.email == user.email)
    )
    if existing_user.scalars().first():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    auth_service = AuthService(session)
    new_user = await auth_service.register_user(user.email, user.password, user.full_name, user.bio)
    return new_user


@router.post("/login")
async def login(user: UserCreate, session: AsyncSession = Depends(get_async_session)):
    auth_service = AuthService(session)
    authenticated = await auth_service.authenticate_user(user.email, user.password)
    if not authenticated:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = auth_service.create_token_for_user(authenticated)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserRead)
async def read_me(current_user=Depends(get_current_user)):
    return current_user

@router.put("/profile", response_model=UserRead)
async def update_profile(update: UserUpdate, session: AsyncSession = Depends(get_async_session), current_user=Depends(get_current_user)):
    if update.full_name:
        current_user.full_name = update.full_name
    if update.bio:
        current_user.bio = update.bio
    if update.is_active is not None:
        current_user.is_active = update.is_active
    await session.commit()
    await session.refresh(current_user)
    return current_user
