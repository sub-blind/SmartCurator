from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    ENV: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str
    
    # Security (3일차에 사용할 예정)
    SECRET_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
