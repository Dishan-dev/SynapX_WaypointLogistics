# Loader API contract

Agreed shapes for the `/loader` endpoints, so L1–L9 can be built against the same
responses. Base path: `/api/v1/loader`.

Two halves:

- **Built (L0)** — implemented and tested on `loader-sachintha`. Live now.
- **Proposed** — Sanduni's features (L2, L3, L5, L6). **Written here for review,
  not implemented.** Nothing on `loader-sachintha` creates these routes, schemas
  or handlers. Change anything you disagree with before building.

All enum values are the wire values, lowercase with underscores. All times are
ISO 8601.

---

## Shared enums

| Enum | Values |
| --- | --- |
| `run_status` | `not_started` · `loading` · `issue_flagged` · `loaded` · `ready_to_depart` · `gated_out` |
| `order_state` | `to_load` · `loaded` · `flagged` · `re_check` · `take_off` · `moved` · `new` |
| `temperature_class` | `chilled` · `ambient` |
| `brand` | `fresh` · `style` · `tech` |
| `dock_type` | `rear_dock` · `street` · `mall_bay` |
| `vehicle_type` | `truck` · `van` |
| `temp_capability` | `reefer` · `ambient` |
| `issue_type` | `missing` · `short` · `damaged` · `wont_fit` |
| `issue_status` | `sent` · `seen` · `decided` · `default_applied` |
| `change_kind` | `unload_from_truck` · `dont_load` · `load_new` · `resequence` |
| `actor_kind` | `loader` · `dispatcher` · `system` |

Two distinctions worth keeping:

- `loaded` vs `ready_to_depart` — every order is aboard, but the loader has not
  signed the run off. The design asks for an unambiguous departure state, so
  "all checked" must not imply "ready".
- `decided` vs `default_applied` — the dispatcher chose, or decide-by passed and
  the pre-agreed fallback fired. The loader is shown which.

---

## Built (L0) — live on `loader-sachintha`

### `GET /loader/runs/{code}` — L4 checklist

`stops` is ordered by **`load_position`, not `stop_sequence`**. The loader works
the truck from the cab outwards, which is the reverse of the driver's route:
`load_position = stop_count − stop_sequence + 1`.

```jsonc
{
  "code": "RUN-021",
  "trip_number": 1,
  "brand": "fresh",
  "district": "Gampaha",
  "wave": "night",
  "departs_at": "2026-05-28T03:30:00",
  "status": "loading",
  "current_plan_version": 2,
  "dock": "Dock 3",
  "vehicle": {
    "code": "VEH001",
    "vehicle_type": "truck",
    "temp_capability": "reefer",
    "max_weight_kg": 5510.0,
    "max_volume_m3": 26.4
  },
  "capacity": {
    "loaded_weight_kg": 3410.0,
    "planned_weight_kg": 4920.0,
    "max_weight_kg": 5510.0,
    "loaded_volume_m3": 16.6,
    "planned_volume_m3": 23.9,
    "max_volume_m3": 26.4
  },
  "plan": {
    "version": 2,
    "published_at": "2026-05-27T21:40:00",
    "source": "Dispatcher",
    "summary": null,
    "acknowledged_at": "2026-05-27T21:45:00",
    "acknowledged_by": "Saman J."
  },
  "unacknowledged_plan_version": null,   // set when a new plan is waiting — L6 must lock release
  "stops": [
    {
      "stop_sequence": 4,
      "load_position": 1,                // LOAD 1ST · DEEPEST
      "eta": "2026-05-28T05:19:00",
      "handling_minutes": 16,
      "status": "pending",
      "outlet": {
        "code": "OUT027",
        "name": "Gampaha Market St",
        "brand": "fresh",
        "district": "Gampaha",
        "dock_type": "street",
        "van_only": false,
        "window_start": "05:00:00",
        "window_end": "07:30:00"
      },
      "orders": [
        {
          "order_number": "ORD0092307",
          "temperature_class": "ambient",
          "units": 44,
          "weight_kg": 650.0,
          "volume_m3": 3.2,
          "state": "loaded",
          "checked_at": "2026-05-28T01:41:00",
          "checked_by": "Saman J."
        }
      ]
    }
  ],
  "orders_checked": 5,
  "orders_total": 8
}
```

**Counting rules** (L6's "Review & confirm · 5 of 7" reads these directly):

- `orders_total` **excludes** `take_off` and `moved` — they are no longer orders
  to load, though they are still returned so the checklist can render them greyed
  or as a pinned unload task.
- `orders_checked` counts only `loaded` and `flagged`. **`re_check` does not
  count.** A plan change invalidates the earlier check and the loader must
  confirm it again.
- `re_check` *does* count toward `capacity.loaded_*` — the goods are physically
  aboard, they just need re-confirming.

### `GET /loader/runs/{code}/activity` — L9 log

Oldest first. Feeds the Log tab and the checklist's Change log panel.

```jsonc
[
  {
    "at": "2026-05-28T02:14:00",
    "actor_kind": "dispatcher",
    "actor": "Dispatcher",
    "event_type": "plan_published",
    "order_number": null,
    "message": "Dispatcher published plan v3"
  }
]
```

### `GET /loader/issues/{id}` — L8 waiting / decision

```jsonc
{
  "id": 7,
  "run_code": "RUN-027",
  "order_number": "ORD0092314",
  "outlet_code": "OUT003",
  "issue_type": "missing",
  "units_affected": 8,
  "units_total": 8,
  "quick_note_tag": null,
  "note": "Chilled order not at the dock.",
  "photo_path": null,
  "reported_by": "Tharindu J.",
  "reported_at": "2026-05-28T02:03:00",
  "status": "sent",
  "seen_at": null,
  "decide_by": "2026-05-28T04:10:00",   // departure − 20 min
  "decided_at": null,
  "decided_by": null,
  "options": [
    { "label": "Send without it", "detail": "…", "is_default": true, "is_chosen": false },
    { "label": "Move to VEH036 · Trip 1", "detail": "…", "is_default": false, "is_chosen": false },
    { "label": "Hold VEH035", "detail": "…", "is_default": false, "is_chosen": false }
  ]
}
```

Options are returned even when unchosen, so the loader sees the trade-off the
dispatcher weighed rather than just the outcome.

### Dev-only simulation

Mounted only when `LOADER_DEV_ENDPOINTS=true` **and** `ENVIRONMENT != production`.
In production the sub-router is not registered at all — the paths 404 and never
appear in the OpenAPI schema.

| Endpoint | Effect |
| --- | --- |
| `POST /loader/dev/runs/{code}/plan-change` | Publishes the next plan version. **Empty body reproduces the Figma v2 → v3 change exactly.** |
| `POST /loader/dev/issues/{id}/decide` | Applies a decision. `{"option_label": "...", "decided_by": "..."}`; no body applies the default. |
| `POST /loader/dev/issues/{id}/expire` | Decide-by passes; the `is_default` option is applied and status becomes `default_applied`. |

Use these to drive L5/L6 states without waiting for a dispatcher UI.

### Errors

Existing domain handlers, so the envelope matches the rest of the API:

| Status | `detail.code` | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | unknown run code, issue id or order number |
| 409 | `INVALID_STATE_TRANSITION` | resolving a settled issue; plan change after gate-out |

```jsonc
{ "detail": { "code": "NOT_FOUND", "message": "Run 'RUN-999' not found.",
              "entity": "DeliveryRun", "entity_id": "RUN-999" } }
```

---

## Proposed — Sanduni's features (not implemented)

> Sanduni: these are suggestions from the L0 data model, not decisions. The
> fields all exist in the database, so anything here is buildable as written —
> but change what does not suit the screens.

### `GET /loader/users` — L2 sign-in

Name search for the tile list. PIN never leaves the server.

```jsonc
[ { "id": 1, "full_name": "Saman Jayawardena", "short_name": "Saman J." } ]
```

Optional `?q=` for the search field. `short_name` is what the tiles render, two
per row at 320px.

### `POST /loader/session` — L2 sign-in

```jsonc
// request
{ "loader_user_id": 1, "pin": "4417", "dock_tablet_label": "Dock tablet 3" }

// 200
{ "session_id": 12, "loader": { "id": 1, "short_name": "Saman J." },
  "dock": "Dock 3", "depot": "peliyagoda", "started_at": "2026-05-28T01:30:00" }

// 401 — wrong PIN
{ "detail": { "code": "AUTHORIZATION_FAILED", "message": "Incorrect PIN." } }
```

The tablet is registered to a dock, so there is no depot picker — the response
tells the client which dock's queue to show. `DELETE /loader/session/{id}` ends
it with `end_reason` of `idle_timeout`, `switch_user` or `sign_out`.

### `GET /loader/summary` — L3 metric cards

```jsonc
{
  "dock": "Dock 3",
  "date": "2026-05-28",
  "day_label": "Thu 28 May",
  "next_holiday": { "date": "2026-05-30", "label": "Poson Sat 30 May" },
  "runs": 6,
  "loading": { "count": 2, "loaders": ["Saman", "Tharindu"] },
  "issues": { "count": 1, "label": "Awaiting decision" },
  "ready": { "count": 1, "run_codes": ["RUN-022"] }
}
```

### `GET /loader/runs` — L3 queue

`?dock=DOCK3&brand=fresh` — brand omitted returns all. Sorted by `departs_at`.

```jsonc
{
  "groups": [
    {
      "label": "Fresh · night wave",
      "brand": "fresh",
      "wave": "night",
      "runs": [
        {
          "code": "RUN-021",
          "vehicle_code": "VEH001",
          "vehicle_type": "truck",
          "temp_capability": "reefer",
          "trip_number": 1,
          "brand": "fresh",
          "district": "Gampaha",
          "departs_at": "2026-05-28T03:30:00",
          "status": "loading",
          "stop_count": 4,
          "orders_checked": 5,
          "orders_total": 8,
          "loader": "Saman J.",
          "chips": ["Truck", "Reefer", "5,510 kg · 26.4 m³"],
          "alert": {
            "tone": "warning",
            "message": "Plan updated 02:14 · v2 → v3",
            "action": "Review",
            "href": "/loader/runs/RUN-021"
          }
        }
      ]
    }
  ]
}
```

`alert` is nullable and drives the coloured row on the card. Suggested tones:
`warning` for a plan change, `error` for a waiting issue, `success` for signed
off, `neutral` for a pre-stage note.

### `POST` / `DELETE /loader/runs/{code}/orders/{order_number}/check` — L4 ↔ L5

L4's own write path. **Include `client_action_id`** (a UUID the tablet
generates): `loading_checks.client_action_id` is unique, so a replayed offline
action is never applied twice. Returns the updated `RunDetailRead`.

### `POST /loader/issues` — L5 flag

```jsonc
// request
{ "run_code": "RUN-021", "order_number": "ORD0092301",
  "issue_type": "damaged", "units_affected": 3,
  "quick_note_tag": "Crushed carton", "note": "",
  "client_action_id": "…" }
```

`units_total` is filled server-side from the order, so the client only sends what
the stepper shows. Returns the created `IssueDetailRead`. Setting an issue puts
the run into `issue_flagged` and the row into `flagged`.

### `GET /loader/issues` — L5 Issues tab

`?run=RUN-021&status=sent` — a list of `IssueDetailRead`, newest first. The tab
is not designed yet, so treat the shape as provisional.

### `GET /loader/runs/{code}/release-summary` · `POST …/release` · `POST …/release/undo` — L6

Release must be **locked** when any of these hold — all three are readable from
the built endpoints:

1. `unacknowledged_plan_version` is not null.
2. Any issue on the run is `sent` or `seen`.
3. `orders_checked < orders_total`.

`POST /release` sets `released_at` / `released_by` and moves the run to
`ready_to_depart`; `POST /release/undo` reverses it within the 10 s window, and
should refuse once `gated_out_at` is set — after the gate it is the driver's job.

---

## Open questions

- **Sign-in:** name + PIN (Figma, and what L0 models) vs Keycloak (repo setup).
  L0 keeps `loader_users` separate from `users` so this stays open.
- **RUN-022 / RUN-029 / RUN-031 / RUN-033** are seeded at queue level only. Their
  checklist detail is not pinned down in the design — RUN-022's checklist frames
  show a different plan version and different outlets from its own queue card —
  so the per-order breakdown is for L3/L6 to settle.
- **Issues tab, Log tab, More tab, bell notifications** are not designed yet.
- **`resequence`** exists as a `change_kind` but nothing emits it yet; the
  dispatcher may need it when stop order changes without orders moving.
