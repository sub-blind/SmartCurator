from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import settings

# 비동기 엔진 생성
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # SQL 쿼리 로그 출력 (개발 시에만)
    future=True
)

# 비동기 세션 팩토리
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base 클래스 (모든 모델이 상속받을 기본 클래스)
Base = declarative_base()

# 데이터베이스 세션 의존성 함수
async def get_async_session() -> AsyncSession:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

# 데이터베이스 초기화 함수 (나중에 사용)
async def init_db():
    async with engine.begin() as conn:
        # 모든 테이블 생성 (개발용, 프로덕션에서는 Alembic 사용)
        await conn.run_sync(Base.metadata.create_all)
