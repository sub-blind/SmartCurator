from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_async_session
from app.core.config import settings
from app.models.user import User
from dotenv import load_dotenv
from app.api.v1 import auth
from app.api.v1 import content

load_dotenv()

app = FastAPI(
    title="SmartCurator API",
    description="AI-powered personal knowledge curation platform",
    version="0.1.0"
)

@app.get("/")
async def root():
    return {
        "message": "SmartCurator is running!",
        "status": "healthy",
        "version": "0.1.0",
        "database": "connected" if settings.DATABASE_URL else "not configured"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "environment": getattr(settings, "ENV", getattr(settings, "ENVIRONMENT", "unknown"))  # 환경 변수명 호환성
    }

@app.get("/test-db")
async def test_database(session: AsyncSession = Depends(get_async_session)):
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

# 인증/컨텐츠 라우터 등록 (최종 추가)
app.include_router(auth.router)
app.include_router(content.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)