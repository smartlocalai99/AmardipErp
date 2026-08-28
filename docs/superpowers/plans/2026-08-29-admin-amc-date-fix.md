# Admin AMC Date Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Admin AMC expired/month buckets, filters, reminders, and badges correctly understand the real imported customer dates.

**Architecture:** Add a focused `lib/customerDates.js` module that owns both the browser-safe JavaScript parser and a safe PostgreSQL date expression. Reuse that expression in all affected API queries and reuse the JavaScript parser in Admin badges, keeping the existing customer and service KPI APIs unchanged.

**Tech Stack:** Next.js 16 Pages Router, React, Node.js test runner, PostgreSQL (`pg`).

**Spec:** `docs/superpowers/specs/2026-08-29-admin-amc-date-fix-design.md`

## Global Constraints

- Preserve the current text-backed customer schema and imported values.
- Accept valid ISO and slash-formatted dates; reject impossible dates.
- Date-driven buckets include only AMC, EMC, and WARRANTY customers.
- Do not modify or commit `output/` credential artifacts.

---

### Task 1: Shared date parser regression coverage

**Files:**
- Create: `scripts/customer-dates.test.mjs`
- Create: `lib/customerDates.js`

**Interfaces:**
- Produces: `parseCustomerDate(value): Date | null`
- Produces: `CUSTOMER_DUE_DATE_SQL: string`

- [ ] **Step 1: Write the failing test**

Create assertions for ISO, `D/M/YYYY`, leap-day, empty, and impossible dates.
Run the SQL expression against a read-only PostgreSQL `VALUES` fixture and
assert literal normalized dates and `NULL` for invalid input.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --env-file=.env.local --test scripts/customer-dates.test.mjs`

Expected: FAIL because `lib/customerDates.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement strict component validation in JavaScript. Generate PostgreSQL with
nested `CASE` checks so `make_date` is called only after year/month validation,
then validate the day against the actual last day of the month.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --env-file=.env.local --test scripts/customer-dates.test.mjs`

Expected: PASS with zero failures.

### Task 2: Apply shared parsing to Admin AMC behavior

**Files:**
- Modify: `pages/api/elevator-customers/amc-stats.js`
- Modify: `pages/api/elevator-customers/index.js`
- Modify: `pages/api/elevator-customers/notify-expiring.js`
- Modify: `components/admin/amc/AdminAmcTable.jsx`
- Modify: `components/admin/customers/AdminCustomersTable.jsx`

**Interfaces:**
- Consumes: `parseCustomerDate` and `CUSTOMER_DUE_DATE_SQL` from Task 1.
- Produces: Correct Admin AMC counts, filtered lists, reminder targets, and
  visual status badges.

- [ ] **Step 1: Replace duplicated ISO-only SQL**

Import `CUSTOMER_DUE_DATE_SQL` into each API. Scope month/expired buckets to
`UPPER(TRIM(customer_status)) IN ('AMC', 'EMC', 'WARRANTY')`.

- [ ] **Step 2: Replace browser-native ambiguous parsing**

Import `parseCustomerDate` in both Admin tables and use it in `getAmcState`.

- [ ] **Step 3: Run focused tests**

Run: `node --env-file=.env.local --test scripts/customer-dates.test.mjs scripts/admin-dashboard-data.test.mjs`

Expected: PASS with zero failures.

### Task 3: Live verification

**Files:**
- Modify if required by the full-suite runner: `lib/customerAccounts.js`
- Modify if required by the full-suite runner: `lib/usersSchema.js`

**Interfaces:**
- Consumes: repaired APIs and Admin UI.
- Produces: fresh verification evidence.

- [ ] **Step 1: Check real read-only counts**

Call the authenticated local Admin endpoints and confirm Total Customers,
Upcoming Services, AMC status, Expired, This Month, and Next Month return real
values.

- [ ] **Step 2: Verify Admin browser flow**

Open the Admin dashboard, enter AMC, and confirm Expired and Next Month show
matching record lists and non-`Missing` badges for valid slash dates.

- [ ] **Step 3: Run static/build verification**

Run focused ESLint on changed files and `npm run build`. Report any unrelated
repository-wide lint debt separately.

If the plain Node suite cannot resolve a Next.js `@/lib` alias reached through
`customerAccounts.js`, change only those internal library imports to the
existing relative `.js` pattern and rerun the full suite.

- [ ] **Step 4: Commit the focused fix**

Commit only the plan, tests, shared parser, and affected Admin files with:
`Fix admin AMC date filters and status counts`.
