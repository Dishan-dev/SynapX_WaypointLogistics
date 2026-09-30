import uuid
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.loading_service import LoadingService
from app.schemas.loading import (
    StartLoadingRequest,
    UpdateItemRequest,
    ShortfallRequest,
    LoadingTaskResponse,
)

router = APIRouter(prefix="/api/loading", tags=["loading"])
loading_service = LoadingService()


@router.get("/tasks")
async def get_loading_tasks(
    vehicle_id: str = Query(..., description="Vehicle ID, e.g. VEH001"),
    date: date = Query(..., description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    """Get the loading list for a vehicle on a given date."""
    return await loading_service.get_tasks_by_vehicle(vehicle_id, date, db)


@router.get("/tasks/{task_id}", response_model=LoadingTaskResponse)
async def get_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a single loading task by ID."""
    return await loading_service._get_task(task_id, db)


@router.patch("/tasks/{task_id}/start", response_model=LoadingTaskResponse)
async def start_loading(
    task_id: uuid.UUID,
    body: StartLoadingRequest,
    db: Session = Depends(get_db),
):
    """Mark a loading task as started. Updates order status to 'loading'."""
    return await loading_service.start_loading(task_id, body.loader_id, db)


@router.patch("/tasks/{task_id}/item", response_model=LoadingTaskResponse)
async def update_item(
    task_id: uuid.UUID,
    body: UpdateItemRequest,
    db: Session = Depends(get_db),
):
    """Update the count of units loaded so far."""
    return await loading_service.update_item(task_id, body.loaded_units, db)


@router.patch("/tasks/{task_id}/shortfall", response_model=LoadingTaskResponse)
async def flag_shortfall(
    task_id: uuid.UUID,
    body: ShortfallRequest,
    db: Session = Depends(get_db),
):
    """Flag a shortfall. Notifies the store manager and records notes."""
    return await loading_service.flag_shortfall(
        task_id, body.shortfall_notes, body.loaded_units, db
    )


@router.patch("/tasks/{task_id}/complete", response_model=LoadingTaskResponse)
async def complete_loading(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Mark loading as complete. Updates order status to 'in_transit'."""
    return await loading_service.complete_loading(task_id, db)
