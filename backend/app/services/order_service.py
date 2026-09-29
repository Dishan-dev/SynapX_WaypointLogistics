from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem, OrderStatus
from app.schemas.order import OrderCreate


class OrderService:
    @staticmethod
    def create_order(db: Session, order_in: OrderCreate) -> Order:
        total_amount = order_in.total_amount or sum(item.quantity * item.unit_price for item in order_in.items)
        db_order = Order(
            order_number=order_in.order_number,
            client_name=order_in.client_name,
            destination_address=order_in.destination_address,
            status=order_in.status,
            total_amount=total_amount,
            brand=order_in.brand,
            district=order_in.district,
            temperature_zone=order_in.temperature_zone,
            delivery_window=order_in.delivery_window,
            weight_kg=order_in.weight_kg,
            is_priority=order_in.is_priority,
            is_late=order_in.is_late,
            operating_date=order_in.operating_date,
            deferral_reason=order_in.deferral_reason,
            allocation_id=order_in.allocation_id,
        )
        db.add(db_order)
        db.flush()

        for item in order_in.items:
            db_item = OrderItem(
                order_id=db_order.id,
                sku=item.sku,
                item_name=item.item_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            db.add(db_item)

        db.commit()
        db.refresh(db_order)
        return db_order


order_service = OrderService()
