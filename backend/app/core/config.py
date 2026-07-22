from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_ENV), str(_ROOT_ENV)),
        extra="ignore",
    )

    APP_NAME: str = "Manufacturing Operations Intelligence Platform"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/moi_platform"
    JWT_SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://localhost:3000,"
        "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081"
    )
    SEED_ADMIN_EMAIL: str = "admin@logbook.app"
    SEED_ADMIN_PASSWORD: str = "admin123"
    SEED_ADMIN_NAME: str = "System Admin"
    UPLOAD_DIR: str = "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        # Native Expo/RN does not use CORS; "*" is for local Expo-web / mixed-origin debugging only.
        if origins == ["*"]:
            return ["*"]
        return origins


settings = Settings()
