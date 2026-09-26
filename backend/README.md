# Waypoint Logistics - Backend

FastAPI-powered backend service for Waypoint Logistics, managing order planning, warehouse inventory, dispatch operations, and shipment tracking.

## Architecture

```text
backend/
├── app/
│   ├── api/
│   │   ├── deps.py               # Dependency injection (Auth, DB session)
│   │   └── v1/
│   │       ├── api.py            # API router aggregator
│   │       └── endpoints/        # Domain endpoints (auth, orders, inventory, dispatch, tracking)
│   ├── core/
│   │   ├── config.py             # Application settings & environment vars
│   │   ├── database.py           # SQLAlchemy engine & session maker
│   │   └── security.py           # JWT & password hashing utilities
│   ├── crud/
│   │   └── base.py               # Reusable generic CRUD operations
│   ├── models/                   # SQLAlchemy ORM models
│   ├── schemas/                  # Pydantic schemas (validation & serialization)
│   ├── services/                 # Business logic layer
│   └── main.py                   # FastAPI initialization & middleware
├── tests/
│   ├── conftest.py               # Pytest fixtures & TestClient
│   ├── api/                      # Integration and endpoint tests
│   └── unit/                     # Unit tests
├── Dockerfile                    # Container configuration
├── main.py                       # Local entrypoint (uvicorn runner)
└── pyproject.toml                # Dependencies & package metadata
```

## Getting Started

### Local Setup with UV or Pip

```bash
# 1. Install dependencies
pip install -e .

# Or with uv
uv pip install -e .

# 2. Run local development server
python main.py
# or: uvicorn app.main:app --reload --port 5000
```

### Interactive Documentation

Once the server is running, explore the interactive OpenAPI documentation:
- Swagger UI: `http://localhost:5000/api/v1/docs`
- ReDoc: `http://localhost:5000/api/v1/redoc`

### Running Tests

```bash
pytest
```
