# Amardip Lifts ERP — Client Installation & Setup Guide

This guide walks a new client (or the team setting the app up for a client) through getting **Amardip Lifts ERP** running from a fresh checkout to a live, usable production app with real data and mobile-installable portals.

The product is a Next.js 16 web app with four separate login portals (Admin/Office, Customer, Technician, Store/Inventory), backed by a single PostgreSQL database.

---

## 1. What you need before you start

| Requirement | Notes |
|---|---|
| Node.js | Version compatible with Next.js 16.2.9 (Node 18.18+ or Node 20+ recommended) |
| A PostgreSQL database | Any standard Postgres works (Neon, Supabase, RDS, etc.). You only need a `DATABASE_URL` connection string. |
| A GitHub repository | Vercel deploys from GitHub. |
| A Vercel account | This project already ships with `vercel.json` (Singapore region, 15s function timeout) — Vercel is the intended host. |
| Client's real data files | Customer/service Excel exports, staff list Excel (`AMARDIP WORKERS.xlsx`), inventory list — needed for the data-import scripts in Step 5. |

---

## 2. Get the code and install dependencies

```bash
git clone <the client's github repo url>
cd "amardipelevators erp"
npm install
```

---

## 3. Configure environment variables

Create a `.env.local` file in the project root (never commit this file). These are the variables the app reads:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. `lib/db.js` uses this for every DB query in the app. |
| `JWT_SECRET` | Yes | Signs the `auth_token` login cookie. Must be a long random string in production — never rely on any local fallback secret. |
| `WEBAUTHN_RP_NAME` | For Face Lock | Display name shown during Face Lock (Passkey) setup, e.g. `Amardip Lifts ERP`. |
| `WEBAUTHN_RP_ID` | For Face Lock | The exact production domain, no protocol, e.g. `amardip-erp.vercel.app`. Must match the domain the app is actually served from. |
| `WEBAUTHN_ORIGIN` | For Face Lock | Full origin URL, e.g. `https://amardip-erp.vercel.app`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | For push notifications | Public VAPID key for browser push. |
| `VAPID_PRIVATE_KEY` | For push notifications | Private VAPID key (server-side only, keep secret). |
| `VAPID_EMAIL` / `VAPID_SUBJECT` | For push notifications | Contact email required by the push standard, e.g. `mailto:admin@example.com`. |
| `VOICE_NOTES_PROVIDER` | Optional | Controls technician voice-note translation. Leave unset to default to the free MyMemory provider. Other values: `groq` (needs `GROQ_API_KEY`), `openai` (needs `OPENAI_API_KEY`). |
| `MYMEMORY_EMAIL` | Optional | Raises the free MyMemory translation daily limit to 1000 words/IP. |

**Generating VAPID keys** (only needed if you want push notifications):
```bash
npx web-push generate-vapid-keys
```

If push env vars are left empty, push notifications simply soft-fail — the rest of the app keeps working normally.

**Face Lock (Passkey/WebAuthn) domain rule:** the RP ID and Origin must exactly match the one stable production URL the client will actually use (e.g. `amardip-erp.vercel.app/Adminlogin`). Do not use a random Vercel preview URL — passkeys registered against one domain will not work on another, and will need re-registration if the domain later changes.

---

## 4. Set up the database (run once, in order)

All scripts read `.env.local` automatically and are safe to re-run (they check-before-create/upsert, so re-running does not duplicate data).

**Step 4.1 — Core tables + default login accounts**
```bash
node scripts/setup-db.js
```
This creates the `users` table and seeds default accounts (see Section 8 for the full list) plus the base schema the rest of the app depends on. Every other table used by the app (customers, service visits, complaints, quotations, inventory, service schedules, passkeys, audit log, push subscriptions) is created automatically and safely the first time its feature is used — but for a clean production rollout, run the imports below explicitly so real data is there from day one.

**Step 4.2 — Import the client's elevator customer & service history data**
This is the client's real customer/AMC/service Excel export mapped into `elevator_service_customers` and `elevator_service_visits`. If this hasn't been imported yet for this client, that import needs to be run before the Customers, AMC, Service Visits, Upcoming Services, and Reports modules will show real data (otherwise they display empty/"waiting for data" states — see Section 9).

**Step 4.3 — Import staff/technicians**
```bash
node scripts/import-workers.mjs
```
Reads the client's staff Excel export and creates a `users` row per staff member. Field/service designations import with role `worker` (technicians); rows marked `FRONT OFFICE` import with role `front_office`. Every imported user gets the temporary password `worker123` — **have each technician change this on first login.**

**Step 4.4 — Import inventory/spare-parts stock**
```bash
node scripts/import-inventory.mjs
```
Reads `scripts/data/inventory-raw.txt` (the client's pasted stock list) and upserts it into `inventory_items`. Re-running is safe and simply refreshes stock quantities/units.

**Step 4.5 — Grant BOQ/Quotation admin access (optional, if the client has designated quoting staff)**
Superadmin can always create quotations. To give specific staff members quotation/BOQ pricing access (max 6 people), either use the in-app **BOQ Permissions** screen (`/admin/boq-permissions`, superadmin only) after they've logged in once, or add a one-off script following the pattern in `scripts/add-kethan-boq-admin.mjs`.

**Step 4.6 — Apply performance indexes (recommended before go-live with real data volume)**
Indexes for the large customer/service-visit tables live in `sql/performance_indexes.sql` and can be applied through `pages/api/admin/apply-indexes.js` (call it once as superadmin) or directly via `psql` against `DATABASE_URL`.

---

## 5. Run it locally to verify

```bash
npm run dev
```
Open `http://localhost:3000` — you should see the four-portal landing page (Customer / Technician / Staff / Store). Log in with the seeded superadmin account (Section 8) and confirm the Admin dashboard loads with real KPI numbers.

Then verify the production build compiles cleanly before deploying:
```bash
npm run build
```

---

## 6. Deploy to production (Vercel)

1. Push the repository to GitHub (`main` branch).
2. In Vercel, import the GitHub repo as a new project. `vercel.json` already sets the deployment region (`sin1`) and a 15-second timeout for all API routes — no extra config needed there.
3. In the Vercel project's **Environment Variables** settings, add every variable from Section 3 (production values — a strong random `JWT_SECRET`, the real `DATABASE_URL`, and the exact production domain for the WebAuthn variables).
4. Trigger a deploy (push to `main`, or click Deploy in Vercel).
5. Once live, confirm the production database is the same one the setup/import scripts in Section 4 were run against (or re-run those scripts pointed at the production `DATABASE_URL` if it's a separate database from local dev).

### Production smoke test checklist
- [ ] Open `https://<your-domain>/Adminlogin`, log in as superadmin, confirm `/Admindashboard` loads.
- [ ] Customers, AMC, Service Visits, Upcoming Services, and Reports all show real numbers (not "Coming Soon").
- [ ] Create one test complaint/ticket, assign it to a technician, log in as that technician and confirm the job appears in the Technician portal.
- [ ] As storekeeper, scan (or manually enter) that job's store-pass QR and issue a test item; confirm stock decreases.
- [ ] As the same technician, complete the job (checklist + client sign) and confirm it disappears from active jobs.
- [ ] Log in as a customer account and confirm they can raise and see their own tickets only.
- [ ] If Face Lock is wanted, register it on the real production domain and confirm login-with-Face-Lock works (see Section 8's Face Lock notes).
- [ ] If push notifications are configured, use the **Enable/Test Push Notifications** card on any portal's profile screen to confirm a real device receives a notification.

---

## 7. Install the app on phones (PWA — no App Store needed)

Amardip Lifts ERP is a Progressive Web App. Each portal's login URL can be "installed" to a phone home screen like a native app:

**Android (Chrome):** open the portal login URL → tap the browser menu (⋮) → **Add to Home screen** / **Install app**.

**iPhone (Safari):** open the portal login URL → tap the Share icon → **Add to Home Screen**.

After installing, the app opens full-screen (no browser address bar), uses the Amardip blue theme and logo, and — once logged in — can receive push notifications and show a badge count on the app icon (where the phone/browser supports it).

Recommended install targets per user:
- Office/Admin staff → `/Adminlogin`
- Customers → `/Customerlogin`
- Technicians → `/Technicianlogin`
- Storekeepers → `/Storelogin`

---

## 8. Default accounts (change these immediately)

These accounts are created by `scripts/setup-db.js` so the client can log in on day one. **Have each real user change their password on first login**, and disable/remove any seeded demo accounts that won't correspond to a real person before go-live.

| Username | Password | Role | Portal |
|---|---|---|---|
| `superadmin` | `superadmin123` | superadmin | Staff Portal (`/Adminlogin`) |
| `9999999999` | `customer123` | customer | Customer Portal (`/Customerlogin`) |
| `tech50` | `tech123` | worker | Technician Portal (`/Technicianlogin`) |
| `store50` | `store123` | storekeeper | Store Portal (`/Storelogin`) |

Real imported staff (Section 4.3) log in with their assigned username and the temporary password `worker123`.

**Password recovery:** passwords are stored as bcrypt hashes and cannot be recovered as plain text. Use the superadmin password-reset flow (Users/Staff management in the Admin portal) to reset a locked-out user.

**Face Lock (optional, Admin portal only, currently):** after password login, an admin can go to Profile → **Setup Face Lock** to register their phone/laptop's built-in biometric unlock (Face ID / fingerprint / Windows Hello) via WebAuthn. This only stores a public-key credential — no biometric data is ever stored by the app itself. It must be set up separately on the exact production domain (Section 3).

---

## 9. Understanding "Coming Soon" modules

The Admin dashboard automatically hides or shows a "Waiting for client data" state for any module whose backing database table is still empty — this is intentional, so the client never sees fake demo numbers mixed in with real ones. Once the relevant import script (Section 4) has been run and real rows exist, the module activates automatically on next page load — no code change needed. See the **Product & Process Guide** (`docs/PRODUCT_USER_GUIDE.md`) for what each module needs to go live.

---

## 10. Ongoing maintenance notes

- **Re-importing data:** the workers and inventory import scripts (4.3, 4.4) are safe to re-run any time the client sends an updated Excel/list — they upsert rather than duplicate.
- **Backups:** back up the Postgres database on whatever schedule your hosting provider supports (most managed Postgres providers, e.g. Neon, offer automatic point-in-time backups) — this is the single source of truth for all customer, service, complaint, quotation, and inventory data.
- **Adding new staff/customers going forward:** use the in-app onboarding (Admin → Staff → Onboard User, superadmin only) rather than re-running the bulk import scripts, which are meant for the initial data load.
- **Monitoring:** `npm run build` should be run and pass before every deploy. `npm run lint` currently has some pre-existing warnings in older dashboard files unrelated to new features — `npm run build` is the required pre-deploy check, not full lint.
