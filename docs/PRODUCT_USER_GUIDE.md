# Amardip Lifts ERP — Product & Process Guide

This guide explains **what the product does and how to use it**, portal by portal and process by process. It's written for the client team (office staff, technicians, storekeepers, and customers) and for anyone training them.

Amardip Lifts ERP is a single web app with **four separate logged-in experiences ("portals")**, all sharing one database:

| Portal | Who uses it | Login URL | What it's for |
|---|---|---|---|
| **Staff / Admin Portal** | Office admin, managers, front office, superadmin | `/Adminlogin` | Runs the whole business: customers, AMC contracts, service history, scheduling, tickets, quotations, reports, staff |
| **Customer Portal** | The client's own customers | `/Customerlogin` | Customers view their lift/AMC info and raise service tickets |
| **Technician Portal** | Field service engineers | `/Technicianlogin` | Technicians see assigned jobs, request/collect spares, complete jobs with a report and customer sign-off |
| **Store Portal** | Storekeeper(s) | `/Storelogin` | Manages spare-parts stock, hands out parts against a technician's job via QR scan |

Opening the site's home page (`/`) shows a portal picker; each role is also automatically redirected to its own dashboard after login.

---

## 1. Logging in and roles

Every login goes through one shared login flow: username + password → server checks the `users` table → a signed session cookie (`auth_token`) is issued → the user is redirected based on their role.

| Role | Redirects to |
|---|---|
| `superadmin`, `admin`, `manager` | `/Admindashboard` (Staff Portal) |
| `front_office` | `/Admindashboard` (Staff Portal, reduced permissions — see Section 3.9) |
| `customer` | `/Customerdashboard` |
| `worker` | `/Techniciandashboard` |
| `storekeeper` | `/Storedashboard` |

**Face Lock:** Admin users can additionally register their device's fingerprint/Face ID as a "Face Lock" login (via Profile → Setup Face Lock), so they don't need to type their password every time. If Face Lock isn't set up or fails, password login always still works.

---

## 2. The big picture: how a service ticket flows end-to-end

This is the core operational loop of the whole system — worth understanding before diving into each portal:

```
1. RAISE
   Customer raises a complaint/ticket (or office staff logs one manually)
        │
        ▼
2. ASSIGN
   Office admin opens the ticket, picks a technician, optionally
   pre-selects spare parts the job will likely need
        │  (ticket status becomes ASSIGNED; technician is notified)
        ▼
3. TECHNICIAN PICKS UP THE JOB
   Technician sees the job on their dashboard, travels to site,
   generates a QR "Store Pass" for this job if parts are needed
        │
        ▼
4. STORE ISSUES PARTS
   Storekeeper scans the technician's QR code, sees any
   admin-preselected parts (editable), adds/removes items freely,
   and issues them — stock is deducted and logged
        │
        ▼
5. TECHNICIAN COMPLETES THE JOB
   Technician fills in a checklist, work report, parts used,
   an optional voice note (auto-translated), and gets the
   customer's name + signature on-site
        │  (ticket status becomes RESOLVED)
        ▼
6. EVERYONE IS NOTIFIED
   Admin/office is notified the job is done; the customer is
   notified if their account is linked
```

Every step writes to a real database table, and every status change is timestamped. `RESOLVED`, `CLOSED`, and `CANCELLED` are **terminal** — a ticket in one of these states can no longer be reassigned or edited from the admin ticket modal.

---

## 3. Staff / Admin Portal (`/Admindashboard`)

This is the operational hub. It's built as a mobile-first app shell — navigation happens via bottom tabs and in-app cards, not separate browser pages, so it feels like a single mobile app rather than a desktop website (though it works fine on a desktop browser too, with table layouts).

### 3.1 Dashboard home
The landing screen shows KPI cards (Total Customers, Active AMCs, Total Services, Upcoming Services), a Quotations banner (for users with quotation access), recent complaints, and today's activity. Cards route to their full module in-app — nothing opens a new browser tab.

### 3.2 Customers
- Full searchable, paginated list of every elevator customer on contract.
- Tap any customer to open their **Customer Detail** page: lift technical specs (motor/controller/drive/door make, floors, capacity), AMC/Warranty dates with color-coded status (green = active, amber = due soon, red = expired), and their **complete service visit history**.
- **Edit Customer**: update any customer field (contact info, address, technical specs, status) — every change is written to the audit log.
- **Renew AMC**: dedicated renewal form with quick-pick buttons (1 Year AMC, 6 Months AMC, Warranty) that auto-fill start/end dates; also accepts a renewal amount and notes. Renewing updates the customer's status/AMC dates everywhere at once (dashboard KPIs, AMC list, reports, upcoming-service calculations).
- **View Change History**: full audit trail of who changed what on this customer and when.

### 3.3 AMC (Active Contracts)
A filtered view of just the customers currently on AMC — same search/pagination/detail-navigation as the Customers list, scoped to `customer_status = AMC`.

### 3.4 Service Visits
The complete historical service ledger (every past visit, whether from AMC, EMC, warranty, or a one-off call) — searchable by customer, technician, service type, and date range. Shows condition checks recorded per visit (motor, brake, rope, sensors, etc.), payment collected, and technician name(s). Visits without a matched customer are flagged as "Unlinked" rather than hidden.

### 3.5 Upcoming Services (Service Planner)
Answers "who needs a visit this month, and has it happened yet?":
- **Scheduled** — visits already planned this month with a date/technician.
- **To Be Scheduled** — active AMC/EMC/Warranty customers who haven't had a service visit *or* a schedule entry this month yet.
- Tapping **Schedule Service** on a customer books it for the current month (prevents accidentally double-booking the same customer/month).

### 3.6 Complaints / Tickets
The ticket queue described in Section 2. From here office staff can:
- Log a manual ticket on a customer's behalf.
- Open a ticket and **assign a technician** — optionally searching and adding spare parts expected for the job right in the assignment form (this pre-fills, but does not lock, what the storekeeper sees later).
- **Cancel Ticket** — the only manual status override available (for mistakenly created tickets); all other status changes happen automatically as the job moves through assignment → completion.
- See live badges on each technician showing their currently assigned ticket count.

### 3.7 Quotations & BOQ Generator
For preparing a formal lift price quote for a prospective customer:
1. **Create Quotation** — enter customer details, wall width/depth, floors, passenger capacity, door/cabin/motor type, head room, and door opening from fixed dropdown option sets matching the client's actual product configurations.
2. **Generate BOQ** — the system calculates material cost, tax, labour/transport, margin, and any discount into a final customer price, entirely server-side (not editable in the browser by a non-authorized user).
3. **Edit BOQ** — pricing can be revisited and adjusted later (except once a quotation is Accepted/Rejected/Converted) — useful when negotiating.
4. **Share to WhatsApp** — one tap sends a formatted summary (quotation number, spec, final price) straight to the customer's WhatsApp number.
5. **Print / View** — a print-friendly quotation view for records or in-person handoff.

Only **superadmin** and up to **6 designated BOQ admins** (set on `/admin/boq-permissions`) can create quotations, generate/edit BOQ pricing. **Front office** staff can view, print, and WhatsApp-share quotations already generated by an admin, but cannot create/price them or see drafts. This is enforced on the server, not just hidden in the UI.

### 3.8 Reports
Operational reporting, all computed live from real data (no manual report-building needed):
- **AMC / Warranty Expiry** — due this month, due in 30 days, already expired.
- **Monthly Service Due** — to-be-scheduled / scheduled / missed / completed counts for the current month.
- **Customer Data Quality** — missing mobile numbers, missing city, missing AMC dates, duplicate codes — helps the office clean up customer records.
- **Service Data Quality** — unlinked visits, missing service type/technician, etc.
- **Tickets & Worker Completion** — open/assigned/resolved ticket counts and the latest technician completion reports with customer sign-off names.
- Quick-jump buttons drop straight into the underlying Customers/AMC/Service Visits/Upcoming Services list.

### 3.9 Staff / Users
- Directory of everyone with a login (admins, front office, technicians, storekeepers, customers), pulled from real data.
- **Onboard User** (superadmin only) — create a new login for a new staff member with a chosen role.
- **Reset Password** (superadmin only) — issue a new password for a locked-out user.
- Roles available: `admin`, `manager`, `worker`, `customer`, `front_office` (plus `superadmin` and `storekeeper`, seeded separately).
- **`front_office`** is a reduced-permission office role: can view customers/AMC/complaints and assign technicians, and view (not create) quotations, but cannot onboard users or reset passwords.

### 3.10 Notifications & Push
Any portal user can enable browser/phone push notifications from their Profile screen (**Enable Push Notifications**), then **Test** it to confirm their device receives one. Once enabled, the system automatically pushes for:
- A customer raises a ticket → office/admin roles notified.
- Admin assigns a ticket to a technician → that technician notified.
- Technician completes a job → office/admin roles notified, and the customer too (if their account is linked to that job).

### 3.11 Modules still filling with client data
A handful of areas (general inventory browsing beyond the store-issue flow, some legacy dashboard widgets) automatically show a **"Coming Soon / Waiting for client data"** placeholder instead of any fake/demo numbers, until the relevant real data has been imported (see the Installation Guide, Section 4). Nothing fabricated is ever shown as if it were real.

---

## 4. Customer Portal (`/Customerdashboard`)

What a customer can do after logging in:
- **Home summary** — their lift/AMC snapshot.
- **Raise a ticket** — describe an issue (including a dedicated **Emergency** option for urgent breakdowns), which immediately creates a real ticket the office can see and assign.
- **Track tickets** — see status progress (Unassigned → Assigned → In Progress → Resolved).
- **AMC / Contract view** — a branded summary of their current contract.
- **Documents** — a branded agreement/template view.
- **Support message / profile / notifications.**

Customers only ever see **their own** tickets — enforced server-side, not just hidden in the UI.

---

## 5. Technician Portal (`/Techniciandashboard`)

What a field technician does day-to-day:
1. **See assigned jobs** — only jobs specifically assigned to them by the office; there's no "accept/reject" step — being assigned means it's their job.
2. **Generate Store Pass QR** — for a job that needs spare parts, the technician taps to generate a QR code on their screen. This QR is a signed, tamper-proof token tied to that specific job and technician; it automatically stops working once the job is closed or reassigned — no manual expiry needed.
3. **Show the QR to the storekeeper** (in person, or the storekeeper's camera scans the phone screen).
4. **Complete the job**, recording:
   - Problem identified, work performed, spare parts used
   - A structured checklist and resolution status
   - Location check-in (GPS-based — no selfie/Face ID required)
   - Photo evidence (optional, not a blocker)
   - **Customer representative name + signature**, with consent, captured on-site
   - An optional **voice note** — spoken in Telugu or Hindi, automatically transcribed and translated to English for the office record
5. Once submitted, the ticket becomes `RESOLVED` and can't be duplicated or re-submitted.

---

## 6. Store / Inventory Portal (`/Storedashboard`)

What the storekeeper does:
1. **Scan a technician's Store Pass QR** (real camera-based scanning) — or enter the code manually if camera access isn't available.
2. The scan pulls up the job and any spare parts the admin pre-selected when assigning it — **fully editable**: the storekeeper can add, remove, or change quantities freely before handing parts over. Pre-selection is a suggestion, never a hard constraint.
3. **Issue** the final item list — stock is deducted from `inventory_items` and every line is written to a permanent audit ledger (`inventory_transactions`), tagged with who issued it, which job, and which technician received it. Insufficient stock on any single line blocks just that line — nothing partially commits.
4. **Return material** — parts a technician brings back get logged as a return, adding stock back.
5. **Transaction ledger** — a full, searchable history of every stock movement (receipt, issue, return, manual adjustment).
6. Storekeepers (and admin/superadmin/manager) can also add brand-new inventory items and make manual stock adjustments (e.g. after a physical stock count).

---

## 7. Roles & permissions at a glance

| Capability | superadmin | admin/manager | front_office | worker | storekeeper | customer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| View/edit customers, AMC, renew contracts | ✅ | ✅ | view/assign only | ❌ | ❌ | own record only |
| View service visits / reports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign tickets, pick spares at assignment | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Raise a ticket | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own only) |
| See/complete own assigned jobs | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Scan/issue/return store inventory | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Create quotation / generate / edit BOQ pricing | ✅ | if selected BOQ admin | ❌ | ❌ | ❌ | ❌ |
| View/print/share generated quotations | ✅ | if selected BOQ admin | ✅ (no drafts) | ❌ | ❌ | ❌ |
| Onboard users / reset passwords | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage BOQ admin permissions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

All of the above is enforced on the API/server side (`getUserFromRequest` role checks), not just by hiding buttons in the UI.

---

## 8. Quick process cheat-sheets

**"A customer is calling with a breakdown"**
Office logs a ticket (or the customer raises it themselves) → assign to nearest available technician, add likely spares → technician heads out, scans store pass if parts needed → technician completes with signature → done, customer notified.

**"AMC is expiring next month"**
Reports → AMC/Warranty Expiry Report shows it → open the customer → Renew AMC → pick 1 Year AMC / 6 Months / Warranty → confirm dates and amount → save. Dashboard, AMC list, and reports all reflect it immediately.

**"A prospect wants a price for a new lift"**
Quotations → Create Quotation → fill in wall/floor/passenger/door/cabin/motor spec → Generate BOQ → review calculated price → Share to WhatsApp or Print. Come back later and Edit BOQ if the price needs adjusting before it's accepted.

**"This customer hasn't had their monthly service yet"**
Upcoming Services shows it under To Be Scheduled → Schedule Service → pick a date/technician → it becomes a normal assigned ticket flow (Section 2) once due.
