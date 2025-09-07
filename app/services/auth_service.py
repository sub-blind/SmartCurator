from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def register_user(
        self,
        email: str,
        password: str,
        full_name: str = None,
        bio: str = None
    ) -> User:
        """새 사용자 등록"""
        hashed_pw = get_password_hash(password)
        new_user = User(
            email=email,
            hashed_password=hashed_pw,
            full_name=full_name,
            bio=bio
        )
        self.session.add(new_user)
        await self.session.commit()
        await self.session.refresh(new_user)
        return new_user

    async def authenticate_user(
        self,
        email: str,
        password: str
    ) -> User | None:
        """사용자 인증 - 이메일과 비밀번호 검사"""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalars().first()
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

    def create_token_for_user(self, user: User) -> str:
        """JWT 액세스 토큰 생성"""
        token_data = {"sub": str(user.id), "email": user.email}
        return create_access_token(token_data)
