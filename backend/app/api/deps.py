from datetime import datetime
from typing import Generator, Optional
from zoneinfo import ZoneInfo
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.schemas.auth import TokenPayload

# Make token optional so KEYCLOAK_DEV_MODE endpoints don't require the header
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=not settings.KEYCLOAK_DEV_MODE,
)


def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


def get_now() -> datetime:
    """Current Colombo time (naive), used for cutoffs. Tests override this to pin the clock."""
    return datetime.now(ZoneInfo("Asia/Colombo")).replace(tzinfo=None)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = db.query(User).filter(User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def require_dispatcher_or_admin(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2),
) -> User:
    """Allow only dispatchers and admins to mutate allocation data.

    When settings.KEYCLOAK_DEV_MODE is True (local / CI), the check is
    bypassed and a synthetic dispatcher identity is returned. Flip
    KEYCLOAK_DEV_MODE=False in .env when Keycloak goes live.
    """
    if settings.KEYCLOAK_DEV_MODE:
        # Return a lightweight stub — no DB hit needed
        stub = User()
        stub.id = 0
        stub.role = UserRole.DISPATCHER
        stub.is_active = True
        return stub

    # --- Production path ---
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate credentials")
    user = db.query(User).filter(User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if user.role not in (UserRole.DISPATCHER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dispatchers and admins can perform this action.",
        )
    return user
