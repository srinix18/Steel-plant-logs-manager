from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_ENV), str(_ROOT_ENV)),
        extra="ignore",
    )

    APP_NAME: str = "Logbook Management System"
    API_V1_PREFIX: str = "/api/v1"
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "logbook_db"
    JWT_SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    SEED_ADMIN_EMAIL: str = "admin@logbook.app"
    SEED_ADMIN_PASSWORD: str = "admin123"
    SEED_ADMIN_NAME: str = "System Admin"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
