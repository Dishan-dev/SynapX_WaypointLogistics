# Database migrations (Alembic) · Waypoint backend

How we change the Neon database safely. Every table change is a migration file in Git, and only the DB lead applies migrations to the shared Neon database.

*FastAPI + SQLAlchemy + Alembic · Neon (dev branch, Singapore) · DB lead: Devmith*

---

## 1. How it works (read this first)

A **migration** is one small file that changes the database: create a table, add a column, and so on.

Each migration points to the one before it (`down_revision`). Together they form **one chain**:

```
0001_baseline → bbb8d4327f93 → 552931e83b93 → 0002_loader_foundation → 0003_order_loader_fields
   (oldest)                                                                         (newest = "head")
```

The database stores only the ID of the **last migration it ran**, in the `alembic_version` table. Alembic assumes everything before it in the chain has already run.

That's why things break when:

- **Two migrations have the same parent** (or two chains both start from nothing): Alembic reports *"Multiple head revisions"*.
- **The database has run a migration that isn't in Git**: everyone else gets *"Can't locate revision"*.

## 2. Where things are in this repo

| What | Where |
|---|---|
| Alembic config | `backend/alembic.ini` |
| Migration settings (reads the DB URL) | `backend/alembic/env.py` |
| Migration files | `backend/alembic/versions/` |
| Table definitions (models) | `backend/app/models/` (one file per area) |
| Dependencies | `backend/pyproject.toml` |
| Secrets (never commit) | `backend/.env` |

> The older `Alembic Waypoint Backend.md` guide mentions `migrations/`, `app/models.py` and `requirements.txt`. Those don't exist in this repo. Use the paths above.

---

## 3. First-time setup (everyone, once)

```bash
git checkout dev && git pull
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Create `backend/.env` from the Bitwarden Send. It must contain:

- `DATABASE_URL`: the app login (pooled). Used by the running backend.
- `DATABASE_URL_UNPOOLED`: the owner login (direct). Used only by Alembic.

Check that you're connected and in sync:

```bash
alembic current      # should print "<id> (head)"
```

---

## 4. Adding or changing a table (daily workflow)

1. **Start from the latest `dev`:**
   ```bash
   git checkout dev && git pull
   git checkout -b feature/<your-change>
   alembic current          # must say (head); if not, stop and tell the DB lead
   ```
2. **Change the model** in `backend/app/models/<area>.py`. If you create a new model file, import it in `backend/app/models/__init__.py`.
3. **Generate the migration file:**
   ```bash
   alembic revision --autogenerate -m "short description"
   ```
   This only **writes a file**. It does not touch the database.
4. **Read the new file** in `backend/alembic/versions/`:
   - `down_revision` must be the current head (`alembic heads` before you generated it).
   - Check `upgrade()` and `downgrade()`. Autogenerate can miss renames, enum changes and defaults.
5. **Check there is exactly one head:**
   ```bash
   alembic heads            # must print ONE line
   ```
6. **Commit** the migration file and the model change together, push, and open a PR into **`dev`**. Tag the DB lead.
7. **Do not run `alembic upgrade head` yourself.** The DB lead tests the migration and applies it to Neon after merging.

---

## 5. Team rules

- 🔴 **Only the DB lead runs `alembic upgrade head` (or `downgrade`) on the shared Neon database.**
- 🔴 **Never run a migration on Neon that isn't pushed to Git.** If you did, push the file immediately and tell the DB lead.
- 🔴 **Never use `Base.metadata.create_all()`.** Tables are only created through migrations. (The backend no longer does this on startup.)
- Never edit a migration that is already on `dev`. Write a new one. (Only the DB lead can make an exception.)
- One migration PR at a time. Always `git pull` dev before generating a migration.
- `alembic heads` must show exactly one line before any PR is merged.
- One model per table. Don't create a second class for a table another area already owns; agree on the columns and extend the existing one.

---

## 6. DB lead checklist (before merging a migration PR)

1. Pull the PR branch and run `alembic heads`: exactly one head.
2. `alembic history`: the chain is a single line and ends at the new migration.
3. **Test on a copy first:** in the Neon console, create a branch of `dev`, point `DATABASE_URL_UNPOOLED` at it, and run `alembic upgrade head`.
4. **Test on an empty database:** `docker compose up database`, point `DATABASE_URL_UNPOOLED` at it, and run `alembic upgrade head`. It should build every table from scratch.
5. Merge the PR, then on the real Neon `dev` database:
   ```bash
   git checkout dev && git pull
   alembic upgrade head
   alembic current     # <new id> (head)
   alembic check       # "No new upgrade operations detected."
   ```
6. Tell the team: "Migration `<id>` is live. Pull `dev`."

---

## 7. Commands

| Command | What it does | Touches the DB? |
|---|---|---|
| `alembic current` | Which migration the DB is on | Reads only |
| `alembic heads` | Latest migration(s) in the code | No |
| `alembic history` | Full chain of migrations | No |
| `alembic check` | Do the models match the DB? | Reads only |
| `alembic revision --autogenerate -m "..."` | Write a new migration file | Reads only |
| `alembic upgrade head` | Apply all new migrations | **Writes** (DB lead only) |
| `alembic downgrade -1` | Undo the last migration | **Writes** (DB lead only, never on production) |
| `alembic merge heads -m "merge"` | Join two heads into one | No (writes a file) |

## 8. Common errors

| Error | What it means | Fix |
|---|---|---|
| 🔴 **Can't locate revision identified by '…'** | The DB ran a migration that your code doesn't have. | `git pull` dev. If it's still missing, someone ran an unpushed migration: tell the DB lead. |
| 🟡 **Multiple head revisions** | Two migrations share the same parent. | Don't merge. Set the newer one's `down_revision` to the other's ID (before it's applied), or ask the DB lead to run `alembic merge heads`. |
| 🔴 **relation "…" already exists** | A migration creates a table that's already there. | Two migrations create the same table, or it was made by `create_all()`. Tell the DB lead. |
| 🔴 **permission denied** | You're using the app login (`DATABASE_URL`) for a schema change. | Alembic must use `DATABASE_URL_UNPOOLED`. |
| 🟢 **Slow first connect** | Neon was asleep (5 min idle). | Normal. Wait a few seconds. |

---

## 9. Current status and action items (29 Sep 2026)

**Neon is on `552931e83b93`, which isn't in Git.** `alembic current` fails for everyone until it's pushed.

That migration added these columns (found by comparing Neon with the code):

| Table | Columns added |
|---|---|
| `vehicles` | `depot_name`, `maintenance_state`, `temperature_mode`, `trips_planned`, `trips_today`, `weekly_fuel_status` |
| `allocations` | `volume_percentage` |

### Whoever ran `552931e83b93` (most likely the allocations/dispatcher work)

1. Push the migration file and the model changes to a branch.
2. Open a PR into `dev` and tag the DB lead. Don't edit the file; it's already applied to Neon.

### Thisaru + Sachintha: agree on the `vehicles` table first

Two different `vehicles` tables exist:

- **dev (Thisaru):** `capacity_kg`, `capacity_vol_m3`, `status`, plus the columns above
- **loader (Sachintha):** `temp_capability`, `max_weight_kg`, `max_volume_m3`, `depot`

Agree on one set of columns and keep **one** `Vehicle` model. No code changes until this is agreed.

### Sachintha: fix the loader migrations (after `552931e83b93` is on `dev`)

1. Get the latest `dev`:
   ```bash
   git checkout loader-sachintha && git pull
   git merge origin/dev
   ```
2. In `backend/alembic/versions/bbb8d4327f93_added_allocations.py`:
   `down_revision = None` → `down_revision = "0001_baseline"`
   (Safe: Neon already has the baseline tables. The DB lead has approved this one-off edit.)
3. In `0002_loader_foundation_loader_foundation.py`:
   - `down_revision = "0001_baseline"` → `down_revision = "552931e83b93"`
   - Remove `op.create_table('vehicles', ...)` and its indexes from `upgrade()`, and the matching drops from `downgrade()`.
   - If the agreed `vehicles` table needs columns that don't exist yet, add them here with `op.add_column`.
4. Delete the duplicate `Vehicle` class so only the agreed model is left.
5. Check the chain:
   ```bash
   alembic heads     # exactly ONE line: 0003_order_loader_fields (head)
   alembic history   # 0001_baseline → bbb8d4327f93 → 552931e83b93 → 0002 → 0003
   ```
6. **Don't run `alembic upgrade head` on Neon.** Open a PR into `dev` and tag the DB lead.

> Note: `dev` no longer creates tables when the backend starts. If any loader code relied on that, it will show up after merging `dev`.

### DB lead (Devmith)

- [ ] Find out who ran `552931e83b93` and get it pushed and merged into `dev`.
- [ ] Confirm the `vehicles` agreement between Thisaru and Sachintha.
- [ ] Review Sachintha's PR using the checklist in section 6.
- [ ] Decide whether to delete or replace the outdated root guide `Alembic Waypoint Backend.md`.
