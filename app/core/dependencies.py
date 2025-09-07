from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db_session  # FastAPI용 세션 의존성 함수
from app.models.user import User
from app.core.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db_session)  # 인증용 데이터베이스 세션 주입
):
    """
    현재 요청의 액세스 토큰에서 사용자 정보를 파싱하고,
    유효성을 검증 후 DB에서 사용자 객체를 조회하여 반환.

    Args:
        token (str): Authorization 헤더의 Bearer 토큰 (자동 주입)
        session (AsyncSession): DB 비동기 세션 (의존성 주입)

    Raises:
        HTTPException: 토큰이 없거나, 유효하지 않거나, 사용자 조회 실패 시 401 오류 발생

    Returns:
        User: 인증된 사용자 모델 인스턴스
    """
    payload = decode_access_token(token)  # JWT 디코딩 및 검증
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user ID")

    # DB에서 사용자 조회
    result = await session.execute(select(User).where(User.id == int(user_id)))
    user = result.scalars().first()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user
