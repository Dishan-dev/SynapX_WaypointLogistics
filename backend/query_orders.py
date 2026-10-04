import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

url = "postgresql://waypoint_app:kjnbvfdfg-fknbnlrm-lwnrb@ep-aged-morning-azl54dle-pooler.c-3.ap-southeast-1.aws.neon.tech/waypoint?sslmode=require&channel_binding=require"
engine = create_engine(url)
Session = sessionmaker(bind=engine)
session = Session()

result = session.execute(text("SELECT id, order_number, status, depot, is_late, operating_date, created_at, brand FROM orders ORDER BY id DESC LIMIT 5"))
for row in result:
    print(row)
