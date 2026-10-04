import pytest
from pydantic import ValidationError

from app.core.config import Settings


def deployment_settings(**overrides):
    values = {
        "ENVIRONMENT": "production",
        "DEBUG": False,
        "KEYCLOAK_URL": "https://identity.example.test",
        "KEYCLOAK_REALM": "example",
        "KEYCLOAK_CLIENT_ID": "backend",
        "KEYCLOAK_CLIENT_SECRET": "example-client-secret",
        "KEYCLOAK_AUDIENCE": "api",
        "KEYCLOAK_DEV_MODE": False,
        "SECRET_KEY": "a-unique-signing-key-with-more-than-32-characters",
        "BACKEND_CORS_ORIGINS": ["https://frontend.example.test"],
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_rejects_authentication_bypass():
    with pytest.raises(ValidationError, match="KEYCLOAK_DEV_MODE"):
        deployment_settings(KEYCLOAK_DEV_MODE=True)


def test_production_rejects_missing_signing_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        deployment_settings(SECRET_KEY="")


def test_production_accepts_explicit_secure_auth_settings():
    settings = deployment_settings()
    assert settings.KEYCLOAK_DEV_MODE is False
