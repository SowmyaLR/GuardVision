from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://CHANGE_ME:CHANGE_ME@localhost/guardvision"
    REDIS_URL: str = "redis://localhost:6379"
    UPLOAD_DIR: str = "/data/uploads"
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    class Config:
        env_file = ".env"

settings = Settings()
