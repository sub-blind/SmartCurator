from fastapi import FastAPI
import os
from dotenv import load_dotenv

# 환경변수 로드
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
        "version": "0.1.0"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "not connected yet (will connect on day 2)",
        "environment": os.getenv("ENV", "development")
    }

@app.get("/test")
async def test_endpoint():
    return {
        "message": "Test endpoint working!",
        "day": "1",
        "next_step": "Database connection on day 2"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
