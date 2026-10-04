import os
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Waypoint Logistics API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/waypoint_logistics"
    DATABASE_URL_UNPOOLED: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_NAME: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_SSLMODE: Optional[str] = None

    @field_validator("DATABASE_URL", "DATABASE_URL_UNPOOLED", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str) and v.strip():
            # Check which driver is available: psycopg (v3) or psycopg2 (v2)
            try:
                import psycopg  # noqa: F401
                preferred = "postgresql+psycopg://"
            except ImportError:
                preferred = "postgresql+psycopg2://"

            if v.startswith("postgresql+psycopg://") and preferred == "postgresql+psycopg2://":
                return v.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
            if v.startswith("postgresql+psycopg2://"):
                return v
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", preferred, 1)
            if v.startswith("postgres://"):
                return v.replace("postgres://", preferred, 1)
        return v

    # Keycloak Configuration
    KEYCLOAK_URL: str = ""
    KEYCLOAK_REALM: str = ""
    KEYCLOAK_CLIENT_ID: str = ""
    KEYCLOAK_CLIENT_SECRET: str = ""
    KEYCLOAK_ALGORITHM: str = "RS256"
    KEYCLOAK_AUDIENCE: str = ""
    KEYCLOAK_DEV_MODE: bool = False  # Explicit opt-in for local development only

    # Temporary operational scope while Keycloak depot claims are being wired.
    # Requests without an explicit depot scope stay in Peliyagoda, never a
    # combined cross-depot view.
    DISPATCHER_DEFAULT_DEPOT: str = "peliyagoda"

    # Allocation policy. Counts are calculated from allocations, never from the
    # denormalized `vehicles.trips_today` presentation field.
    ALLOCATION_MAX_TRIPS_PER_DAY: int = 2
    SERVICE_ALLOWANCE_CSV: str = "app/reference_data/service_allowance.csv"
    DISTRICT_TRAVEL_CSV: str = "app/reference_data/district_travel.csv"

    # Loader module
    # Mounts /loader/dev/* which simulates dispatcher actions while there is no
    # dispatcher UI. Never mounted when ENVIRONMENT == "production".
    LOADER_DEV_ENDPOINTS: bool = True

    # JWT / Fallback Secret for Dev and Testing
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @model_validator(mode="after")
    def validate_deployment_security(self):
        if self.ENVIRONMENT.lower() != "production" and os.getenv("VERCEL_ENV") not in {"production", "preview"}:
            return self
        if self.KEYCLOAK_DEV_MODE:
            raise ValueError("KEYCLOAK_DEV_MODE must be false in a deployment")
        if not self.KEYCLOAK_URL.startswith("https://"):
            raise ValueError("KEYCLOAK_URL must be an HTTPS URL in a deployment")
        for name in ("KEYCLOAK_REALM", "KEYCLOAK_CLIENT_ID", "KEYCLOAK_AUDIENCE"):
            if not getattr(self, name).strip():
                raise ValueError(f"{name} must be configured in a deployment")
        if not self.KEYCLOAK_CLIENT_SECRET or self.KEYCLOAK_CLIENT_SECRET.lower().startswith(("your_", "change-")):
            raise ValueError("KEYCLOAK_CLIENT_SECRET must be configured in a deployment")
        if len(self.SECRET_KEY) < 32 or self.SECRET_KEY.lower().startswith(("your_", "change-")):
            raise ValueError("SECRET_KEY must be a unique value of at least 32 characters in a deployment")
        if not self.BACKEND_CORS_ORIGINS or any(not origin.startswith("https://") for origin in self.BACKEND_CORS_ORIGINS):
            raise ValueError("BACKEND_CORS_ORIGINS must contain only HTTPS frontend origins in a deployment")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
