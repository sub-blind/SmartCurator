from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from typing import AsyncGenerator
from app.core.config import settings


# 비동기 엔진 생성
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)


# 비동기 세션 팩토리 생성
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


# 베이스 클래스 (모델 클래스들이 상속할 기본 클래스)
Base = declarative_base()


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    직접 사용하는 async generator 세션 함수.
    - yield 구문으로 세션을 비동기 컨텍스트 내에서 제공.
    - FastAPI 의존성 주입 외, 직접 async for 등에서 사용할 경우 활용.
    """
    async with async_session_maker() as session:
        yield session


async def get_db_session() -> AsyncSession:
    """
    FastAPI 의존성 주입용 세션 함수.
    - FastAPI가 AsyncSession 객체를 직접 주입할 수 있도록 설계됨.
    - 엔드포인트에서 Depends(get_db_session) 형태로 사용.
    """
    async with async_session_maker() as session:
        return session


async def init_db():
    """
    데이터베이스 초기화 함수
    - 데이터베이스에 정의된 메타데이터 기반으로 테이블 생성
    - 개발 및 초기 배포 시 한 번 실행
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
