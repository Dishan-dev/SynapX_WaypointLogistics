# Waypoint Logistics

Waypoint Logistics is a role-based operations platform for planning and fulfilling deliveries across Waypoint Group. It supports the full journey from a store's goods request to depot allocation, loading, driver delivery, and receiving confirmation.

## What it supports

- Store goods requests, stock visibility, delivery tracking, receiving, and issue reporting
- Depot inventory, catalogue, outlets, vehicles, delivery runs, and allocations
- Dispatcher planning, route sequencing, fleet management, exceptions, and live tracking
- Loader loading checklists, plan changes, shortfall reporting, and offline sync
- Driver trip execution, GPS, proof of delivery, photos, signatures, SOS, and offline recovery
- Keycloak single sign-on, role-based access, operational email alerts, and audit records

## Workspaces

| Role | Route | Main responsibility |
| --- | --- | --- |
| System Administrator | `/admin` | Users, roles, depots, outlets, fleet, settings, and audits |
| Dispatcher | `/dispatcher` | Plans, allocations, delivery runs, fleet, and exceptions |
| Loader | `/loader` | Dock queue, load checks, issues, and release readiness |
| Driver | `/driver` | Trip execution, proof of delivery, and delivery issues |
| Store Manager | `/store` | Goods requests, deliveries, receipts, stock, and notifications |

## Architecture

```text
Next.js frontend (frontend/)
        ↕
FastAPI API (backend/)
        ↕
PostgreSQL / Neon database

Keycloak → authentication and roles
SMTP     → operational email outbox worker
R2       → optional driver-photo storage
```

## Quick start

### 1. Configure local environment files

Copy the example files and update values for your local environment:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

The project uses these defaults locally:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:5000` |
| API documentation | `http://localhost:5000/api/v1/docs` |
| Keycloak (local default) | `http://localhost:8080` |

### 2. Run the Entire Project with Docker (Recommended)

To run the complete stack (PostgreSQL database, FastAPI backend, and Next.js frontend) in Docker:

```powershell
docker compose up --build
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:5000/api/v1/docs](http://localhost:5000/api/v1/docs)
- **Health Check**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

Or to run only the database container:

```powershell
docker compose up -d database
```

The default local database account is `postgres` / `postgres`. Change `DB_USER` and `DB_PASSWORD` in the root `.env` before creating a database that needs different credentials.

### 3. Start the backend

```powershell
cd backend
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --port 5000
```

Apply database migrations through the approved process before using a new or empty database. See [docs/reference/database-migrations.md](docs/reference/database-migrations.md).

### 4. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Login and access

The main application login uses **Keycloak SSO**. Create real users, assign their roles, and reset passwords through **Admin → Users** when the backend Keycloak client secret is configured.

Supported roles are:

```text
admin, dispatcher, driver, loader, store_manager
```

Dispatchers also require a depot assignment; Store Managers require an outlet assignment.

For a disposable local legacy-API demo, run `backend/scripts/seed_driver.py`. It creates:

```text
driver@waypoint.com / driver123
```

The current frontend signs in through Keycloak, so this seeded account is intended for local API/testing use rather than production SSO.

Never commit `.env` files or live passwords, tokens, database URLs, SMTP credentials, Keycloak client secrets, or R2 keys.

## Useful configuration

| Need | Location |
| --- | --- |
| Frontend API and Keycloak address | `frontend/.env` |
| Backend database, Keycloak, SMTP, R2, and JWT settings | `backend/.env` |
| Docker Compose ports and local database settings | root `.env` |
| Store mock/API data source | `frontend/.env` → `NEXT_PUBLIC_STORE_DATA_SOURCE` |
| Loader mock/API transport | `frontend/.env` → `NEXT_PUBLIC_LOADER_TRANSPORT` |
| Custom Keycloak login design | `keycloak-theme/waypoint/` |

## Project structure

```text
frontend/          Next.js role workspaces and offline-capable UI
backend/           FastAPI API, business logic, models, and migrations
docs/              Feature contracts, data model, operational documentation
database/          Local database initialization resources
keycloak-theme/    Custom Keycloak login theme
```

## Documentation

- [How the complete system works](docs/reference/HOW_THIS_PROJECT_WORKS.md)
- [Backend API and local development](backend/README.md)
- [Database migration process](docs/reference/database-migrations.md)
- [Data model notes](docs/reference/data-model.md)
- [Store Manager contract](docs/reference/store-manager-contract.md)
- [Loader documentation](docs/reference/loader/)

## Production checklist

- Disable `KEYCLOAK_DEV_MODE`.
- Replace all default credentials and secrets.
- Limit backend CORS origins to approved frontend URLs.
- Verify Keycloak realm roles, clients, redirect URLs, and logout URLs.
- Apply migrations through the release process.
- Configure durable photo storage and the email worker when needed.
- Test each role's complete operational journey.
