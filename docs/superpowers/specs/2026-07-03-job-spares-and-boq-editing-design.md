# Job Spares Allocation, Assign-Modal Cleanup, and BOQ Editing — Design

Status: Approved by user 2026-07-03. Ready for implementation planning.

## Problem

Three related gaps, found while investigating a reported "job not assigning /
worker not notified" issue (which turned out to already work correctly at the
DB level — see conversation history):

1. **Spares are worker-initiated only.** The only way spares get attached to a
   job today is a worker requesting materials from their own app
   (`pages/api/worker/materials.js`, "QR Inventory" tab in
   `Techniciandashboard.jsx`), which admin then approves/rejects in a
   "Spare Parts Approvals" tab. There's no way for admin to pick spares while
   assigning the job. Dead, never-wired legacy state
   (`allocatedParts`/`tempPartName`/`tempPartQty`,
   `Admindashboard.jsx:370-400`) hints this was intended but never finished —
   it uses hardcoded free-text part names, isn't rendered in the modal, and
   is never sent to the backend.
2. **The assign-job modal has a redundant/confusing manual status control.**
   `Admindashboard.jsx`'s "Ticket Status" dropdown lets admin manually set any
   status, but assigning a worker already auto-sets `ASSIGNED`
   (`lib/complaints.js` `assignComplaintToWorker`), and the worker's own
   completion flow (`pages/api/worker/complete-job.js`) auto-sets `RESOLVED`.
   The only real manual use case left is cancelling a mistakenly-created
   ticket (confirmed present in live data, e.g. `CMP-202607-0002` /
   `CANCELLED`).
3. **The customer-facing BOQ is a write-once total.** `pages/admin/quotations.jsx`
   already has editable cost-category inputs (commonMaterial, doorMaterial,
   cabinMaterial, motorMaterial, ropeCost, railCost, labourTransport, tax%,
   margin%, discount) but the "Generate BOQ" button only appears for `DRAFT`
   quotations (`quotation.status === "DRAFT"`) and disappears forever once
   generated — there's no way to revisit and adjust pricing afterward, even
   though the backend (`generateBoqForQuotation`, `generate-boq.js`) already
   upserts (`ON CONFLICT (quotation_id) DO UPDATE`) and
   `lib/quotationPermissions.js` already has a distinct, unused
   `can_edit_boq` column/`canEditBoq()` function that was clearly meant for
   this.

## Goals

- Admin can optionally pick spare parts (search-as-you-type, multi-item) while
  assigning a job to a worker; this is a suggestion, not a hard constraint —
  the storekeeper can still freely add/remove/edit items at scan/issue time.
- Remove the worker-initiated material-request path entirely (worker
  "QR Inventory" tab, `POST`/`GET /api/worker/materials`) and the admin
  "Spare Parts Approvals" tab/API — spares now originate from admin at
  assignment time, or ad hoc from the storekeeper at issue time. Nothing else
  requests materials.
- Remove the manual "Ticket Status" dropdown from the assign modal; keep a
  single "Cancel Ticket" button as the only remaining manual override.
- Add an "Edit BOQ" action for already-generated quotations (any status
  except `ACCEPTED`/`REJECTED`/`CONVERTED_TO_CUSTOMER`) that reopens the same
  cost form pre-filled with the current breakdown and re-submits to the
  existing (upserting) endpoint.

## Non-goals

- No changes to the store scan/issue flow itself (`Storedashboard.jsx`,
  `/api/store/scan`, `/api/store/issue`) — it already shows every
  `material_requests` row for a job regardless of who created it or its
  status, so admin-allocated items appear there automatically once created.
- No changes to `inventory_items` schema, QR/job-pass signing, or auth.
- No line-item breakdown on the customer-facing BOQ card (out of scope for
  this pass — only re-editing the existing cost-category totals).
- No new formula/rate-mapping logic for BOQ costs (still the v1 placeholder
  values the admin types in).

## Design

### 1. Admin spares allocation at assignment time

- **UI** (`Admindashboard.jsx` assign modal): replace the dead
  `allocatedParts` stub with a real search-as-you-type multi-select, mirroring
  the existing debounced-search pattern already used in
  `Techniciandashboard.jsx` (~lines 280-297: type → filtered
  `/api/inventory` results). Selecting an item + quantity adds it as a
  removable row/chip in a list; repeat to add more. No hardcoded default part
  name (removes `tempPartName: "Door Roller Assembly"`).
- **API**: `POST /api/complaints/[id]/assign` accepts an optional
  `allocatedItems: [{itemId, quantity}]` array. After the worker-assignment
  `UPDATE` succeeds, if items were provided, the handler creates
  `material_requests` rows via `createMaterialRequests()` (small addition:
  accept a `status` override, defaulting to `'pending'` for backward
  compatibility, called here with `'approved'`; `requested_by` = the admin's
  user id).
- **Atomicity**: wrap the assignment `UPDATE` and the `material_requests`
  `INSERT`s in a single `BEGIN`/`COMMIT`/`ROLLBACK` in the handler (same
  single-connection-pool pattern already used in
  `issueMaterialsForJob`), so a bad item/quantity can't leave the job
  assigned with a silently-missing spares list.
- **Store side**: no changes needed — `listMaterialRequestsForComplaint()`
  (used by `/api/store/scan`) already returns every row for the complaint
  regardless of status, so these show up the moment the storekeeper scans the
  worker's QR. Verify this manually as part of testing (see below).

### 2. Remove worker self-service material requests

- Delete: `pages/api/worker/materials.js` (both GET and POST), the worker
  "QR Inventory" tab and its supporting state
  (`requestForm`, `itemSearchResults`, `materialRequests`,
  `refreshMaterialRequests`, the debounced search effect) in
  `Techniciandashboard.jsx`, and its tab-nav entry.
- Delete: `pages/api/admin/materials.js` (list/approve/reject) and the
  "Spare Parts Approvals" tab (`Admindashboard.jsx` ~lines 2397-2503).
- Keep: the "Generate Store Pass QR" button, `/api/worker/job-qr`, and
  everything in `Storedashboard.jsx` / `/api/store/scan` / `/api/store/issue`
  — unchanged.
- Cleanup: `lib/moduleAvailability.js`'s `materialRequests` module gate
  becomes irrelevant to remove (it only gated the now-deleted approvals tab);
  drop it if nothing else reads it.

### 3. Assign-modal status control

- Remove the "Ticket Status" `<select>` and `updateSelectedComplaintStatus`
  wiring to it in the modal.
- Add a "Cancel Ticket" button (visible when the ticket isn't already
  terminal) that calls the existing status-update endpoint
  (`PATCH /api/complaints/[id]`) with `{ status: "CANCELLED" }` — reuses
  `updateComplaintStatus` as-is, no backend change.
- All other transitions stay automatic: assignment → `ASSIGNED`
  (`assignComplaintToWorker`), worker completes → `RESOLVED`
  (`/api/worker/complete-job.js`), unchanged.

### 4. BOQ editing

- Add an "Edit BOQ" button on `QuotationCard` next to "View BOQ", shown when
  `status` is `BOQ_GENERATED`, `CALCULATED`, or `SENT` (hidden for `DRAFT` —
  where "Generate BOQ" already covers it — and for
  `ACCEPTED`/`REJECTED`/`CONVERTED_TO_CUSTOMER`).
- Clicking it opens the same cost-entry modal, pre-filled with the
  quotation's current `quotation_cost_breakdowns` row. This requires
  `getQuotationById`/the list query to also return the individual cost
  fields (currently only `finalPrice`/`customerPrice` are returned).
- Submits to the same `POST /api/quotations/[id]/generate-boq` — already
  upserts via `ON CONFLICT (quotation_id) DO UPDATE`, so no calculation
  logic changes.
- Swap the route's permission check from `canGenerateBoq` to `canEditBoq`
  when the quotation is not `DRAFT` (both currently resolve identically, but
  `can_edit_boq` already exists as a distinct DB column — this was clearly
  the intended design).
- Audit log the action as `BOQ_EDITED` (vs `BOQ_GENERATED`) when re-editing,
  so the audit trail distinguishes first-generation from later edits.

## Testing

Manual verification pass (per project convention — no existing test coverage
for these dashboards):
- Admin: assign a job with 2+ spares picked via the new search dropdown →
  confirm `material_requests` rows created with `status='approved'`.
- Worker: confirm "QR Inventory" tab is gone; confirm "Generate Store Pass QR"
  still works.
- Store: scan that worker's QR → confirm the admin-picked items appear
  pre-filled and are still freely editable → issue → confirm stock
  decrements and `inventory_transactions` logs correctly.
- Admin: assign a job with zero spares picked → confirm assignment still
  succeeds (spares are optional).
- Admin: cancel a ticket via the new "Cancel Ticket" button → confirm status
  becomes `CANCELLED` and the ticket locks per existing terminal-status
  rules.
- Admin: generate a BOQ, then use "Edit BOQ" to change a price field →
  confirm the customer-facing total updates and `BOQ_EDITED` is audit-logged.
- Admin: confirm "Edit BOQ" is not shown for `ACCEPTED`/`CONVERTED_TO_CUSTOMER`
  quotations.

## Open follow-ups (explicitly out of scope for this pass)

- Line-item breakdown on the customer-facing BOQ card (still single total).
- Real BOQ rate-mapping formulas (still v1 placeholder cost categories).
- Low-stock thresholds/alerts (carried over from the original inventory spec).
