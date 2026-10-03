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
    token: Optional[str] = Depends(reusable_oauth2),
) -> User:
    if not token:
        if settings.KEYCLOAK_DEV_MODE:
            user = db.query(User).filter(User.is_active == True).first()  # noqa: E712
            if user:
                return user
            stub = User()
            stub.id = 0
            stub.email = "dev@waypoint.com"
            stub.full_name = "Dev User"
            stub.role = UserRole.DISPATCHER
            stub.is_active = True
            return stub
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = None
    # 1. Try decoding with symmetric secret (internal FastAPI JWTs)
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        pass

    # 2. Try decoding Keycloak / OIDC JWT
    if not payload:
        try:
            unverified = jwt.get_unverified_claims(token)
            if "realm_access" in unverified or "iss" in unverified or "preferred_username" in unverified:
                payload = unverified
        except Exception:
            pass

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )

    sub = str(payload.get("sub"))
    email = payload.get("email") or payload.get("preferred_username")

    user = None
    try:
        user_id = int(sub)
        user = db.query(User).filter(User.id == user_id).first()
    except (ValueError, TypeError):
        pass

    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    # If user not found in local DB and token is from Keycloak, automatically provision
    if not user and ("realm_access" in payload or "preferred_username" in payload):
        roles = payload.get("realm_access", {}).get("roles", [])
        mapped_role = UserRole.DISPATCHER
        if "admin" in roles:
            mapped_role = UserRole.ADMIN
        elif "dispatcher" in roles:
            mapped_role = UserRole.DISPATCHER
        elif "driver" in roles:
            mapped_role = UserRole.DRIVER
        elif "store_manager" in roles or "warehouse_manager" in roles:
            mapped_role = UserRole.WAREHOUSE_MANAGER

        user = User(
            email=email or f"kc-{sub}@waypoint.synapx.lk",
            full_name=payload.get("name") or payload.get("preferred_username") or "Keycloak Operator",
            hashed_password="KEYCLOAK_MANAGED_USER",
            role=mapped_role,
            is_active=True,
        )
        try:
            db.add(user)
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(User).filter(User.email == user.email).first()

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

    When settings.KEYCLOAK_DEV_MODE is True and no token is passed,
    a synthetic dispatcher identity is returned.
    """
    if settings.KEYCLOAK_DEV_MODE and not token:
        stub = User()
        stub.id = 0
        stub.role = UserRole.DISPATCHER
        stub.is_active = True
        return stub

    user = get_current_user(db=db, token=token)
    if user.role not in (UserRole.DISPATCHER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only dispatchers and admins can perform this action.",
        )
    return user


def require_driver(current_user: User = Depends(get_current_user)) -> User:
    from app.models.user import UserRole
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver access only"
        )
    return current_user
