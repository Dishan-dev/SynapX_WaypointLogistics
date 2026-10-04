from sqlalchemy import create_engine, text

url = "postgresql://waypoint_app:kjnbvfdfg-fknbnlrm-lwnrb@ep-aged-morning-azl54dle-pooler.c-3.ap-southeast-1.aws.neon.tech/waypoint?sslmode=require&channel_binding=require"
engine = create_engine(url)
with engine.connect() as conn:
    print("=== Outlets (first 5) ===")
    for r in conn.execute(text("SELECT id, name, district, depot, brand FROM outlets LIMIT 5")):
        print(r)
    print("\n=== Recent orders (last 3) ===")
    for r in conn.execute(text("SELECT id, order_number, status, outlet_id, brand, operating_date, notes FROM orders ORDER BY id DESC LIMIT 3")):
        print(r)
