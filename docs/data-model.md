# Data Model Documentation

## Loading Tasks (`loading_tasks`)

Tracks the loading status of each order at the depot. Created automatically when a loader views the loading list for a vehicle. Updated as the loader works through each order.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Auto-generated |
| order_id | UUID | FK → orders.id, indexed | The order being loaded |
| vehicle_id | VARCHAR(10) | not null, indexed | Vehicle being loaded (e.g. VEH001) |
| assigned_loader_id | UUID | nullable | Loader who performed the task |
| status | VARCHAR(25) | not null, default 'pending' | pending / in_progress / completed / shortfall_flagged |
| loaded_units | INTEGER | nullable | Actual units physically loaded |
| shortfall_notes | TEXT | nullable | Reason for shortfall, entered by loader |
| completed_at | TIMESTAMP | nullable | When the task was marked complete |
| created_at | TIMESTAMP | not null | Row creation timestamp |
| updated_at | TIMESTAMP | not null | Last update timestamp |

**Status transitions:**
`pending` → `in_progress` (loader starts) → `completed` (all loaded) or `shortfall_flagged` (items missing)

---

## Delivery Receipts (`delivery_receipts`)

Outlet-side confirmation of what was delivered, submitted by the store manager. One receipt per order (enforced by unique constraint on order_id). May be submitted offline and synced later.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Auto-generated |
| order_id | UUID | FK → orders.id, unique, indexed | One receipt per order |
| outlet_id | VARCHAR(10) | not null | Outlet confirming receipt (e.g. OUT001) |
| units_received | INTEGER | nullable | Actual units received at the outlet |
| weight_received_kg | DECIMAL(10,2) | nullable | Actual weight received |
| has_issues | BOOLEAN | not null, default false | Whether the store manager flagged an issue |
| issue_type | VARCHAR(30) | nullable | short_delivery / damaged / wrong_items / other |
| issue_description | TEXT | nullable | Free text description of the issue |
| confirmed_at | TIMESTAMP | nullable | When the manager confirmed receipt |
| synced_from_offline | BOOLEAN | not null, default false | True if submitted via the offline sync batch |
| created_at | TIMESTAMP | not null | Row creation timestamp |
