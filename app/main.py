import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, chat, content, search
from app.core.config import settings
from app.core.database import init_db
from app.core.vector_config import vector_db

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SmartCurator API",
    description="AI-powered personal knowledge curation platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=settings.ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """서비스 시작 시 DB와 검색 컬렉션을 준비한다."""
    await init_db()
    try:
        await vector_db.setup_collection()
    except Exception as e:
        logger.warning("Qdrant 초기화 실패(부팅은 계속): %s", e)


@app.get("/")
async def root():
    return {
        "message": "SmartCurator is running!",
        "status": "healthy",
        "version": "0.1.0",
        "database": "connected" if settings.DATABASE_URL else "not configured",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "environment": getattr(settings, "ENV", getattr(settings, "ENVIRONMENT", "unknown")),
    }


app.include_router(auth.router)
app.include_router(content.router)
app.include_router(search.router)
app.include_router(chat.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
