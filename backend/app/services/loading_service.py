import uuid
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from fastapi import HTTPException
from app.models.loading import LoadingTask
from app.services.mocks import get_order_service, get_notification_service


class LoadingService:

    async def get_tasks_by_vehicle(
        self, vehicle_id: str, task_date: date, db: Session
    ) -> list[dict]:
        """
        Build the loading list for a vehicle on a given date.
        1. Get orders for that date from OrderService (filtered by depot of the vehicle).
        2. Filter to orders assigned to this vehicle_id.
        3. For each order, get or auto-create a loading_task row.
        4. Return enriched list merging order info with task status.
        """
        order_svc = get_order_service()

        all_orders = await order_svc.get_orders_by_date(task_date, depot="Peliyagoda")
        vehicle_orders = [o for o in all_orders if o.get("vehicle_id") == vehicle_id]

        results = []
        for order in vehicle_orders:
            order_id = order["id"]

            # Get or create loading task
            result = db.execute(
                select(LoadingTask).where(LoadingTask.order_id == order_id)
            )
            task = result.scalar_one_or_none()

            if task is None:
                task = LoadingTask(order_id=order_id, vehicle_id=vehicle_id)
                db.add(task)
                db.flush()  # get the id without committing

            results.append({
                **order,
                "task_id": task.id,
                "task_status": task.status,
                "loaded_units": task.loaded_units,
            })

        db.commit()
        return sorted(results, key=lambda x: x.get("seq_in_route", 0))

    async def start_loading(
        self, task_id: uuid.UUID, loader_id: uuid.UUID, db: Session
    ) -> LoadingTask:
        task = await self._get_task(task_id, db)
        task.status = "in_progress"
        task.assigned_loader_id = loader_id
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)

        order_svc = get_order_service()
        await order_svc.update_order_status(task.order_id, "loading")

        return task

    async def update_item(
        self, task_id: uuid.UUID, loaded_units: int, db: Session
    ) -> LoadingTask:
        task = await self._get_task(task_id, db)
        task.loaded_units = loaded_units
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    async def flag_shortfall(
        self, task_id: uuid.UUID, notes: str, loaded_units: int, db: Session
    ) -> LoadingTask:
        task = await self._get_task(task_id, db)
        task.status = "shortfall_flagged"
        task.loaded_units = loaded_units
        task.shortfall_notes = notes
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)

        # Get outlet_id from orders table for notification
        try:
            result = db.execute(
                text("SELECT outlet_id FROM orders WHERE id = :oid"),
                {"oid": str(task.order_id)},
            )
            row = result.fetchone()
            outlet_id = row[0] if row else "UNKNOWN"
        except Exception:
            outlet_id = "UNKNOWN"

        notif_svc = get_notification_service()
        await notif_svc.send(
            outlet_id=outlet_id,
            type="shortfall_warning",
            title="Loading shortfall on your order",
            message=f"Your order could not be fully loaded. Notes: {notes}",
            order_id=task.order_id,
        )
        return task

    async def complete_loading(
        self, task_id: uuid.UUID, db: Session
    ) -> LoadingTask:
        task = await self._get_task(task_id, db)
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)

        order_svc = get_order_service()
        await order_svc.update_order_status(task.order_id, "in_transit")

        return task

    async def get_loading_status_by_order(
        self, order_id: uuid.UUID, db: Session
    ) -> str | None:
        result = db.execute(
            select(LoadingTask).where(LoadingTask.order_id == order_id)
        )
        task = result.scalar_one_or_none()
        return task.status if task else None

    async def _get_task(self, task_id: uuid.UUID, db: Session) -> LoadingTask:
        result = db.execute(
            select(LoadingTask).where(LoadingTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail="Loading task not found")
        return task
