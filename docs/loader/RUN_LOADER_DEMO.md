# Run the loader demo

The whole loader against the real API on **local** Postgres: sign in, the
queue, the checklist, ticks, and the Log. It never touches Neon.

**You need:** Python 3.11+, Node.js 20+, and PostgreSQL running on
`localhost:5432` with user `postgres` / password `postgres` (a local install, or
`docker compose up -d database` from the repo root). Windows PowerShell.

## Once, after cloning

```powershell
# Backend: settings and dependencies
cd backend
Copy-Item .env.example .env            # its DATABASE_URL is already localhost
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .

# Frontend: dependencies
cd ..\frontend
npm install
```

## Set up the demo data (and reset it any time)

```powershell
cd backend
.\scripts\loader_demo_up.ps1
```

It checks `backend/.env` points at this machine (it **refuses** Neon or any
remote database), points the session at local Postgres (`local_db.ps1`),
creates `waypoint_loader_dev` if it is missing, runs `alembic upgrade head`,
and seeds the Figma scenario with `seed_loader_demo.py --reset`.

If PowerShell blocks the script ("running scripts is disabled"), run it as
`powershell -ExecutionPolicy Bypass -File .\scripts\loader_demo_up.ps1`.

## Run it

Two terminals:

```powershell
# 1. Backend, from backend/
. .\scripts\local_db.ps1
.\.venv\Scripts\python.exe main.py

# 2. Frontend, from frontend/
$env:NEXT_PUBLIC_LOADER_TRANSPORT = "api"
npm run dev
```

Open <http://localhost:3000/loader/sign-in> and sign in as **Saman J.**,
PIN **4417**. The queue shows Dock 3's six runs; open **RUN-021** and tick an
order.

The other seeded loaders are Tharindu J. (2290) and Nimal S. (7735).

**Reset:** run `.\scripts\loader_demo_up.ps1` again.

**Without the backend:** leave `NEXT_PUBLIC_LOADER_TRANSPORT` unset and the
frontend uses its mock data instead.
