from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, select
from fastapi import HTTPException
from app.models.delivery_issue import DeliveryIssue
from app.schemas.delivery_issue import DeliveryIssueCreate, DeliveryIssueUpdate

INITIAL_SEED_ISSUES = [
    {
        "order_number": "ORD0000001",
        "outlet_id": 5,
        "issue_type": "Damaged Goods",
        "title": "Crushed Packaging on Paper Cups",
        "affected_item": "Paper Cups 8oz (500ct)",
        "sku": "SKU-032",
        "expected_units": 5,
        "received_units": 5,
        "description": "Two boxes of paper cups were damaged during transit with crushed outer cartons and broken inner sleeves.",
        "photo_url": "/images/damaged_cups_evidence.jpg",
        "photo_name": "damaged_paper_cups.jpg",
        "photo_size": "2.4 MB • Captured today",
        "reported_by": "Sarah Jenkins (Store Manager)",
        "status": "under_review",
        "driver_name": "Marcus Vance",
        "vehicle_id": "VEH001",
        "claimed_amount": "LKR 4,200.00",
    },
    {
        "order_number": "ORD0000006",
        "outlet_id": 5,
        "issue_type": "Missing Items",
        "title": "2 Cases Short Delivery",
        "affected_item": "Soft Drinks 1L (12pk)",
        "sku": "SKU-014",
        "expected_units": 8,
        "received_units": 6,
        "description": "Vehicle manifest indicated 8 cases loaded, but dock count only identified 6 intact cases. Loader shortage at depot.",
        "photo_url": "/images/missing_items_manifest.jpg",
        "photo_name": "shortage_manifest_dock.jpg",
        "photo_size": "1.8 MB • Captured 19 Sep",
        "reported_by": "Sarah Jenkins (Store Manager)",
        "status": "open",
        "driver_name": "Kamal Perera",
        "vehicle_id": "VEH009",
        "claimed_amount": "LKR 3,600.00",
    },
    {
        "order_number": "ORD0000005",
        "outlet_id": 5,
        "issue_type": "Quantity Mismatch",
        "title": "1 Case Over-Delivery (Bottled Water)",
        "affected_item": "Bottled Water 500ml (24pk)",
        "sku": "SKU-001",
        "expected_units": 20,
        "received_units": 21,
        "description": "Received 21 cases instead of 20 ordered. Extra case retained at dock awaiting dispatch reconciliation.",
        "photo_name": "excess_stock_pallet.jpg",
        "photo_size": "1.1 MB • Captured 23 Sep",
        "reported_by": "Sarah Jenkins (Store Manager)",
        "status": "resolved",
        "driver_name": "Elena Ramos",
        "vehicle_id": "VEH037",
        "resolution_notes": "Discrepancy reconciled with Peliyagoda inventory ledger.",
    },
]


class IssueService:
    @staticmethod
    def get_issues(
        db: Session,
        outlet_id: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[DeliveryIssue]:
        # If table is completely empty, seed standard records
        count = db.query(DeliveryIssue).count()
        if count == 0:
            for seed in INITIAL_SEED_ISSUES:
                issue = DeliveryIssue(**seed)
                db.add(issue)
            db.commit()

        query = db.query(DeliveryIssue)
        if outlet_id is not None:
            query = query.filter(or_(DeliveryIssue.outlet_id == outlet_id, DeliveryIssue.outlet_id.is_(None)))
        if status and status != "all":
            query = query.filter(DeliveryIssue.status == status)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    DeliveryIssue.title.ilike(pattern),
                    DeliveryIssue.order_number.ilike(pattern),
                    DeliveryIssue.affected_item.ilike(pattern),
                    DeliveryIssue.sku.ilike(pattern),
                    DeliveryIssue.description.ilike(pattern),
                )
            )
        return query.order_by(DeliveryIssue.reported_at.desc(), DeliveryIssue.id.desc()).limit(limit).all()

    @staticmethod
    def get_issue(db: Session, issue_id: int) -> DeliveryIssue:
        issue = db.query(DeliveryIssue).filter(DeliveryIssue.id == issue_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found")
        return issue

    @staticmethod
    def create_issue(db: Session, payload: DeliveryIssueCreate) -> DeliveryIssue:
        issue = DeliveryIssue(
            order_id=payload.order_id,
            order_number=payload.order_number,
            outlet_id=payload.outlet_id,
            issue_type=payload.issue_type,
            title=payload.title,
            affected_item=payload.affected_item,
            sku=payload.sku,
            expected_units=payload.expected_units,
            received_units=payload.received_units,
            description=payload.description,
            photo_url=payload.photo_url,
            photo_name=payload.photo_name,
            photo_size=payload.photo_size,
            reported_by=payload.reported_by or "Sarah Jenkins (Store Manager)",
            driver_name=payload.driver_name,
            vehicle_id=payload.vehicle_id,
            claimed_amount=payload.claimed_amount,
            status="open",
        )
        db.add(issue)
        db.commit()
        db.refresh(issue)
        return issue

    @staticmethod
    def update_issue(db: Session, issue_id: int, payload: DeliveryIssueUpdate) -> DeliveryIssue:
        issue = IssueService.get_issue(db, issue_id)
        if payload.status is not None:
            issue.status = payload.status
        if payload.resolution_notes is not None:
            issue.resolution_notes = payload.resolution_notes
        if payload.claimed_amount is not None:
            issue.claimed_amount = payload.claimed_amount
        db.commit()
        db.refresh(issue)
        return issue


issue_service = IssueService()
