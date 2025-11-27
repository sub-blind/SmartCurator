from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session
from app.core.config import settings
from app.models.user import User
from dotenv import load_dotenv
from app.api.v1 import auth, content
from app.api.v1 import search, chat

load_dotenv()

app = FastAPI(
    title="SmartCurator API",
    description="AI-powered personal knowledge curation platform",
    version="0.1.0"
)

allowed_origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """루트 헬스 체크 및 서버 상태 확인"""
    return {
        "message": "SmartCurator is running!",
        "status": "healthy",
        "version": "0.1.0",
        "database": "connected" if settings.DATABASE_URL else "not configured"
    }


@app.get("/health")
async def health_check():
    """서비스 헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "database": "connected",
        "environment": getattr(settings, "ENV", getattr(settings, "ENVIRONMENT", "unknown"))
    }


@app.get("/test-db")
async def test_database(session: AsyncSession = Depends(get_async_session)):
    """데이터베이스 연결 및 간단한 쿼리 테스트"""
    try:
        result = await session.execute("SELECT 1")
        db_status = "connected"
        user_count_result = await session.execute("SELECT COUNT(*) FROM users")
        user_count = user_count_result.scalar()
        return {
            "database_status": db_status,
            "test_query": "SUCCESS",
            "user_count": user_count,
            "tables": ["users", "contents"]
        }
    except Exception as e:
        return {
            "database_status": "error",
            "error": str(e)
        }


@app.post("/test-user")
async def create_test_user(session: AsyncSession = Depends(get_async_session)):
    """테스트용 유저 생성 (개발용)"""
    try:
        test_user = User(
            email="test@example.com",
            hashed_password="temporary_password",
            full_name="Test User",
            bio="This is a test user created on day 2"
        )
        session.add(test_user)
        await session.commit()
        await session.refresh(test_user)
        return {
            "message": "Test user created successfully",
            "user_id": test_user.id,
            "email": test_user.email,
            "created_at": test_user.created_at
        }
    except Exception as e:
        await session.rollback()
        return {
            "error": "Failed to create user",
            "details": str(e)
        }


# 인증(auth)과 컨텐츠(content) API 라우터 등록
app.include_router(auth.router)
app.include_router(content.router)
app.include_router(search.router)
app.include_router(chat.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


import logging

# 로깅 설정 (디버그 레벨, 시간, 이름, 수준, 메시지 출력)
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
