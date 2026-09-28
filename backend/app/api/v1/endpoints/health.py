from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["Health"])
def health_check(db: Session = Depends(deps.get_db)):
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unavailable: {str(e)}"

    return {
        "status": "healthy" if "unavailable" not in db_status else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }
