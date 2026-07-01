# Real Inventory + QR Job-Pass Material Issuance — Design

Status: Approved by user 2026-07-01. Ready for implementation planning.

## Problem

`pages/Storedashboard.jsx` (store/inventory module) is entirely demo state: a
hardcoded `useState` inventory array persisted to `localStorage`, fake material
requests, and a fake QR "scanner" (`startQrSimulation`) that feeds a
hardcoded string into `processScannedQrCode` on a `setTimeout` — there is no
camera, no real QR image, and nothing touches the database. `Admindashboard.jsx`'s
"Inventory Stock" and "Spare Parts Approvals" tabs are wired to read from real
DB counts via `lib/moduleAvailability.js`, but the underlying tables
(`inventory_items`, `material_requests`) don't exist yet, so those tabs sit in
a permanent "waiting for data" state.

The user provided a real ~600-line inventory export (name, stock quantity,
unit) that must become the seed data, and wants the full loop working for
real: admin assigns a worker to a job (complaint) → the worker's job card
shows a real QR code → a storekeeper scans it with a real camera → picks/edits
what to hand over → stock is deducted and logged.

## Goals

- Real Postgres-backed inventory (`inventory_items`), replacing all
  localStorage/demo state in Store and Admin dashboards.
- Import the user's ~600-item list as the real seed data, cleaned of a
  copy-paste artifact (a literal `-` character appearing before some
  quantities, e.g. `Stock: - 8 Nos` — this is not a negative number, just
  pasted formatting, and must be stripped so the value imports as `8`).
- A real, scannable QR code per assigned job, generated with the `qrcode`
  package and scanned with a real camera via `html5-qrcode` — no simulation.
- Storekeeper can hand over items against a job by scanning its QR, freely
  editing quantities/items at scan time (pre-allocated requests are a
  starting suggestion, not a hard constraint).
- Every stock change (issue, return, receipt, manual adjustment) is logged in
  an audit ledger.
- No changes to auth, login, role redirects, or the existing mobile-app-shell
  navigation pattern.

## Non-goals

- Low-stock alerts / reorder thresholds / purchase orders.
- Revocation of an individual QR code independent of closing its job (a
  stateless signed token was chosen over a DB-backed revocable token —
  see "QR validation" below).
- Redesigning the visual style of Store/Admin/Technician dashboards — this is
  a data-source swap onto the existing UI shell.

## Data model

New SQL file `sql/inventory_schema.sql`, applied via a new
`scripts/setup-inventory-db.mjs` (same `.env.local`-loading + `pg` pattern as
`scripts/setup-db.js`).

### `inventory_items`

| column | type | notes |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT UNIQUE NOT NULL | trimmed, as given in the source list |
| unit | TEXT NOT NULL | `Nos` / `Meter` / `Kg` / `Set` / `Roll` / `Box` / `Packet` / `Litre` / `Other`; source rows with unit `None` normalize to `Nos` |
| stock_quantity | NUMERIC(12,2) NOT NULL DEFAULT 0 | supports decimal quantities present in the source (e.g. `44.9`, `6.75`, `9.43`, `0.5`) |
| created_at / updated_at | TIMESTAMPTZ | `updated_at` maintained by the existing `set_updated_at()` trigger pattern from `customer table db` |

### `inventory_transactions` (append-only audit ledger)

| column | type | notes |
|---|---|---|
| id | SERIAL PK | |
| item_id | INTEGER NOT NULL REFERENCES inventory_items(id) | |
| complaint_id | INTEGER REFERENCES complaints(id) | nullable; set when the movement is tied to a job |
| type | TEXT NOT NULL | `receipt` \| `issue` \| `return` \| `adjustment` |
| quantity_delta | NUMERIC(12,2) NOT NULL | positive = stock in, negative = stock out |
| balance_after | NUMERIC(12,2) NOT NULL | snapshot of `stock_quantity` after this row, for a fast audit trail without recomputation |
| performed_by | INTEGER NOT NULL REFERENCES users(id) | who executed the change (storekeeper/admin) |
| worker_id | INTEGER REFERENCES users(id) | nullable; who received the parts, for `issue` rows |
| notes | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

### `material_requests`

One row per (job, item) — the pre-allocated "shopping list" a worker builds
against an assigned job.

| column | type | notes |
|---|---|---|
| id | SERIAL PK | |
| complaint_id | INTEGER NOT NULL REFERENCES complaints(id) | the "job" |
| item_id | INTEGER NOT NULL REFERENCES inventory_items(id) | |
| requested_by | INTEGER NOT NULL REFERENCES users(id) | worker |
| requested_quantity | NUMERIC(12,2) NOT NULL | |
| issued_quantity | NUMERIC(12,2) NOT NULL DEFAULT 0 | |
| status | TEXT NOT NULL DEFAULT 'pending' | `pending` \| `approved` \| `rejected` \| `partially_issued` \| `issued` |
| approved_by | INTEGER REFERENCES users(id) | nullable |
| created_at / updated_at | TIMESTAMPTZ | |

Approval is advisory: it lets admin see/flag requests in the existing "Spare
Parts Approvals" tab, but does not block a storekeeper from issuing a
different quantity/item set at scan time (per user decision).

## Inventory import

- `scripts/data/inventory-raw.txt` — the user's pasted list, saved verbatim
  as the durable import source (599 lines, one item per line, format
  `NAME — Stock: [-]?[ ]?NUMBER UNIT`).
- `scripts/import-inventory.mjs` — parses each line with a regex, strips the
  stray `-` (copy-paste artifact, not a negative sign — confirmed by user),
  strips thousands separators (`1,288` → `1288`), keeps decimals as-is,
  normalizes unit `None` → `Nos`, and upserts into `inventory_items` via
  `INSERT ... ON CONFLICT (name) DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity, unit = EXCLUDED.unit`
  so it is safe to re-run. Zero-stock service/charge lines (e.g. `Labour
  Charge`, `EMC`, `Elevator Service Charge`) import like any other row — no
  special-casing.

## QR job-pass design

**Payload**: a JWT signed with the existing `process.env.JWT_SECRET` (same
secret `lib/auth.js` already uses for session cookies), shaped as
`{ type: "job_pass", complaintId, workerId }`. No new DB table for tokens.

**Validation** (chosen over a DB-backed revocable-token table — simpler, no
extra table/read, and matches the existing stateless-JWT auth pattern):
verify JWT signature, then look up the complaint live and require
`assigned_technician_user_id === workerId` and `status` not in
`RESOLVED`/`CLOSED`. This means the same QR image keeps working for the
life of the job (worker may need multiple store visits) and automatically
stops working the instant the job closes or is reassigned — no manual
expiry or revocation bookkeeping needed.

**Generation**: `GET /api/worker/job-qr?complaintId=X` (worker role, must own
the job) returns the signed token. The Techniciandashboard job-detail view
renders it as a real QR image client-side via the `qrcode` package (new
dependency).

**Scanning**: Storedashboard gets a real camera-based scanner using
`html5-qrcode` (new dependency). Camera access requires HTTPS or localhost —
already satisfied by Vercel prod and local dev.

## API surface

- `GET/POST /api/inventory` — list/search items (all authenticated store
  roles), create a new item (storekeeper + admin/superadmin/manager).
- `PATCH /api/inventory/[id]` — edit item fields or perform a manual
  stock adjustment (`receipt`/`adjustment` types), storekeeper + admin;
  every write inserts an `inventory_transactions` row.
- `POST /api/worker/materials` — worker creates one or more `material_requests`
  rows for a job they're assigned to.
- `GET /api/worker/job-qr` — worker generates the signed job-pass token for
  a job they're assigned to.
- `GET/PATCH /api/admin/materials` — admin lists/approves/rejects
  `material_requests` (wires up the existing "Spare Parts Approvals" tab).
- `POST /api/store/scan` — storekeeper submits a scanned token; server
  re-verifies it and returns the job's current `material_requests` plus
  worker/job summary.
- `POST /api/store/issue` — storekeeper submits the final item/quantity list
  for a scanned job; server re-verifies the token server-side (never trusts
  the client-held token blindly) and, in one DB transaction, decrements
  `inventory_items.stock_quantity`, inserts one `inventory_transactions` row
  (`type: issue`) per item, and updates matching `material_requests` rows.
  Insufficient stock on any line blocks that line with an error; nothing
  partially commits.
- `POST /api/store/return` — storekeeper records returned parts (`type:
  return`, positive `quantity_delta`).

All new endpoints use `getUserFromRequest` from `lib/auth.js` for role
checks, and `query` from `lib/db.js` for all queries, per project rules.

## Dashboard wiring

- **Storedashboard.jsx**: remove the `useState` inventory seed, the
  `localStorage` sync effect, and `startQrSimulation`/`processScannedQrCode`.
  Replace with real fetches to `/api/inventory` and `/api/store/*`, and swap
  the fake scanner UI for a real `html5-qrcode` camera component feeding
  `/api/store/scan`. Existing tabs (dashboard/inventory/requests/
  transactions/profile) and layout are unchanged — this is a data-source
  swap.
- **Admindashboard.jsx**: "Inventory Stock" and "Spare Parts Approvals" tabs
  switch from empty/local state to `/api/inventory` and
  `/api/admin/materials`; `moduleIsLive("inventory")` (already wired via
  `lib/moduleAvailability.js`) auto-activates once the import runs, no
  changes needed there.
- **Techniciandashboard.jsx**: add a "Request Materials" action on an active
  job (posts to `/api/worker/materials`) and a "Store Pass" button on the job
  card that fetches and renders the QR image.
- New list/table components (if needed) follow the existing pattern in
  `components/admin/customers/AdminCustomersTable.jsx` rather than
  introducing a new visual style.
- No changes to auth, login, role redirects, or the mobile-app-shell tab
  navigation.

## New dependencies

- `qrcode` — QR image generation (client and/or server).
- `html5-qrcode` — real camera-based QR scanning in the browser.

## Testing

- `scripts/import-inventory.test.mjs` (mirroring the existing
  `scripts/import-workers.test.mjs` pattern) — unit tests for the parser:
  stray-dash stripping, thousands separators, decimals, `None` → `Nos`
  normalization, upsert idempotency.
- Manual verification pass (per project convention — no existing
  Storedashboard/Techniciandashboard test coverage): run the dev server,
  log in as worker → request materials + generate job-pass QR; log in as
  storekeeper → scan (or camera-permission-denied fallback: manual code
  entry) → edit quantities → issue → confirm stock decremented and ledger
  row created; log in as admin → confirm Inventory Stock and Spare Parts
  Approvals tabs show real data.

## Open follow-ups (explicitly out of scope for this pass)

- Low-stock thresholds/alerts.
- Manual token revocation independent of job status.
- Deduping near-identical item names already present as typo variants in the
  source list (e.g. "8 PIN REALY 24V" vs "8 PIN RELAY 24V") — imported as
  distinct items; a future cleanup pass can merge them if desired.
