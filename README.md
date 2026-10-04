# Waypoint Logistics

Waypoint Logistics is a role-based operations platform for planning and fulfilling deliveries across Waypoint Group. It covers the full journey of an order: a store's goods request, depot allocation, dock loading, driver delivery, and the store's receiving confirmation.

**Live system:** <https://synap-x-waypoint-logistics-8thu.vercel.app/>
**Team:** SynapX

Further documentation (download the HTML files and open them in a browser):

- [System architecture & data model](docs/architecture.html)
- [AI tool disclosure](docs/ai-disclosure.html)
- [How the system works](docs/reference/HOW_THIS_PROJECT_WORKS.md)

## Contents

1. [For judges: accounts and seeded data](#for-judges-accounts-and-seeded-data)
2. [Judge walkthrough](#judge-walkthrough)
3. [Significant departures from the Designathon submission](#significant-departures-from-the-designathon-submission)
4. [Setup](#setup)
5. [Configuration](#configuration)
6. [Reference](#reference)

## For judges: accounts and seeded data

### Accounts

The judge accounts are in the **credentials file submitted separately**, with one account per role. Every role signs in from the same page: open the live system and choose **Sign In with Waypoint Identity**. After sign-in you land in your role's workspace. A user with several roles can switch between workspaces at `/portal`.

| Role | Workspace | What the account can see |
| --- | --- | --- |
| System Administrator | `/admin` | Everything. Creates users, resets passwords, assigns depots and outlets. |
| Dispatcher | `/dispatcher` | One depot: Peliyagoda or Kandy. |
| Loader | `/loader` | The loading queue of their depot. |
| Driver | `/driver` | Trips on the vehicle assigned to them. |
| Store Manager | `/store` | One outlet. |

For the walkthrough, use a store manager, dispatcher and loader from the same depot, because each outlet is served by one depot. Also use a driver who is assigned to a vehicle at that depot.

### Seeded data

The live database holds the reference data from the brief, plus demo activity from testing (counts as of 4 October 2026):

- 2 depots (Peliyagoda and Kandy) with 4 loading docks
- 120 outlets across the Fresh, Style and Tech chains
- 63 vehicles: trucks and vans, refrigerated and ambient
- 1,092 catalogue items: 398 Fresh, 347 Style and 347 Tech
- 910 operating-calendar days, with holidays and festival and monsoon flags
- Demo orders, allocations, delivery runs and deliveries

## Judge walkthrough

This follows one order from the store's request to its receipt, in about 20 minutes. Each step names the screen and the button to press. The status in brackets is the order's status after that step.

**1. The store manager places an order** (Submitted)
Sign in as the store manager and open **Goods Requests → New Request**. Add a few items; the SKUs fill in from the outlet's catalogue. Choose a delivery date, review the request, and press **Submit Goods Request**. Note the order number.

- A standard delivery must be at least two operating days ahead. A high-priority one can be the next operating day, if it's submitted before the cutoff (Colombo time).
- A request that mixes chilled and ambient goods is split into two orders, one per temperature zone.

**2. The dispatcher allocates a vehicle** (Allocated)
Sign in as the dispatcher and open **Orders**. Tick the order, or use **Suggest route groups → Review group** to group it with nearby orders. Then press **Allocate Vehicle**.

The drawer recommends vehicles and checks each against capacity, temperature, depot, availability, fuel and route timing. Pick an eligible vehicle and set the departure time. The trip goes to the driver assigned to that vehicle, so pick the judge driver's vehicle. Press **Review constraints → Confirm allocation**.

**3. The dispatcher sends the vehicle to a dock**
Open **Vehicle Allocations** and open the new allocation. Choose a dock and press **Send to Dock**. This creates the trip, the loader's plan and the driver's stops.

**4. The driver arrives at the dock**
Sign in as the driver. The trip appears on the driver's home screen with its dock. Press **I've arrived at Dock N**. The run now appears in the loaders' queue, and the trip shows **Waiting for the loader** until the truck is released.

**5. The loader loads and releases the truck** (Ready for dispatch)
Sign in as the loader. In the queue, press **Pick RUN-…** to take the run; only one loader can work a run at a time. Read plan v1 and press **Start loading**.

On the **Loading checklist**, tick each order in loading order, deepest first, because the last stop goes in first.

To see how problems are handled, **Flag** an order (for example as short). The dispatcher resolves it under **Exceptions**, and the run can't be released until they decide.

When every order is checked, press **Review & confirm**, then **Confirm & release**. You can undo the release for about 10 seconds.

**6. The driver delivers** (Dispatched, then Delivered)
Back as the driver, open the trip and press **Start trip**. At the stop, press **I'm Here — Start Delivery**, then **Continue**. Record the **Delivery outcome** and fill in the **Proof of Delivery**: recipient, signature and photo. Press **Submit & complete stop**, then **Complete Trip**.

**7. The store manager confirms receipt** (Completed)
Back as the store manager, open **Incoming Deliveries → Receive Delivery**. Enter the units received and press **Confirm Delivery**, or use **Report Delivery Discrepancy** if something is wrong. The **Notifications** screen shows each step of the order's journey.

**Also worth a look**

- **Dispatcher:** Live Tracking (driver positions on a map), Delivery Runs (**View Loading Status**, **View Manifest**) and Exceptions.
- **Admin:** Users. Create a user, give them a role, and assign a depot or outlet. The change is applied in Keycloak too.
- **Offline use:** in the loader or driver workspace, turn the device's network off and keep working. Queued actions sync when the connection returns.
- **Driver:** SOS and Report Issue.

## Significant departures from the Designathon submission

The Designathon prototype covered four roles and a five-stage journey: Order, Plan, Load, Deliver, Receive. The built system keeps that journey. These are the changes we made while building it, and why.

**1. A fifth role: System Administrator.** The prototype had no admin. A working system needs someone to create users, give them roles, and look after depots, outlets and the fleet. We added an admin workspace at `/admin`. Creating a user there also creates the account in Keycloak.

**2. One sign-in for every role, including the loader.** The prototype had loaders pick their name and enter a PIN on a shared dock tablet. Every role now signs in through Waypoint Identity (Keycloak), so the system has one login, one session model and one audit trail. A user with several roles switches workspace at `/portal`. To keep the shared-tablet use the design aimed for, the loader workspace keeps **Switch user** and signs out automatically after 10 minutes of inactivity.

**3. A dock hand-off between Plan and Load.** In the prototype, the dispatcher published the plan and the loader started loading. Two steps now come in between:

- The dispatcher allocates the vehicle, then sends it to a dock (**Send to Dock**).
- The driver confirms they have arrived at that dock (**I've arrived at Dock N**).

Only then does the run appear in the loaders' queue. A loader takes the run with **Pick**, which locks it to them. This stops loading from starting before the truck is at the dock, and stops two loaders from working the same run.

**4. Screens added beyond the prototype.**

- **Loader:** an Issues list, an activity log and notifications. These were marked as not yet designed in the prototype.
- **Dispatcher:** Analytics and Forecasts.
- **Operational email** to dispatchers, store managers and admins, sent from a queue by a separate worker. See [Hosting](#hosting).

## Setup

You need:

- Python 3.11+
- Node.js 20+
- PostgreSQL 16+, or Docker
- Access to a Keycloak realm (the team's is `waypointlogistics` at `https://auth.tenderease.me`)
- The CSV files from the brief

> [!WARNING]
> **Use your own empty database.** Don't point a local setup at the team's shared Neon database. The Docker backend runs `alembic upgrade head` every time it starts. Alembic uses `DATABASE_URL_UNPOOLED` in preference to `DATABASE_URL`, so check both. Only the DB lead applies migrations to the shared database.

### Option A: Docker

```bash
cp .env.example .env
docker compose --profile local-db up --build
```

On Windows PowerShell, use `Copy-Item .env.example .env` for the first line.

- In Docker mode, the root `.env` configures both containers.
- The default `DATABASE_URL` points at the local `database` container, which the `local-db` profile starts.
- To use another PostgreSQL server, set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` and run `docker compose up --build` without the profile.

The backend applies migrations and starts the API; the frontend starts once the backend is healthy. Once both are up, open:

- App: <http://localhost:3000>
- API docs: <http://localhost:5000/api/v1/docs>
- Health check: <http://localhost:5000/api/v1/health>

To load data, follow [Load the reference data](#load-the-reference-data) from your machine. The local database container publishes port 5432, so point that step's `DATABASE_URL` at `localhost:5432`.

### Option B: Without Docker

Without Docker, the backend reads `backend/.env` and the frontend reads `frontend/.env.local`. The root `.env` is only used by Docker.

**Backend**, from `backend/`:

```bash
cp .env.example .env                      # set DATABASE_URL to your database
python -m venv .venv
source .venv/bin/activate                 # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 5000
```

**Frontend**, from `frontend/`:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The frontend template's defaults don't match the backend above, so change these three values in `frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.tenderease.me
NEXT_PUBLIC_STORE_DATA_SOURCE=api
```

Signing in from `http://localhost:3000` only works if the Keycloak client `waypoint-frontend` allows that address as a redirect URI.

**Email worker** (optional), from `backend/`: set `EMAIL_ENABLED=true` and the SMTP settings in `backend/.env`, then run:

```bash
python -m app.email.worker
```

It runs continuously and sends the emails queued in `email_outbox`.

### Load the reference data

A fresh database needs the brief's reference data. The CSV files are not in the repository, so copy these into `docs/reference/` first:

- `outlets.csv`
- `calendar.csv`
- `fresh_cargo_specs.csv`
- `style_cargo_specs.csv`
- `tech_cargo_specs.csv`

Then run, from `backend/`:

```bash
python scripts/seed_reference_data.py --yes    # 120 outlets and 910 calendar days
python scripts/seed_catalogue.py --yes         # 1,092 catalogue items
python scripts/seed_loader_demo.py --reset     # optional: loader demo scenario
```

Without `--yes`, the first two scripts only show what they would add. `seed_loader_demo.py` refuses to run against anything other than a local database.

To add vehicles, sign in as an admin, open **Admin → Vehicles → Import CSV** and import `vehicles.csv`. Assign drivers to vehicles on the same screen. Create users in **Admin → Users**, which also creates them in Keycloak.

These steps were tested on an empty PostgreSQL 16 database on 4 October 2026.

## Configuration

| Setting | File (without Docker) | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `backend/.env` | Database connection used by the API. |
| `DATABASE_URL_UNPOOLED` | `backend/.env` | Direct connection. If set, Alembic uses it instead of `DATABASE_URL`. |
| `KEYCLOAK_URL`, `KEYCLOAK_REALM` | `backend/.env` | Where sign-in tokens are checked. |
| `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET` | `backend/.env` | Needed for Admin → Users to manage Keycloak accounts. |
| `KEYCLOAK_DEV_MODE` | `backend/.env` | `true` lets requests without a token act as the first admin. For local development only. |
| `BACKEND_CORS_ORIGINS` | `backend/.env` | Frontend addresses allowed to call the API. |
| `DISPATCHER_DEFAULT_DEPOT` | `backend/.env` | Depot used when a request names none (`peliyagoda` or `kandy`). |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | `backend/.env` | Cloudflare R2 photo storage. If blank, photos are saved in a local folder. |
| `EMAIL_ENABLED`, `EMAIL_FROM`, `EMAIL_SMTP_*` (or `EMAIL_USER`, `EMAIL_APP_PASSWORD`) | `backend/.env` | Operational email. Off unless `EMAIL_ENABLED=true`. |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Address of the API. |
| `NEXT_PUBLIC_KEYCLOAK_URL`, `_REALM`, `_CLIENT_ID` | `frontend/.env.local` | Keycloak server, realm and public client used for sign-in. |
| `NEXT_PUBLIC_STORE_DATA_SOURCE` | `frontend/.env.local` | Store Manager data: `api`, or `mock` for built-in sample data. |
| `NEXT_PUBLIC_LOADER_TRANSPORT` | `frontend/.env.local` | Loader data: the real API unless set to `mock`. |

In Docker mode, all of these go in the root `.env`. The frontend's Keycloak settings there are `KEYCLOAK_URL`, `KEYCLOAK_REALM` and `KEYCLOAK_FRONTEND_CLIENT_ID`. The Docker setup does not pass `EMAIL_ENABLED`, so email stays off in Docker.

Next.js builds `NEXT_PUBLIC_*` values into the app. After changing one, restart `npm run dev`, or redeploy on Vercel.

Never commit `.env` files or real credentials.

### Hosting

The live system runs on:

- **Vercel:** the web app and the API
- **Neon:** the PostgreSQL database
- **The team's Keycloak server:** sign-in
- **Cloudflare R2:** photos. R2 is required on Vercel, because serverless functions can't keep files between requests.

The email worker runs as a separate process outside Vercel, because it needs to run continuously.

## Reference

### Workspaces

| Role | Route | Main responsibility |
| --- | --- | --- |
| System Administrator | `/admin` | Users, roles, depots, outlets, fleet, settings and audits |
| Dispatcher | `/dispatcher` | Orders, allocations, delivery runs, fleet, live tracking and exceptions |
| Loader | `/loader` | Dock queue, loading checklist, issues and release |
| Driver | `/driver` | Trip execution, proof of delivery, issues and SOS |
| Store Manager | `/store` | Goods requests, deliveries, receipts, stock and notifications |

### Architecture

```text
Next.js frontend (frontend/)  →  FastAPI API (backend/)  →  PostgreSQL (Neon)

Keycloak       sign-in and roles
Cloudflare R2  photo storage
SMTP           operational email, sent by a separate worker
```

The [architecture page](docs/architecture.html) has the full diagrams and data model.

### Project structure

```text
frontend/          Next.js role workspaces and offline-capable UI
backend/           FastAPI API, business logic, models and migrations
docs/              Architecture page, AI tool disclosure, and reference/ working documents
database/          Local database initialisation resources
keycloak-theme/    Custom Keycloak login theme
```

### Documentation

- [How the system works](docs/reference/HOW_THIS_PROJECT_WORKS.md)
- [Backend API and local development](backend/README.md)
- [Store Manager contract](docs/reference/store-manager-contract.md)
- [Loader documentation](docs/reference/loader/)

### Production checklist

- Set `KEYCLOAK_DEV_MODE=false`.
- Replace every default credential and secret.
- Limit `BACKEND_CORS_ORIGINS` to the real frontend addresses.
- Check Keycloak realm roles, clients, redirect URLs and logout URLs.
- Apply migrations through the release process: only the DB lead applies them to the shared database.
- Configure R2 photo storage and run the email worker.
- Test each role's full journey: order, dispatch, load, drive, receive.
