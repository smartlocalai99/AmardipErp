# Quotation Project Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert accepted quotations into tracked ongoing projects with required agreed and advance amounts, while simplifying quotation actions and exposing projects in the quotation screen and dashboard.

**Architecture:** Add a small `quotation_projects` table linked to `quotation_requests` and the existing customer created during onboarding. Keep quotation PDF generation available as document data, but remove preview/download/add-customer actions from the quotation workflow. Extend the quotations page API to return project rows and use two tabs for quotations and ongoing projects.

**Tech Stack:** Next.js pages router, React 19, PostgreSQL via the existing quotation helpers, Node test runner, Tailwind utility classes.

## Global Constraints

- Preserve existing quotation permissions and pagination behavior.
- Use the existing shared database connection and `ensureQuotationTables` initialization pattern.
- Require valid non-negative agreed and advance amounts, with advance no greater than agreed amount.
- Keep the existing quotation terms and conditions in the customer-facing quotation document.
- Do not add PDF preview or download controls to the quotation UI.
- Do not change unrelated customer, service, or inventory workflows.

---

### Task 1: Persist project onboarding data

**Files:**
- Modify: `lib/quotations.js`
- Test: `scripts/quotations.test.mjs` or the nearest existing quotation test file

**Interfaces:**
- Produce `onboardQuotationAsProject({ quotationId, agreedAmount, advanceAmount })` returning `{ project, quotation }`.
- Produce `listOngoingProjects({ actor, page, pageSize, search })` returning `{ rows, total, page, pageSize }`.

- [ ] Write a failing test for required amount validation and project status conversion.
- [ ] Run the focused quotation test and confirm it fails for the missing project behavior.
- [ ] Create `quotation_projects` during quotation table initialization with quotation/customer foreign keys, amounts, balance, status, and timestamps.
- [ ] Add normalization for project rows and implement the transaction-safe customer/project conversion using the existing database transaction helper where required by local conventions.
- [ ] Add project listing with bounded pagination and customer/quotation search.
- [ ] Run the focused quotation test until it passes.

### Task 2: Add project API endpoints

**Files:**
- Modify: `pages/api/quotations/index.js`
- Create: `pages/api/quotations/projects.js`
- Create: `pages/api/quotations/[id]/onboard-project.js`

**Interfaces:**
- `POST /api/quotations/:id/onboard-project` accepts `{ agreedAmount, advanceAmount }` and returns the created project plus converted quotation.
- `GET /api/quotations/projects` returns permission-filtered ongoing projects.

- [ ] Add endpoint tests or extend the existing API test harness with invalid amount, unauthorized, and successful conversion cases.
- [ ] Run the endpoint tests and confirm the new routes fail before implementation.
- [ ] Enforce the same BOQ permission used by quotation generation/onboarding.
- [ ] Validate and pass both required amounts to `onboardQuotationAsProject`.
- [ ] Audit project onboarding without leaking payment data beyond the existing audit payload conventions.
- [ ] Run the endpoint tests and confirm they pass.

### Task 3: Simplify quotation actions and add tabs

**Files:**
- Modify: `pages/admin/quotations.jsx`

**Interfaces:**
- The quotation list has `Quotations` and `Ongoing Projects` tabs.
- Each quotation card shows `Open BOQ`, `View Quotation`, and `Onboard Project` beside one another where permission allows.
- The project onboarding form requires agreed amount and advance amount.

- [ ] Add a failing component behavior check for the two tabs and required onboarding fields if a component test harness exists; otherwise use the existing lint/build check as the focused executable guard.
- [ ] Remove the PDF preview/download/share modal actions from the quotation detail action area.
- [ ] Preserve terms and conditions in the quotation document.
- [ ] Move the BOQ, view, and onboarding actions into the all-quotations card action row.
- [ ] Add project-tab loading, search, empty, error, and pagination states.
- [ ] Add the onboarding modal/form with numeric validation and success refresh into the project tab.
- [ ] Run the focused page lint/build validation.

### Task 4: Add dashboard project card

**Files:**
- Modify: `lib/quotationDashboard.js`
- Modify: `pages/Admindashboard.jsx`

**Interfaces:**
- Authorized quotation users see an `Ongoing Projects` card linking to `/admin/quotations?tab=projects`.

- [ ] Add dashboard card data alongside the existing quotation card data.
- [ ] Render the card using the existing dashboard card styling and permission result.
- [ ] Make the quotation page initialize its active tab from the `tab` query parameter.
- [ ] Run lint and the production build.

### Task 5: Final verification

**Files:**
- Modify: `docs/PRODUCT_USER_GUIDE.md` only if the existing quotation workflow is documented there.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Confirm no unrelated files were modified.
- [ ] Review the final diff for removed PDF controls, preserved terms, required amount validation, project tab behavior, and dashboard navigation.