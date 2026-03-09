from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from dotenv import load_dotenv
from app.api.v1 import auth, content
from app.api.v1 import search, chat

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

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


# 인증(auth)과 컨텐츠(content) API 라우터 등록
app.include_router(auth.router)
app.include_router(content.router)
app.include_router(search.router)
app.include_router(chat.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
