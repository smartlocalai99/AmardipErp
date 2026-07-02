# Job Spares Allocation, Assign-Modal Cleanup, and BOQ Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin optionally pick spare parts while assigning a job (replacing worker self-service requests entirely), simplify the assign modal's status control to automatic-plus-cancel, and let admin re-edit BOQ pricing on quotations after it's been generated.

**Architecture:** Reuses the existing `material_requests` table and store scan/issue flow unchanged — admin-picked spares are just rows in that table created server-side at assignment time instead of worker-initiated rows. Reuses the existing (already-upserting) BOQ generation endpoint for edits, just adding a way back into it. No new tables, no new dependencies.

**Tech Stack:** Next.js pages router, `pg` (raw SQL via `lib/db.js`'s `query()`), React function components with `useState`/`useEffect`, plain Node `.test.mjs` assertion scripts (project convention — no Jest/Vitest; run via `node scripts/*.test.mjs`).

## Global Constraints

- No changes to auth, login, role redirects, `Storedashboard.jsx`, `/api/store/scan`, `/api/store/issue`, `/api/worker/job-qr`, or QR/job-pass signing.
- `lib/db.js`'s pool is `max: 1` — sequential `query("BEGIN")`/`query("COMMIT")`/`query("ROLLBACK")` calls across multiple function calls in one request are safe without a separate `pg.Client` checkout (same pattern already used in `issueMaterialsForJob`).
- Follow existing import style per file: some files use `@/lib/...`, some use `./...js` — match whichever the file being edited already uses.
- No test framework — new tests are plain scripts using `node:assert/strict`, following `scripts/complaints.test.mjs`'s exact pattern (see Task 1).
- Manual verification (dev server + browser/curl) is the project's convention for DB-touching routes and React pages — there is no existing automated coverage for `Admindashboard.jsx`, `Techniciandashboard.jsx`, or `pages/admin/quotations.jsx`.

---

## File Structure

**Modify:**
- `lib/materialRequests.js` — add `status` param to `createMaterialRequests`, add `normalizeAllocatedItems` pure helper, remove now-dead `listAllMaterialRequests`/`updateMaterialRequestStatus`.
- `pages/api/complaints/[id]/assign.js` — accept optional `allocatedItems`, wrap assignment + allocation in a transaction.
- `lib/moduleAvailability.js` — remove the now-unused `materialRequests` gate.
- `pages/Admindashboard.jsx` — remove dead legacy parts-allocation stub and 3 dead handler functions; remove manual status dropdown; add spares search-multiselect; add Cancel Ticket button; remove Spare Parts Approvals tab entirely.
- `pages/Techniciandashboard.jsx` — remove the QR Inventory tab entirely (state, effects, handlers, UI, nav entry, quick-action entry, notification redirect).
- `lib/quotations.js` — return full cost-breakdown fields from `getQuotationById`/`listQuotations`; add `getQuotationStatus`.
- `pages/api/quotations/[id]/generate-boq.js` — branch permission + audit action name on whether this is first-generation or an edit; lock terminal statuses server-side.
- `pages/admin/quotations.jsx` — add "Edit BOQ" button, pre-fill cost form on edit, fix stale-costs bug on fresh generate.

**Delete:**
- `pages/api/worker/materials.js`
- `pages/api/admin/materials.js`

**Create:**
- `scripts/material-requests.test.mjs`

---

### Task 1: `createMaterialRequests` status param + `normalizeAllocatedItems` helper (with test)

**Files:**
- Modify: `lib/materialRequests.js`
- Test: `scripts/material-requests.test.mjs` (new)

**Interfaces:**
- Produces: `createMaterialRequests({ complaintId, requestedBy, items, status = "pending" })` (status now accepted, defaults preserve old behavior) and `normalizeAllocatedItems(raw)` — both exported from `lib/materialRequests.js`, consumed by Task 2.

- [ ] **Step 1: Write the failing test**

Create `scripts/material-requests.test.mjs`:

```js
import assert from "node:assert/strict";
import { normalizeAllocatedItems } from "../lib/materialRequests.js";

assert.deepEqual(
  normalizeAllocatedItems([
    { itemId: "5", quantity: "2" },
    { itemId: 7, quantity: 1 },
  ]),
  [
    { itemId: 5, quantity: 2 },
    { itemId: 7, quantity: 1 },
  ]
);

assert.deepEqual(normalizeAllocatedItems(undefined), []);
assert.deepEqual(normalizeAllocatedItems(null), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: 0, quantity: 2 }]), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: 5, quantity: 0 }]), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: 5, quantity: -1 }]), []);
assert.deepEqual(normalizeAllocatedItems([{ itemId: "abc", quantity: 2 }]), []);

console.log("materialRequests tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/material-requests.test.mjs`
Expected: FAIL — `normalizeAllocatedItems is not a function` (or a similar "not exported" error), since it doesn't exist in `lib/materialRequests.js` yet.

- [ ] **Step 3: Implement — add the helper and the status param**

In `lib/materialRequests.js`, add this new exported function anywhere after the imports (e.g. right before `createMaterialRequests`):

```js
export function normalizeAllocatedItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((line) => ({ itemId: Number(line?.itemId), quantity: Number(line?.quantity) }))
    .filter((line) => line.itemId && line.quantity > 0);
}
```

Then modify `createMaterialRequests` to accept and use a `status` param, defaulting to `"pending"` so the (soon-to-be-deleted) worker call site keeps working until Task 3:

```js
export async function createMaterialRequests({ complaintId, requestedBy, items, status = "pending" }) {
  await ensureMaterialRequestsTable();
  if (!Array.isArray(items) || items.length === 0) throw new Error("At least one item is required.");
  if (!["pending", "approved"].includes(status)) throw new Error("Invalid status.");

  const complaint = await getComplaintById(complaintId);
  if (!complaint) throw new Error("Job not found.");

  const created = [];
  for (const line of items) {
    const item = await getInventoryItemById(line.itemId);
    if (!item) throw new Error(`Inventory item ${line.itemId} not found.`);
    const quantity = Number(line.quantity);
    if (!quantity || quantity <= 0) throw new Error(`Invalid quantity for ${item.name}.`);

    const result = await query(
      `
      INSERT INTO material_requests (complaint_id, item_id, requested_by, requested_quantity, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [complaintId, item.id, requestedBy, quantity, status]
    );
    created.push(normalizeRequestRow({ ...result.rows[0], item_name: item.name, item_unit: item.unit }));
  }

  return created;
}
```

(This only adds the `status` column to the existing `INSERT` and a 5th bound param — everything else in the function is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/material-requests.test.mjs`
Expected: prints `materialRequests tests passed` and exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/materialRequests.js scripts/material-requests.test.mjs
git commit -m "Add status param to createMaterialRequests and normalizeAllocatedItems helper"
```

---

### Task 2: Admin spares allocation in the assign API (transactional)

**Files:**
- Modify: `pages/api/complaints/[id]/assign.js`

**Interfaces:**
- Consumes: `createMaterialRequests({ complaintId, requestedBy, items, status })` and `normalizeAllocatedItems(raw)` from Task 1; `query` from `@/lib/db` (raw `BEGIN`/`COMMIT`/`ROLLBACK` strings, same pattern as `lib/materialRequests.js`'s `issueMaterialsForJob`).
- Produces: `POST /api/complaints/[id]/assign` now accepts an optional `allocatedItems: [{itemId, quantity}]` in the request body. Consumed by Task 4 (Admindashboard.jsx).

- [ ] **Step 1: Replace the handler**

Replace the full contents of `pages/api/complaints/[id]/assign.js` with:

```js
import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { assignComplaintToWorker, getComplaintById } from "@/lib/complaints";
import { safeSendPush } from "@/lib/pushNotifications";
import { createMaterialRequests, normalizeAllocatedItems } from "@/lib/materialRequests";
import { query } from "@/lib/db";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Complaint assignment audit log failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || !ALLOWED_ROLES.has(actor.role)) {
    return res.status(403).json({ success: false, message: "Unauthorized." });
  }

  const workerUserId = Number(req.body?.assignedTechnicianUserId);
  if (!workerUserId) {
    return res.status(400).json({ success: false, message: "Select a worker." });
  }

  const allocatedItems = normalizeAllocatedItems(req.body?.allocatedItems);

  await query("BEGIN");
  let complaint;
  let before;
  try {
    before = await getComplaintById(req.query.id);
    complaint = await assignComplaintToWorker({
      complaintId: req.query.id,
      workerUserId,
      actor,
      assignmentNotes: req.body?.assignmentNotes,
    });

    if (allocatedItems.length > 0) {
      await createMaterialRequests({
        complaintId: complaint.id,
        requestedBy: actor.id,
        items: allocatedItems,
        status: "approved",
      });
    }

    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    console.error("Assign complaint error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to assign complaint." });
  }

  await safeAudit({
    req,
    actor,
    entityType: "COMPLAINT",
    entityId: complaint.id,
    action: "COMPLAINT_ASSIGNED",
    oldValues: before,
    newValues: complaint,
    changedFields: ["assignedTechnicianUserId", "assignedTechnicianName", "status"],
  });
  await safeSendPush(
    { userIds: [complaint.assignedTechnicianUserId] },
    {
      title: "New job assigned",
      body: `${complaint.complaintNo} - ${complaint.customerName || "Customer"} is assigned to you.`,
      data: { url: "/Techniciandashboard?tab=jobs", complaintId: complaint.id },
    }
  );
  return res.status(200).json({ success: true, complaint });
}
```

Note the restructure: the transaction now only wraps the assignment UPDATE and the material_requests INSERTs (the actual mutations); audit logging and push notification happen after `COMMIT` succeeds, matching the existing best-effort pattern for those two side effects (they already fail silently via `safeAudit`/`safeSendPush` and must not roll back a successful assignment).

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, then with a logged-in admin session cookie (or via the browser UI once Task 4 wires the frontend), send:

```bash
curl -s -X POST http://localhost:3000/api/complaints/<a-real-complaint-uuid>/assign \
  -H "Content-Type: application/json" \
  -b "<your session cookie>" \
  -d '{"assignedTechnicianUserId": 19, "allocatedItems": [{"itemId": 1, "quantity": 2}]}'
```

Expected: `{"success":true,"complaint":{...}}`. Then confirm a new row exists:

```bash
node -e "
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2]; });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(\"SELECT complaint_id, item_id, requested_quantity, status, requested_by FROM material_requests ORDER BY created_at DESC LIMIT 3\").then(r => { console.log(r.rows); pool.end(); });
"
```
Expected: the newest row has `status: 'approved'` and `requested_by` equal to the admin's user id (not a worker id).

Also verify the zero-items case still works: same curl without `allocatedItems` — expect `{"success":true,...}` with no new `material_requests` row.

- [ ] **Step 3: Commit**

```bash
git add pages/api/complaints/[id]/assign.js
git commit -m "Let admin allocate spares transactionally when assigning a job"
```

---

### Task 3: Delete worker self-service materials + admin approvals API

**Files:**
- Delete: `pages/api/worker/materials.js`
- Delete: `pages/api/admin/materials.js`
- Modify: `lib/materialRequests.js` (remove now-dead exports)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is pure removal. `listMaterialRequestsForComplaint` (used by `/api/store/scan`) and `createMaterialRequests`/`normalizeAllocatedItems` (used by Task 2) are untouched and remain exported.

- [ ] **Step 1: Delete the two API files**

```bash
rm "pages/api/worker/materials.js" "pages/api/admin/materials.js"
```

- [ ] **Step 2: Remove the now-dead exports from `lib/materialRequests.js`**

Delete these two functions entirely from `lib/materialRequests.js` (they were only ever called by the two files just deleted):

```js
export async function listAllMaterialRequests({ status } = {}) {
  await ensureMaterialRequestsTable();
  const params = [];
  let whereSql = "";
  if (status) {
    params.push(status);
    whereSql = "WHERE r.status = $1";
  }
  const result = await query(
    `${SELECT_WITH_JOINS} ${whereSql} ORDER BY r.created_at DESC LIMIT 500`,
    params
  );
  return result.rows.map(normalizeRequestRow);
}

export async function updateMaterialRequestStatus({ id, status, approvedBy }) {
  await ensureMaterialRequestsTable();
  if (!["approved", "rejected"].includes(status)) throw new Error("Invalid status.");

  const result = await query(
    "UPDATE material_requests SET status = $1, approved_by = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
    [status, approvedBy, id]
  );
  if (!result.rows[0]) throw new Error("Material request not found.");

  const item = await getInventoryItemById(result.rows[0].item_id);
  return normalizeRequestRow({ ...result.rows[0], item_name: item?.name, item_unit: item?.unit });
}
```

- [ ] **Step 3: Verify nothing else references the deleted files/functions**

Run: `grep -rn "api/worker/materials\|api/admin/materials\|listAllMaterialRequests\|updateMaterialRequestStatus" --include="*.js" --include="*.jsx" pages lib`
Expected: no output (Task 4 and Task 7, done next, will remove the remaining frontend references — if this grep still shows hits in `pages/Admindashboard.jsx` or `pages/Techniciandashboard.jsx` at this point, that's expected and will be cleaned up in Tasks 4/7, not a failure of this task).

- [ ] **Step 4: Commit**

```bash
git add -A pages/api/worker/materials.js pages/api/admin/materials.js lib/materialRequests.js
git commit -m "Delete worker self-service material requests and admin approvals API"
```

---

### Task 4: Admindashboard.jsx — assign modal (spares picker, remove status dropdown, add Cancel Ticket)

**Files:**
- Modify: `pages/Admindashboard.jsx`

**Interfaces:**
- Consumes: `POST /api/complaints/[id]/assign` with `allocatedItems` (Task 2); `GET /api/inventory?search=` returning `{success, items: [{id, name, unit, stockQuantity}]}` (existing, unchanged — same shape already used in `Techniciandashboard.jsx`'s debounced search); `PATCH /api/complaints/[id]` with `{status: "CANCELLED"}` (existing, unchanged).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Remove the dead legacy parts-allocation stub and its 3 dead consumer functions**

In `pages/Admindashboard.jsx`, delete this block (currently around line 370-400):

```js
    // Parts allocation states
    const [allocatedParts, setAllocatedParts] = useState([]);
    const [tempPartName, setTempPartName] = useState("Door Roller Assembly");
    const [tempPartQty, setTempPartQty] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedComplaint) {
                setAllocatedParts(selectedComplaint.allocatedParts || []);
            } else {
                setAllocatedParts([]);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [selectedComplaint]);

    const handleAddPart = () => {
        if (tempPartQty <= 0) return;
        setAllocatedParts(prev => {
            const exists = prev.find(p => p.partName === tempPartName);
            if (exists) {
                return prev.map(p => p.partName === tempPartName ? { ...p, quantity: p.quantity + tempPartQty } : p);
            }
            return [...prev, { partName: tempPartName, quantity: tempPartQty }];
        });
        setTempPartQty(1);
    };

    const handleRemovePart = (partName) => {
        setAllocatedParts(prev => prev.filter(p => p.partName !== partName));
    };
```

Also delete these 3 entirely-dead functions (never called anywhere in the file — confirmed by `grep -n "handleAssignComplaint\|toggleComplaintStatus\|handleUpdateComplaintStatus(" pages/Admindashboard.jsx` only matching their own `function` declarations), currently around lines 1023-1120:

```js
    function toggleComplaintStatus(id) {
        setComplaints(prev =>
            prev.map(c => {
                if (c.id === id) {
                    let nextStatus = c.status === "Open" ? "In Progress" : c.status === "In Progress" ? "Resolved" : "Open";
                    let color = nextStatus === "In Progress" ? "text-red-600 bg-red-50 border-red-100" :
                        nextStatus === "Open" ? "text-amber-600 bg-amber-50 border-amber-100" :
                            "text-emerald-600 bg-emerald-50 border-emerald-100";

                    // Update complaints count
                    if (nextStatus === "Resolved") {
                        setKpiCounts(k => ({ ...k, openComplaints: Math.max(0, k.openComplaints - 1) }));
                    } else if (c.status === "Resolved") {
                        setKpiCounts(k => ({ ...k, openComplaints: k.openComplaints + 1 }));
                    }

                    return { ...c, status: nextStatus, color };
                }
                return c;
            })
        );
    }

    function handleAssignComplaint(complaintId, techName) {
        setComplaints(prev =>
            prev.map(c => {
                if (c.id === complaintId) {
                    let nextStatus = c.status;
                    let color = c.color;
                    if (techName && c.status === "Open") {
                        nextStatus = "In Progress";
                        color = "text-red-600 bg-red-50 border-red-100";
                    }
                    return { 
                        ...c, 
                        assignedTech: techName, 
                        status: nextStatus, 
                        color,
                        allocatedParts: allocatedParts,
                        allocatedPartsQr: allocatedParts.length > 0 ? `QR-${complaintId}-ALLOCATED` : null,
                        allocatedPartsIssued: false
                    };
                }
                return c;
            })
        );

        if (techName) {
            setTechnicians(prev =>
                prev.map(t => {
                    if (t.name === techName) {
                        const hadTask = !!t.allocatedTask;
                        let newWorkload = t.workload;
                        if (!hadTask) {
                            const parts = t.workload.split("/");
                            const current = parseInt(parts[0]) + 1;
                            newWorkload = `${current}/${parts[1]}`;
                        }

                        // Add notification log
                        const newNotif = {
                            id: notifications.length ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
                            category: "Task Allocated",
                            message: `Assigned complaint "${complaintId}" to technician ${t.name}`,
                            time: "Just now"
                        };
                        setNotifications(n => [newNotif, ...n]);

                        return { ...t, allocatedTask: `Complaint: ${complaintId}`, workload: newWorkload };
                    }
                    return t;
                })
            );
        }

        setSelectedComplaint(null);
        setAllocatedParts([]);
    }
```

(`handleUpdateComplaintStatus`, the third dead function immediately following, operates on the same unused legacy local `complaints`/`setComplaints` demo state — delete it too, in full, up through its closing brace.)

- [ ] **Step 2: Add the new spares-picker state and handlers**

In the same area (near the other modal-related `useState` calls, e.g. right after `modalTech`), add:

```js
    const [spareQuery, setSpareQuery] = useState("");
    const [spareSearchResults, setSpareSearchResults] = useState([]);
    const [spareQuantity, setSpareQuantity] = useState(1);
    const [allocatedItems, setAllocatedItems] = useState([]);

    useEffect(() => {
        const q = spareQuery.trim();
        if (!q) {
            setSpareSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/inventory?search=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (data.success) setSpareSearchResults(data.items);
            } catch {
                setSpareSearchResults([]);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [spareQuery]);

    function addAllocatedItem(item) {
        setAllocatedItems(prev => {
            const exists = prev.find(p => p.itemId === item.id);
            if (exists) {
                return prev.map(p => p.itemId === item.id ? { ...p, quantity: p.quantity + spareQuantity } : p);
            }
            return [...prev, { itemId: item.id, name: item.name, unit: item.unit, quantity: spareQuantity }];
        });
        setSpareQuery("");
        setSpareSearchResults([]);
        setSpareQuantity(1);
    }

    function removeAllocatedItem(itemId) {
        setAllocatedItems(prev => prev.filter(p => p.itemId !== itemId));
    }
```

- [ ] **Step 3: Reset spares state and drop `modalStatus` in `openComplaintDetails`**

Replace:

```js
    const openComplaintDetails = (complaint) => {
        acknowledgeTicketNotification(complaint?.id);
        setSelectedComplaint(complaint);
        setModalTech(complaint?.assignedTechnicianUserId || "");
        setModalStatus(complaint?.status || "UNASSIGNED");
    };
```

with:

```js
    const openComplaintDetails = (complaint) => {
        acknowledgeTicketNotification(complaint?.id);
        setSelectedComplaint(complaint);
        setModalTech(complaint?.assignedTechnicianUserId || "");
        setAllocatedItems([]);
        setSpareQuery("");
        setSpareSearchResults([]);
        setSpareQuantity(1);
    };
```

- [ ] **Step 4: Remove `modalStatus` state and `updateSelectedComplaintStatus`, add `cancelSelectedComplaint`**

Delete the `modalStatus` state declaration (currently `const [modalStatus, setModalStatus] = useState("");`).

Replace `updateSelectedComplaintStatus` (currently):

```js
    async function updateSelectedComplaintStatus(nextStatus) {
        if (!selectedComplaint) return;
        if (["RESOLVED", "CLOSED", "CANCELLED"].includes(String(selectedComplaint.status || "").toUpperCase())) {
            setComplaintError("This ticket is already resolved/closed and cannot be changed.");
            return;
        }
        setModalStatus(nextStatus);
        try {
            const res = await fetch(`/api/complaints/${selectedComplaint.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to update complaint");
            setSelectedComplaint(data.complaint);
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to update complaint");
        }
    }
```

with:

```js
    async function cancelSelectedComplaint() {
        if (!selectedComplaint) return;
        if (!window.confirm("Cancel this ticket? This cannot be undone.")) return;
        setComplaintError("");
        try {
            const res = await fetch(`/api/complaints/${selectedComplaint.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "CANCELLED" }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to cancel ticket");
            setSelectedComplaint(null);
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to cancel ticket");
        }
    }
```

- [ ] **Step 5: Update `assignSelectedComplaint` to send `allocatedItems` and reset them on success**

Replace:

```js
    async function assignSelectedComplaint() {
        if (!selectedComplaint || !modalTech) return;
        if (["RESOLVED", "CLOSED", "CANCELLED"].includes(String(selectedComplaint.status || "").toUpperCase())) {
            setComplaintError("This ticket is already resolved/closed and cannot be reassigned.");
            return;
        }
        setComplaintError("");
        try {
            const res = await fetch(`/api/complaints/${selectedComplaint.id}/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assignedTechnicianUserId: Number(modalTech),
                    assignmentNotes,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to assign complaint");
            setSelectedComplaint(null);
            setModalTech("");
            setAssignmentNotes("");
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to assign complaint");
        }
    }
```

with:

```js
    async function assignSelectedComplaint() {
        if (!selectedComplaint || !modalTech) return;
        if (["RESOLVED", "CLOSED", "CANCELLED"].includes(String(selectedComplaint.status || "").toUpperCase())) {
            setComplaintError("This ticket is already resolved/closed and cannot be reassigned.");
            return;
        }
        setComplaintError("");
        try {
            const res = await fetch(`/api/complaints/${selectedComplaint.id}/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assignedTechnicianUserId: Number(modalTech),
                    assignmentNotes,
                    allocatedItems: allocatedItems.map(item => ({ itemId: item.itemId, quantity: item.quantity })),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to assign complaint");
            setSelectedComplaint(null);
            setModalTech("");
            setAssignmentNotes("");
            setAllocatedItems([]);
            await fetchComplaints();
        } catch (err) {
            setComplaintError(err.message || "Failed to assign complaint");
        }
    }
```

- [ ] **Step 6: Replace the modal JSX — remove status dropdown, add spares picker, add Cancel Ticket button**

Replace this block (currently lines ~3163-3221, the "Ticket Status" select through the footer buttons):

```jsx
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Ticket Status</label>
                                <select
                                    value={modalStatus}
                                    onChange={(e) => updateSelectedComplaintStatus(e.target.value)}
                                    disabled={selectedComplaintIsTerminal}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    {COMPLAINT_STATUS_OPTIONS.map(status => (
                                        <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assign Worker</label>
                                <select
                                    value={modalTech}
                                    onChange={(e) => setModalTech(e.target.value)}
                                    disabled={selectedComplaintIsTerminal}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assignment Notes</label>
                                <textarea
                                    value={assignmentNotes}
                                    onChange={(e) => setAssignmentNotes(e.target.value)}
                                    rows={3}
                                    disabled={selectedComplaintIsTerminal}
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0a649d] disabled:bg-slate-100 disabled:text-slate-400"
                                    placeholder="Optional note for assignment"
                                />
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedComplaint(null)}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Close
                                </button>
                                {!selectedComplaintIsTerminal && (
                                    <button
                                        type="button"
                                        onClick={assignSelectedComplaint}
                                        className="h-10 px-4.5 bg-[#0a649d] text-white rounded-xl text-xs font-semibold hover:bg-[#085282] transition"
                                    >
                                        Save Assignment
                                    </button>
                                )}
                            </div>
```

with:

```jsx
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assign Worker</label>
                                <select
                                    value={modalTech}
                                    onChange={(e) => setModalTech(e.target.value)}
                                    disabled={selectedComplaintIsTerminal}
                                    className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {technicians.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Spares to Allocate (optional)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={spareQuery}
                                        onChange={(e) => setSpareQuery(e.target.value)}
                                        disabled={selectedComplaintIsTerminal}
                                        placeholder="Search inventory item..."
                                        className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                    {spareSearchResults.length > 0 && (
                                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                            {spareSearchResults.map(item => (
                                                <button
                                                    type="button"
                                                    key={item.id}
                                                    onClick={() => addAllocatedItem(item)}
                                                    className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                                                >
                                                    {item.name} <span className="text-slate-400">({item.stockQuantity} {item.unit} in stock)</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Qty</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={spareQuantity}
                                        onChange={(e) => setSpareQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        disabled={selectedComplaintIsTerminal}
                                        className="h-9 w-20 px-2 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-[#0a649d] disabled:bg-slate-100"
                                    />
                                    <span className="text-[10px] text-slate-400">Search and tap an item above to add it at this quantity.</span>
                                </div>
                                {allocatedItems.length > 0 && (
                                    <div className="mt-2.5 space-y-1.5">
                                        {allocatedItems.map(item => (
                                            <div key={item.itemId} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5">
                                                <span className="text-xs font-semibold text-slate-700">{item.name} × {item.quantity} {item.unit}</span>
                                                <button type="button" onClick={() => removeAllocatedItem(item.itemId)} className="text-red-500 text-xs font-bold">Remove</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Assignment Notes</label>
                                <textarea
                                    value={assignmentNotes}
                                    onChange={(e) => setAssignmentNotes(e.target.value)}
                                    rows={3}
                                    disabled={selectedComplaintIsTerminal}
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0a649d] disabled:bg-slate-100 disabled:text-slate-400"
                                    placeholder="Optional note for assignment"
                                />
                            </div>

                            <div className="pt-4 flex gap-2.5 justify-end border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedComplaint(null)}
                                    className="h-10 px-4.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                                >
                                    Close
                                </button>
                                {!selectedComplaintIsTerminal && (
                                    <button
                                        type="button"
                                        onClick={cancelSelectedComplaint}
                                        className="h-10 px-4.5 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 transition"
                                    >
                                        Cancel Ticket
                                    </button>
                                )}
                                {!selectedComplaintIsTerminal && (
                                    <button
                                        type="button"
                                        onClick={assignSelectedComplaint}
                                        className="h-10 px-4.5 bg-[#0a649d] text-white rounded-xl text-xs font-semibold hover:bg-[#085282] transition"
                                    >
                                        Save Assignment
                                    </button>
                                )}
                            </div>
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, log in as admin, open a non-terminal ticket:
1. Confirm the "Ticket Status" dropdown is gone.
2. Type a couple of letters into "Spares to Allocate" — confirm a dropdown of matching inventory items appears; tap one — confirm it's added below with quantity 1; add a second item at quantity 3; confirm both show and are individually removable.
3. Pick a worker and click "Save Assignment" — confirm success (no error banner), and re-open the ticket to confirm `status` is now `ASSIGNED`.
4. Open a different non-terminal ticket, click "Cancel Ticket", confirm the browser confirm-dialog, confirm the ticket now shows a terminal/`CANCELLED` state and the modal's action buttons disappear.

- [ ] **Step 8: Commit**

```bash
git add pages/Admindashboard.jsx
git commit -m "Add admin spares allocation picker to assign modal, replace status dropdown with Cancel Ticket"
```

---

### Task 5: Admindashboard.jsx — remove Spare Parts Approvals tab

**Files:**
- Modify: `pages/Admindashboard.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure removal, done in a separate task/commit from Task 4 since it touches a different region of the same file (the "More Tools > Approvals" subtab, not the assign modal).

- [ ] **Step 1: Remove `materialRequests` state and its fetch/update helpers**

Delete:

```js
    const [materialRequests, setMaterialRequests] = useState([]);
```

Delete:

```js
    const updateMaterialRequestsState = (newRequests) => {
        setMaterialRequests(newRequests);
    };
```

Delete:

```js
    async function fetchMaterialRequests() {
        try {
            const res = await fetch("/api/admin/materials");
            const data = await res.json();
            if (data.success) setMaterialRequests(data.requests || []);
        } catch (err) {
            console.error("Failed to load material requests:", err);
        }
    }
```

In the `useEffect` that currently reads:

```js
    useEffect(() => {
        if (activeTab !== "more") return;
        if (moreSubTab === "inventory") fetchInventoryItems();
        if (moreSubTab === "approvals") fetchMaterialRequests();
    }, [activeTab, moreSubTab]); // eslint-disable-line react-hooks/exhaustive-deps
```

remove the `approvals` line so it becomes:

```js
    useEffect(() => {
        if (activeTab !== "more") return;
        if (moreSubTab === "inventory") fetchInventoryItems();
    }, [activeTab, moreSubTab]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Remove the "approvals" render block**

Delete the entire block from `) : moreSubTab === "approvals" && !moduleIsLive("materialRequests") ? (` through its matching `) : (` (the one that opens the "More Tools" fallback) — i.e. delete both the "waiting for module" variant and the live variant, currently spanning roughly lines 2387-2503. After deletion, the surrounding ternary chain should read directly from whatever the previous `moreSubTab` branch was into the final `) : ( ... More Tools ... )` fallback, with no `approvals`-related branch in between.

- [ ] **Step 3: Remove the "Spare Parts Approvals" nav button**

Delete this block (currently ~lines 2614-2629):

```jsx
                                        {/* Spare Parts Approvals Button */}
                                        <button
                                            onClick={() => openMoreSubTab("approvals")}
                                            className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-[#0a649d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Spare Parts Approvals</p>
                                                    <p className="text-[9px] text-slate-400 mt-0.5">Approve technician material requests for store pickups</p>
                                                </div>
                                            </div>
                                            <ChevronRightIcon className="text-slate-400 h-4.5 w-4.5" />
                                        </button>
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in as admin, open "More Tools" — confirm "Spare Parts Approvals" is gone from the list and no console error appears (no leftover reference to `moreSubTab === "approvals"` or `materialRequests`).

Run: `grep -n "materialRequests\|fetchMaterialRequests\|\"approvals\"" pages/Admindashboard.jsx`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add pages/Admindashboard.jsx
git commit -m "Remove Spare Parts Approvals tab from admin dashboard"
```

---

### Task 6: `lib/moduleAvailability.js` cleanup

**Files:**
- Modify: `lib/moduleAvailability.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `getModuleAvailability()` no longer returns a `materialRequests` key (confirmed unused by Task 5's grep).

- [ ] **Step 1: Remove the `materialRequestCount` computation and `materialRequests` key**

In `getModuleAvailability()`, remove `materialRequestCount` from the destructured `Promise.all` array and its corresponding `firstExistingCount([...])` call, and remove the `materialRequests: state(...)` line from the returned object. The function becomes:

```js
export async function getModuleAvailability() {
  const [
    customerCount,
    amcCount,
    serviceVisitCount,
    scheduleCount,
    activeServicePlanCustomerCount,
    inventoryCount,
    complaintCount,
    technicianCount,
    quotationCount,
  ] = await Promise.all([
    safeCount("elevator_service_customers"),
    safeCount("elevator_service_customers", "UPPER(TRIM(customer_status)) = $1", ["AMC"]),
    safeCount("elevator_service_visits"),
    safeCount("service_schedules"),
    safeCount(
      "elevator_service_customers",
      "UPPER(TRIM(customer_status)) IN ('AMC', 'EMC', 'WARRANTY')"
    ),
    safeCount("inventory_items"),
    safeCount("complaints"),
    safeCount("users", "role = $1", ["worker"]),
    safeCount("quotation_requests"),
  ]);

  const servicePlannerCount = scheduleCount + activeServicePlanCustomerCount;
  const reportsCount = customerCount + serviceVisitCount;
  const storeCount = inventoryCount;

  return {
    dashboard: { enabled: true, count: 1, reason: "Dashboard available" },
    customers: state(customerCount > 0, customerCount, "Customer data available", "Waiting for client customer data"),
    amc: state(amcCount > 0, amcCount, "AMC customers available", "Waiting for AMC customer data"),
    serviceVisits: state(serviceVisitCount > 0, serviceVisitCount, "Service history available", "Waiting for service history data"),
    servicePlanner: state(servicePlannerCount > 0, servicePlannerCount, "Monthly service planning available", "Waiting for service planning data"),
    reports: state(reportsCount > 0, reportsCount, "Reports available from customer/service data", "Waiting for report source data"),
    profile: { enabled: true, count: 1, reason: "Profile available" },
    faceLock: { enabled: true, count: 1, reason: "Face Lock available" },
    users: { enabled: true, count: 1, reason: "User management available" },

    complaints: { enabled: true, count: complaintCount, reason: "DB-backed complaint flow available" },
    quotations: { enabled: true, count: quotationCount, reason: "Quotation and BOQ module available" },
    inventory: state(inventoryCount > 0, inventoryCount, "Inventory data available", "Waiting for client inventory data"),
    technicians: state(technicianCount > 0, technicianCount, "Technician data available", "Waiting for client staff/technician data"),
    store: state(storeCount > 0, storeCount, "Store inventory data available", "Waiting for inventory data"),
    notifications: { enabled: false, count: 0, reason: "Notification data not configured yet" },
    leads: { enabled: false, count: 0, reason: "Leads hidden; quotations are the active sales module" },
    customerPortal: { enabled: false, count: 0, reason: "Customer portal data is not linked yet" },
    technicianJobs: { enabled: true, count: complaintCount, reason: "Worker assigned complaints available" },
  };
}
```

Note `firstExistingCount` (the helper function above `getModuleAvailability`) is still defined but now has no callers — leave it in place (it's a small generic helper, not obviously "dead code" the way the deleted approval endpoints were, and removing it isn't necessary for this task's goal).

- [ ] **Step 2: Manual verification**

Run: `grep -n "materialRequests\|materialRequestCount" lib/moduleAvailability.js pages/Admindashboard.jsx`
Expected: no output.

Run: `npm run dev`, log in as admin, load the dashboard — confirm no console errors (nothing was reading `moduleAvailability.materialRequests` after Task 5).

- [ ] **Step 3: Commit**

```bash
git add lib/moduleAvailability.js
git commit -m "Remove unused materialRequests module-availability gate"
```

---

### Task 7: Techniciandashboard.jsx — remove QR Inventory tab entirely

**Files:**
- Modify: `pages/Techniciandashboard.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — pure removal. `openJobPass`/"Generate Store Pass QR" and everything else in the file is untouched.

- [ ] **Step 1: Remove state**

Delete:

```js
    // Form inputs for Material Request (real inventory item search)
    const [requestForm, setRequestForm] = useState({
        complaintId: "",
        itemQuery: "",
        itemId: null,
        itemName: "",
        quantity: 1,
        reason: ""
    });
    const [itemSearchResults, setItemSearchResults] = useState([]);
    const [submittingRequest, setSubmittingRequest] = useState(false);
```

Delete:

```js
    // Material Request List — populated from real /api/worker/materials calls
    const [materialRequests, setMaterialRequests] = useState([]);
```

- [ ] **Step 2: Remove `refreshMaterialRequests` and its call site**

Delete:

```js
    // Material requests live in Postgres, scoped per job — fetch and merge
    // across every active (non-completed) job for the "QR Inventory" feed.
    async function refreshMaterialRequests(jobList) {
        const activeJobs = (jobList || jobs).filter(j => j.status !== "Completed");
        const results = await Promise.all(activeJobs.map(async (job) => {
            try {
                const res = await fetch(`/api/worker/materials?complaintId=${job.dbId}`);
                const data = await res.json();
                if (!data.success) return [];
                return data.requests.map(r => ({ ...r, jobLabel: job.id }));
            } catch {
                return [];
            }
        }));
        setMaterialRequests(results.flat());
    }
```

In `fetchAssignedComplaints`, remove the call to it:

```js
    async function fetchAssignedComplaints() {
        setJobsError("");
        try {
            const res = await fetch("/api/worker/assigned-complaints?page=1&pageSize=50");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to load assigned complaints");
            const mapped = (data.complaints || []).map(mapAssignedComplaintToJob);
            setJobs(mapped);
        } catch (err) {
            setJobsError(err.message || "Failed to load assigned complaints");
        }
    }
```

(i.e. delete the `refreshMaterialRequests(mapped);` line.)

- [ ] **Step 3: Remove the debounced item-search effect**

Delete:

```js
    // Debounced real inventory item search for the material request form
    useEffect(() => {
        const query = requestForm.itemQuery.trim();
        if (!query) {
            setItemSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/inventory?search=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.success) setItemSearchResults(data.items);
            } catch {
                setItemSearchResults([]);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [requestForm.itemQuery]);
```

- [ ] **Step 4: Remove `handleMaterialRequestSubmit` and `pendingMaterialsCount`**

Delete:

```js
    // Material Request submission — posts a real request against a real job + inventory item
    const handleMaterialRequestSubmit = async (e) => {
        e.preventDefault();
        if (!requestForm.complaintId) {
            alert("Please select which job this request is for.");
            return;
        }
        if (!requestForm.itemId) {
            alert("Please search for and select a real inventory item.");
            return;
        }
        if (!requestForm.reason.trim()) {
            alert("Please provide the reason for request.");
            return;
        }

        setSubmittingRequest(true);
        try {
            const res = await fetch("/api/worker/materials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    complaintId: requestForm.complaintId,
                    items: [{ itemId: requestForm.itemId, quantity: parseInt(requestForm.quantity) || 1 }],
                }),
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.message || "Failed to submit request.");
                return;
            }
            setRequestForm({ complaintId: "", itemQuery: "", itemId: null, itemName: "", quantity: 1, reason: "" });
            setItemSearchResults([]);
            await refreshMaterialRequests();
            alert("Spare parts request logged successfully. Waiting for administrator approval.");
        } finally {
            setSubmittingRequest(false);
        }
    };
```

Delete:

```js
    const pendingMaterialsCount = materialRequests.filter(m => m.status === "Pending").length;
```

- [ ] **Step 5: Remove the "Request Spares" quick-action button**

Delete this block from the dashboard quick-actions grid:

```jsx
                                    <button
                                        onClick={() => setActiveTab("inventory")}
                                        className="h-14.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 px-4 active:scale-95 transition text-left cursor-pointer"
                                    >
                                        <div className="h-9.5 w-9.5 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                            <InventoryIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10.5px] font-black text-slate-800 leading-none block">Request Spares</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">Inventory Portal</span>
                                        </div>
                                    </button>
```

- [ ] **Step 6: Remove the QR Inventory tab content block**

Delete the entire block from `{activeTab === "inventory" && (` through its matching closing `)}`, i.e. from:

```jsx
                    {activeTab === "inventory" && (
                        <div className="p-4 space-y-6 animate-in fade-in duration-200">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">QR Inventory</h1>
```

through:

```jsx
                        </div>
                    )}

                    {/* VIEW: NOTIFICATIONS TAB */}
```

(delete everything up to but not including the `{/* VIEW: NOTIFICATIONS TAB */}` comment and the `{activeTab === "notifications" && (` line after it).

- [ ] **Step 7: Remove the bottom-nav "Inventory" button**

Delete:

```jsx
                    <button
                        onClick={() => handleTabChange("inventory")}
                        className={`flex flex-col items-center justify-center flex-1 py-1 ${activeTab === "inventory" ? "text-[#59e0ff]" : "text-slate-400"}`}
                    >
                        <InventoryIcon className="h-5.5 w-5.5 mb-0.5" />
                        <span className="text-[9px] font-black tracking-tight leading-none">Inventory</span>
                    </button>
```

- [ ] **Step 8: Simplify the dead notification-redirect branch**

In the notifications list's `onClick`, currently:

```jsx
                                        <div 
                                            key={n.id} 
                                            onClick={() => {
                                                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                                                if (n.type === "approval") {
                                                    setActiveTab("inventory");
                                                }
                                            }}
```

remove the now-dead branch so it reads:

```jsx
                                        <div 
                                            key={n.id} 
                                            onClick={() => {
                                                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                                            }}
```

- [ ] **Step 9: Manual verification**

Run: `grep -n "requestForm\|itemSearchResults\|submittingRequest\|materialRequests\|api/worker/materials\|\"inventory\"" pages/Techniciandashboard.jsx`
Expected: no output (all removed; note `InventoryIcon`'s own `function InventoryIcon(...)` definition is left in place as unused dead code per this task's scope — harmless, not referenced by anything after this task).

Run: `npm run dev`, log in as a worker:
1. Confirm the bottom nav only shows Dashboard/Jobs/Alerts/Profile (4 items, no "Inventory").
2. Confirm the dashboard quick-actions grid no longer shows "Request Spares".
3. Open an assigned job, confirm "Generate Store Pass QR" still works and renders a QR image.

- [ ] **Step 10: Commit**

```bash
git add pages/Techniciandashboard.jsx
git commit -m "Remove worker self-service QR Inventory tab from technician dashboard"
```

---

### Task 8: `lib/quotations.js` — return full cost breakdown

**Files:**
- Modify: `lib/quotations.js`

**Interfaces:**
- Produces: `getQuotationById`/`listQuotations` rows now include `commonMaterial`, `doorMaterial`, `cabinMaterial`, `motorMaterial`, `ropeCost`, `railCost`, `additionalLfCost`, `labourTransport`, `taxPercent`, `marginPercent`, `discountAmount` (all `number | null`) alongside the existing `finalPrice`/`customerPrice`. New `getQuotationStatus(id)` returns `string | null`. Consumed by Task 9 and Task 10.

- [ ] **Step 1: Add a `numberOrNull` helper and extend `normalizeQuotationRow`**

Add near the top of `lib/quotations.js` (next to `money`):

```js
function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}
```

Replace `normalizeQuotationRow` with:

```js
function normalizeQuotationRow(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    quotationNo: row.quotation_no,
    serialNo: row.serial_no,
    status: row.status,
    customerName: row.customer_name,
    address: row.address,
    mobileNo: row.mobile_no,
    wellWidth: Number(row.well_width),
    wellDepth: Number(row.well_depth),
    noOfFloors: row.no_of_floors,
    noOfPassenger: row.no_of_passenger,
    doorType: row.door_type,
    cabinType: row.cabin_type,
    motorType: row.motor_type,
    headRoom: row.head_room,
    doorOpening: row.door_opening,
    commonMaterial: numberOrNull(row.common_material),
    doorMaterial: numberOrNull(row.door_material),
    cabinMaterial: numberOrNull(row.cabin_material),
    motorMaterial: numberOrNull(row.motor_material),
    ropeCost: numberOrNull(row.rope_cost),
    railCost: numberOrNull(row.rail_cost),
    additionalLfCost: numberOrNull(row.additional_lf_cost),
    labourTransport: numberOrNull(row.labour_transport),
    taxPercent: numberOrNull(row.tax_percent),
    marginPercent: numberOrNull(row.margin_percent),
    discountAmount: numberOrNull(row.discount_amount),
    finalPrice: numberOrNull(row.final_price),
    customerPrice: numberOrNull(row.customer_price),
    createdByUsername: row.created_by_username,
    generatedByUsername: row.generated_by_username,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 2: Extend the SELECTs in `getQuotationById` and `listQuotations`**

In `getQuotationById`, replace:

```js
    SELECT q.*, c.final_price, c.customer_price
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
    WHERE q.id = $1
    LIMIT 1
```

with:

```js
    SELECT q.*, c.common_material, c.door_material, c.cabin_material, c.motor_material,
           c.rope_cost, c.rail_cost, c.additional_lf_cost, c.labour_transport,
           c.tax_percent, c.margin_percent, c.discount_amount, c.final_price, c.customer_price
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
    WHERE q.id = $1
    LIMIT 1
```

In `listQuotations`, replace both occurrences (the `count` query stays as-is; only the `rows` query's SELECT changes) of:

```js
    SELECT q.*, c.final_price, c.customer_price
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
    ${where}
    ORDER BY q.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
```

with:

```js
    SELECT q.*, c.common_material, c.door_material, c.cabin_material, c.motor_material,
           c.rope_cost, c.rail_cost, c.additional_lf_cost, c.labour_transport,
           c.tax_percent, c.margin_percent, c.discount_amount, c.final_price, c.customer_price
    FROM quotation_requests q
    LEFT JOIN quotation_cost_breakdowns c ON c.quotation_id = q.id
    ${where}
    ORDER BY q.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
```

- [ ] **Step 3: Add `getQuotationStatus`**

Add this new export anywhere after `ensureQuotationTables`:

```js
export async function getQuotationStatus(id) {
  await ensureQuotationTables();
  const result = await query("SELECT status FROM quotation_requests WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0]?.status || null;
}
```

- [ ] **Step 4: Run the existing quotations test to confirm nothing broke**

Run: `node scripts/quotations.test.mjs`
Expected: prints `quotations tests passed` (this file only tests `buildQuotationNo`/`calculateQuotationCost`/`normalizeQuotationInput`, none of which were touched — this just guards against a typo breaking the module's imports/exports).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, then as an admin with BOQ permission, generate a BOQ for a `DRAFT` quotation, then:

```bash
curl -s "http://localhost:3000/api/quotations?page=1&pageSize=5" -b "<session cookie>" | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).quotations[0]))"
```

Expected: the returned quotation object includes non-null `commonMaterial`, `doorMaterial`, etc. matching what was entered when generating.

- [ ] **Step 6: Commit**

```bash
git add lib/quotations.js
git commit -m "Return full BOQ cost breakdown from quotation queries, add getQuotationStatus"
```

---

### Task 9: `generate-boq.js` — branch permission/audit on edit vs first-generation, lock terminal statuses

**Files:**
- Modify: `pages/api/quotations/[id]/generate-boq.js`

**Interfaces:**
- Consumes: `getQuotationStatus(id)` from Task 8; `canEditBoq`, `canGenerateBoq`, `isBoqAdmin` from `lib/quotationPermissions.js` (all already exist, unchanged).
- Produces: same endpoint contract as before (`POST /api/quotations/[id]/generate-boq` with cost fields in body, returns `{success, quotation, costBreakdown}`), now also enforced server-side against `ACCEPTED`/`REJECTED`/`CONVERTED_TO_CUSTOMER`. Consumed by Task 10.

- [ ] **Step 1: Replace the handler**

Replace the full contents of `pages/api/quotations/[id]/generate-boq.js` with:

```js
import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { canEditBoq, canGenerateBoq, isBoqAdmin } from "@/lib/quotationPermissions";
import { generateBoqForQuotation, getQuotationStatus } from "@/lib/quotations";

const LOCKED_STATUSES = new Set(["ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER"]);

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("BOQ audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });

  const currentStatus = await getQuotationStatus(req.query.id);
  if (!currentStatus) return res.status(404).json({ success: false, message: "Quotation not found." });

  const isEdit = currentStatus !== "DRAFT";
  if (isEdit && LOCKED_STATUSES.has(currentStatus)) {
    return res.status(400).json({ success: false, message: "This quotation is locked and can no longer be edited." });
  }

  const hasPermission = await isBoqAdmin(actor);
  const allowed = isEdit ? canEditBoq(actor, hasPermission) : canGenerateBoq(actor, hasPermission);
  if (!allowed) {
    return res.status(403).json({ success: false, message: "Only selected BOQ admins can edit BOQ pricing." });
  }

  try {
    const result = await generateBoqForQuotation({ quotationId: req.query.id, actor, costs: req.body || {} });
    await safeAudit({
      req,
      actor,
      entityType: "QUOTATION",
      entityId: req.query.id,
      action: isEdit ? "BOQ_EDITED" : "BOQ_GENERATED",
      newValues: result.costBreakdown,
      changedFields: ["costBreakdown", "status"],
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to generate BOQ." });
  }
}
```

- [ ] **Step 2: Manual verification**

With a `DRAFT` quotation, POST to `generate-boq` as before — expect `200` and audit action `BOQ_GENERATED` (check via whatever audit log viewer/table the project uses, e.g. `SELECT action FROM audit_logs WHERE entity_id = '<id>' ORDER BY created_at DESC LIMIT 1`).

POST again to the same quotation (now `BOQ_GENERATED`) with different cost values — expect `200`, the quotation's `finalPrice` reflects the new numbers, and the latest audit row's `action` is `BOQ_EDITED`.

Manually set a test quotation's status to `ACCEPTED` (or use one already in that state) and POST to `generate-boq` — expect `400` with message `"This quotation is locked and can no longer be edited."`.

- [ ] **Step 3: Commit**

```bash
git add "pages/api/quotations/[id]/generate-boq.js"
git commit -m "Branch BOQ generate/edit permission and audit action on quotation status"
```

---

### Task 10: `pages/admin/quotations.jsx` — Edit BOQ button + pre-fill

**Files:**
- Modify: `pages/admin/quotations.jsx`

**Interfaces:**
- Consumes: `POST /api/quotations/[id]/generate-boq` (Task 9, same contract); quotation rows now carry the 11 cost fields (Task 8).

- [ ] **Step 1: Add an `extractCosts` helper near `initialCosts`**

After the `initialCosts` constant, add:

```js
function extractCosts(q) {
  return {
    commonMaterial: q.commonMaterial ?? 0,
    doorMaterial: q.doorMaterial ?? 0,
    cabinMaterial: q.cabinMaterial ?? 0,
    motorMaterial: q.motorMaterial ?? 0,
    ropeCost: q.ropeCost ?? 0,
    railCost: q.railCost ?? 0,
    additionalLfCost: q.additionalLfCost ?? 0,
    labourTransport: q.labourTransport ?? 75000,
    taxPercent: q.taxPercent ?? 18,
    marginPercent: q.marginPercent ?? 15,
    discountAmount: q.discountAmount ?? 0,
  };
}
```

- [ ] **Step 2: Fix `onGenerate` to reset costs, add `onEditBoq`**

Replace:

```jsx
              <QuotationCard
                key={q.id}
                quotation={q}
                index={i}
                canGenerate={canGenerate}
                onGenerate={() => setSelected(q)}
                onViewBoq={() => setBoqView(q)}
                onShared={setNotice}
              />
```

with:

```jsx
              <QuotationCard
                key={q.id}
                quotation={q}
                index={i}
                canGenerate={canGenerate}
                onGenerate={() => { setSelected(q); setCosts(initialCosts); }}
                onEditBoq={() => { setSelected(q); setCosts(extractCosts(q)); }}
                onViewBoq={() => setBoqView(q)}
                onShared={setNotice}
              />
```

- [ ] **Step 3: Add the "Edit BOQ" button to `QuotationCard`**

In the `QuotationCard` function, change the signature to accept `onEditBoq`:

```js
function QuotationCard({ quotation, index, canGenerate, onGenerate, onEditBoq, onViewBoq, onShared }) {
```

Replace:

```jsx
          {canGenerate && quotation.status === "DRAFT" && (
            <button
              onClick={onGenerate}
              className="h-9 rounded-xl bg-[#0a649d] px-3 text-xs font-bold text-white active:scale-95 transition"
            >
              Generate BOQ
            </button>
          )}
```

with:

```jsx
          {canGenerate && quotation.status === "DRAFT" && (
            <button
              onClick={onGenerate}
              className="h-9 rounded-xl bg-[#0a649d] px-3 text-xs font-bold text-white active:scale-95 transition"
            >
              Generate BOQ
            </button>
          )}
          {canGenerate && ["BOQ_GENERATED", "CALCULATED", "SENT"].includes(quotation.status) && (
            <button
              onClick={onEditBoq}
              className="h-9 rounded-xl border border-[#0a649d]/30 px-3 text-xs font-bold text-[#0a649d] active:scale-95 transition"
            >
              Edit BOQ
            </button>
          )}
```

- [ ] **Step 4: Distinguish the modal title for edit vs generate**

Replace:

```jsx
        <Modal title={`Generate BOQ – ${selected.quotationNo}`} onClose={() => !submitting && setSelected(null)}>
```

with:

```jsx
        <Modal title={`${selected.status === "DRAFT" ? "Generate" : "Edit"} BOQ – ${selected.quotationNo}`} onClose={() => !submitting && setSelected(null)}>
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in as a BOQ admin:
1. On a `DRAFT` quotation, confirm only "Generate BOQ" shows (no "Edit BOQ").
2. Generate its BOQ — confirm it now shows both "View BOQ" and "Edit BOQ" (no more "Generate BOQ").
3. Click "Edit BOQ" — confirm the cost fields are pre-filled with the values just entered (not reset to `0`/defaults), change one (e.g. `taxPercent`), submit — confirm success, and "View BOQ" now shows the updated total.
4. Find/create a quotation with status `ACCEPTED` or `CONVERTED_TO_CUSTOMER` — confirm "Edit BOQ" does not appear for it.

- [ ] **Step 6: Commit**

```bash
git add pages/admin/quotations.jsx
git commit -m "Add Edit BOQ action with pre-filled pricing to admin quotations page"
```

---

## Final Verification

- [ ] Run all existing plain-script tests to confirm nothing else broke:

```bash
for f in scripts/*.test.mjs; do node "$f" || echo "FAILED: $f"; done
```

Expected: every file prints its own "... tests passed" line, no `FAILED` lines.

- [ ] Run `npm run build` to confirm the whole app still compiles (catches any leftover reference to a deleted function/file across all the manual edits above):

```bash
npm run build
```

Expected: build succeeds with no errors (warnings about unrelated pre-existing issues are fine).

- [ ] Full manual walkthrough (per the design spec's Testing section): assign a job with 2+ spares via the new picker → confirm `material_requests` rows created with `status='approved'` → as the assigned worker, generate the Store Pass QR → as a storekeeper, scan it → confirm the admin-picked items appear pre-filled and are still freely editable → issue → confirm stock decrements and `inventory_transactions` logs correctly. Assign a job with zero spares picked → confirm assignment still succeeds. Cancel a ticket via the new button. Generate then edit a BOQ, confirm the audit trail shows both `BOQ_GENERATED` and `BOQ_EDITED`.
