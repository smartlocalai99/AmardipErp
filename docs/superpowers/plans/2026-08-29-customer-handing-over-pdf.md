# Customer Handing-Over PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one secure, customer-specific handing-over PDF per linked lift with a valid HOC date, preview it inside the Customer Dashboard, and download the already-loaded PDF from a button below the viewer.

**Architecture:** Derive the Documents list from the customer records already loaded by `getServerSideProps`, so listing documents creates no new database call. Generate each PDF on demand through an authenticated customer-only API route; the route joins `customer_user_links` to enforce ownership, maps database data through a pure document model, and renders a one-page PDF on the supplied letterhead. The client fetches the PDF once as a blob and reuses one object URL for preview and download.

**Tech Stack:** Next.js 16 Pages Router, React 19, Node `node:test`, PostgreSQL via `pg`, existing `jsonwebtoken` authentication, existing `jspdf`, supplied DOCX letterhead, Poppler/PDF document QA.

**Spec:** `docs/superpowers/specs/2026-08-29-customer-handing-over-pdf-design.md`

## Global Constraints

- Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before changing a Pages Router API route or client data flow.
- One separate handing-over PDF is shown for every linked lift/customer record with a valid HOC date.
- A missing or invalid HOC date means no Documents entry and no generated PDF.
- AMC/warranty due is exactly one calendar year after HOC; 29 February becomes 28 February in a non-leap anniversary year.
- Existing customers do not require a quotation date; use the approved “as per the specifications agreed with you” wording.
- Use `public/template_for_header_footer.docx` as the editable source for the deployed letterhead background.
- Generate PDFs only on open. Do not poll, pre-generate, persist, or add a PDF database/storage table.
- The preview and bottom download button must reuse one fetched PDF blob.
- All PDF content comes from the authorized database row, never from browser-supplied customer fields.
- Preserve the untracked confidential `output/` directory and never add it to Git.

---

## File Structure

### New files

- `lib/customerHandoverDocument.js` — pure eligibility, anniversary, formatting, descriptor, and letter-data mapping.
- `lib/customerHandoverPdf.js` — one-page jsPDF renderer using the committed letterhead background.
- `lib/customerHandoverHandler.js` — dependency-injected authenticated API handler for ownership and response behavior.
- `lib/customerDocumentResource.js` — browser PDF fetch/blob/object-URL lifecycle helper.
- `components/customer/CustomerDocumentsPanel.jsx` — Documents list, search, loading/error state, embedded PDF viewer, and bottom download button.
- `pages/api/customer/documents/handing-over/[customerId].js` — thin dependency-composition route.
- `public/handover-letterhead.png` — high-resolution deployed background derived from the supplied DOCX.
- `scripts/customer-handover-document.test.mjs` — document-domain and date tests.
- `scripts/customer-handover-pdf.test.mjs` — real PDF renderer smoke/content tests.
- `scripts/customer-handover-api.test.mjs` — authentication, ownership, HOC eligibility, and response tests.
- `scripts/customer-document-resource.test.mjs` — one-fetch viewer/download resource lifecycle tests.

### Modified files

- `pages/Customerdashboard.jsx` — replace the empty/mock Documents implementation with `CustomerDocumentsPanel`.
- `public/template_for_header_footer.docx` — add the user-supplied source template to version control without modifying its contents.

---

### Task 1: Document eligibility, date rules, and customer-data mapping

**Files:**
- Create: `lib/customerHandoverDocument.js`
- Create: `scripts/customer-handover-document.test.mjs`

**Interfaces:**
- Consumes: `parseCustomerDate(value)` from `lib/customerDates.js`.
- Produces: `addOneCalendarYear(date)`, `formatLetterDate(date)`, `buildHandoverLetterData(customer)`, and `buildHandoverDocumentDescriptor(customer)`.
- `buildHandoverLetterData(customer)` returns `null` for an invalid HOC or an object with `customerId`, `customerName`, `recipientLocation`, `installationAddress`, `liftDescription`, `reference`, `hocDate`, and `dueDate`.
- `buildHandoverDocumentDescriptor(customer)` returns `null` for an invalid HOC or `{ id, customerId, name, category, type, date, liftLabel, downloadName }` for the client list.

- [ ] **Step 1: Write failing domain tests**

Create `scripts/customer-handover-document.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const documentModule = await import("../lib/customerHandoverDocument.js").catch(() => ({}));

test("buildHandoverLetterData maps customer data and adds exactly one calendar year", () => {
  assert.equal(typeof documentModule.buildHandoverLetterData, "function");

  const letter = documentModule.buildHandoverLetterData({
    id: "customer-1",
    customer_code: "LIFT-101",
    customer_name: "Sample Residency",
    address: "Patel Road",
    city: "Kadapa",
    hoc_date: "29/08/2026",
    no_of_passenger: "8",
  });

  assert.deepEqual(letter, {
    customerId: "customer-1",
    customerName: "Sample Residency",
    recipientLocation: "KADAPA",
    installationAddress: "Patel Road, Kadapa",
    liftDescription: "8 Passenger Lift",
    reference: "LIFT-101",
    hocDate: "29/08/2026",
    dueDate: "29/08/2027",
  });
});

test("29 February anniversary uses 28 February in a non-leap year", () => {
  const letter = documentModule.buildHandoverLetterData({
    id: "customer-2",
    customer_name: "Leap Day Customer",
    hoc_date: "29/02/2028",
  });

  assert.equal(letter.dueDate, "28/02/2029");
});

test("records without a valid HOC produce no letter or document descriptor", () => {
  assert.equal(documentModule.buildHandoverLetterData({ id: "missing" }), null);
  assert.equal(
    documentModule.buildHandoverDocumentDescriptor({ id: "invalid", hoc_date: "31/09/2026" }),
    null,
  );
});

test("descriptor distinguishes one handing-over letter per linked lift", () => {
  const descriptor = documentModule.buildHandoverDocumentDescriptor({
    id: "customer-3",
    customer_code: "LIFT-303",
    customer_name: "Third Customer",
    elevator_type: "Goods Lift",
    hoc_date: "2026-08-29",
  });

  assert.deepEqual(descriptor, {
    id: "handover-customer-3",
    customerId: "customer-3",
    name: "Handing Over Letter - LIFT-303",
    category: "Warranty & Handover",
    type: "PDF",
    date: "29/08/2026",
    liftLabel: "Goods Lift",
    downloadName: "handing-over-letter-LIFT-303.pdf",
  });
});
```

- [ ] **Step 2: Run the test and verify the RED state**

Run:

```bash
node --test scripts/customer-handover-document.test.mjs
```

Expected: FAIL because `buildHandoverLetterData` and `buildHandoverDocumentDescriptor` do not exist.

- [ ] **Step 3: Implement the minimal pure document model**

Create `lib/customerHandoverDocument.js` with this public shape:

```js
import { parseCustomerDate } from "./customerDates.js";

function clean(value) {
  return String(value ?? "").trim();
}

export function addOneCalendarYear(date) {
  const year = date.getFullYear() + 1;
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

export function formatLetterDate(date) {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
}

export function buildHandoverLetterData(customer = {}) {
  const hoc = parseCustomerDate(customer.hoc_date);
  if (!hoc) return null;

  const customerName = clean(customer.customer_name) || "Customer";
  const city = clean(customer.city);
  const address = clean(customer.address);
  const location = clean(customer.location);
  const passengerCount = clean(customer.no_of_passenger);
  const elevatorType = clean(customer.elevator_type);
  const reference = clean(customer.customer_code) || clean(customer.record_no) || clean(customer.id);

  return {
    customerId: clean(customer.id),
    customerName,
    recipientLocation: (city || location || address).toUpperCase(),
    installationAddress: [address, city].filter(Boolean).join(", ") || location || "your premises",
    liftDescription: elevatorType || (passengerCount ? `${passengerCount} Passenger Lift` : "Passenger Lift"),
    reference,
    hocDate: formatLetterDate(hoc),
    dueDate: formatLetterDate(addOneCalendarYear(hoc)),
  };
}

export function buildHandoverDocumentDescriptor(customer = {}) {
  const letter = buildHandoverLetterData(customer);
  if (!letter) return null;

  const safeReference = letter.reference.replace(/[^a-z0-9_-]+/gi, "-");
  return {
    id: `handover-${letter.customerId}`,
    customerId: letter.customerId,
    name: `Handing Over Letter - ${letter.reference}`,
    category: "Warranty & Handover",
    type: "PDF",
    date: letter.hocDate,
    liftLabel: clean(customer.elevator_type) || (clean(customer.no_of_passenger) ? `${clean(customer.no_of_passenger)} Passenger Lift` : "Passenger Lift"),
    downloadName: `handing-over-letter-${safeReference}.pdf`,
  };
}
```

- [ ] **Step 4: Run the domain test and all existing date tests**

Run:

```bash
node --env-file=.env.local --test scripts/customer-handover-document.test.mjs scripts/customer-dates.test.mjs
```

Expected: 7 tests pass with zero failures.

- [ ] **Step 5: Commit the domain model**

```bash
git add lib/customerHandoverDocument.js scripts/customer-handover-document.test.mjs
git commit -m "Add handing-over document data model"
```

---

### Task 2: Letterhead asset and real PDF renderer

**Files:**
- Add: `public/template_for_header_footer.docx`
- Create: `public/handover-letterhead.png`
- Create: `lib/customerHandoverPdf.js`
- Create: `scripts/customer-handover-pdf.test.mjs`

**Interfaces:**
- Consumes: the object returned by `buildHandoverLetterData(customer)`.
- Produces: `generateCustomerHandoverPdf(letterData, options?)`, returning a Node `Buffer` containing one US Letter PDF page.
- Optional test injection: `options.letterheadDataUrl`; production defaults to `public/handover-letterhead.png`.

- [ ] **Step 1: Read the Next.js public-folder guide and PDF skill**

Read completely before creating the binary asset or renderer:

```bash
cat node_modules/next/dist/docs/02-pages/04-api-reference/02-file-conventions/public-folder.md
cat '/Users/vardhanreddy/.codex/plugins/cache/openai-primary-runtime/pdf/26.623.12021/skills/pdf/SKILL.md'
```

- [ ] **Step 2: Write the failing real-renderer test**

Create `scripts/customer-handover-pdf.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const pdfModule = await import("../lib/customerHandoverPdf.js").catch(() => ({}));

test("generateCustomerHandoverPdf returns a non-empty PDF containing customer dates", () => {
  assert.equal(typeof pdfModule.generateCustomerHandoverPdf, "function");

  const pdf = pdfModule.generateCustomerHandoverPdf({
    customerId: "customer-1",
    customerName: "Sample Residency",
    recipientLocation: "KADAPA",
    installationAddress: "Patel Road, Kadapa",
    liftDescription: "8 Passenger Lift",
    reference: "LIFT-101",
    hocDate: "29/08/2026",
    dueDate: "29/08/2027",
  });

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.ok(pdf.length > 20_000);

  const rawPdf = pdf.toString("latin1");
  assert.equal((rawPdf.match(/29\/08\/2026/g) || []).length, 3);
  assert.match(rawPdf, /29\/08\/2027/);
  assert.match(rawPdf, /Sample Residency/);
  assert.match(rawPdf, /specifications agreed with you/);
});
```

- [ ] **Step 3: Run the renderer test and verify the RED state**

Run:

```bash
node --test scripts/customer-handover-pdf.test.mjs
```

Expected: FAIL because `generateCustomerHandoverPdf` does not exist.

- [ ] **Step 4: Create the deployed letterhead asset from the supplied DOCX**

Keep the original DOCX unchanged. Generate a high-resolution full-page preview in a temporary directory, then place only the final background under `public`:

```bash
LETTERHEAD_TMP=$(mktemp -d /tmp/amardip-letterhead.XXXXXX)
qlmanage -t -s 2550 -o "$LETTERHEAD_TMP" public/template_for_header_footer.docx
cp "$LETTERHEAD_TMP/template_for_header_footer.docx.png" public/handover-letterhead.png
sips -g pixelWidth -g pixelHeight public/handover-letterhead.png
```

Expected: a page-proportioned PNG at least 1900 pixels wide. Inspect it with the local image viewer and confirm the logo/header, contact line, red rules, and office-address footer are legible.

- [ ] **Step 5: Implement the one-page jsPDF renderer**

Create `lib/customerHandoverPdf.js`. Use `format: "letter"`, `unit: "mm"`, `compress: false`, the full-page PNG at `(0, 0, pageWidth, pageHeight)`, Times for body copy, and `doc.splitTextToSize` for long paragraphs. Keep all body text between the visually verified header and footer bounds.

The core implementation must follow this shape:

```js
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

const PAGE_WIDTH_MM = 215.9;
const PAGE_HEIGHT_MM = 279.4;
const BODY_LEFT_MM = 25.4;
const BODY_RIGHT_MM = 25.4;
const BODY_WIDTH_MM = PAGE_WIDTH_MM - BODY_LEFT_MM - BODY_RIGHT_MM;

function defaultLetterheadDataUrl() {
  const file = path.join(process.cwd(), "public", "handover-letterhead.png");
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

function writeWrapped(doc, text, x, y, width, lineHeight = 5.5) {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generateCustomerHandoverPdf(letter, options = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: false });
  const background = options.letterheadDataUrl || defaultLetterheadDataUrl();
  doc.addImage(background, "PNG", 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM);

  // Use the inspected template bounds; final y-values are established by the
  // rendered QA sample, not guessed past the header/footer.
  let y = 55;
  doc.setTextColor(15, 23, 42);
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.text("To,", BODY_LEFT_MM, y);
  doc.text(letter.hocDate, PAGE_WIDTH_MM - BODY_RIGHT_MM, y, { align: "right" });
  y += 7;
  doc.setFont("times", "bold");
  doc.text(`MR/MS ${letter.customerName}`, BODY_LEFT_MM, y);
  y += 6;
  if (letter.recipientLocation) {
    doc.text(letter.recipientLocation, BODY_LEFT_MM, y);
    y += 9;
  }

  doc.setFont("times", "bold");
  y = writeWrapped(doc, "Sub: Handing over of Lift duly erected, tested & operated in full shape - Regarding.", BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  doc.setFont("times", "normal");
  y = writeWrapped(doc, `We are happy to inform you that we have completed the erection of the ${letter.liftDescription} at ${letter.installationAddress}, as per the specifications agreed with you. We have tested and commissioned the above lift in your presence on ${letter.hocDate}.`, BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  y = writeWrapped(doc, `Our service warranty for the above lift commences on ${letter.hocDate} and expires on ${letter.dueDate}. Our warranty is limited to manufacturing defects only. The warranty does not cover damage caused to the lift by natural calamities, acts of God, external power-supply fluctuations, or short circuits.`, BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 5;
  y = writeWrapped(doc, "We assure you of our best services always.", BODY_LEFT_MM, y, BODY_WIDTH_MM);
  y += 10;
  doc.text("Thanking you sir,", BODY_LEFT_MM, y);
  y += 12;
  doc.text("Yours sincerely,", BODY_LEFT_MM, y);

  return Buffer.from(doc.output("arraybuffer"));
}
```

- [ ] **Step 6: Run the renderer test and verify GREEN**

Run:

```bash
node --test scripts/customer-handover-pdf.test.mjs
```

Expected: 1 test passes and the real PNG-backed PDF exceeds the minimum size.

- [ ] **Step 7: Render representative PDFs and inspect every page**

Generate three PDFs in a temporary directory using the real renderer: normal data, a long customer name/address, and missing optional fields:

```bash
mkdir -p /tmp/amardip-handover-samples
node --input-type=module -e '
import fs from "node:fs";
import { generateCustomerHandoverPdf } from "./lib/customerHandoverPdf.js";
const samples = {
  normal: {
    customerId: "normal", customerName: "Sample Residency", recipientLocation: "KADAPA",
    installationAddress: "Patel Road, Kadapa", liftDescription: "8 Passenger Lift",
    reference: "LIFT-101", hocDate: "29/08/2026", dueDate: "29/08/2027",
  },
  "long-values": {
    customerId: "long", customerName: "Sri Venkateswara Residential Owners Welfare Association",
    recipientLocation: "KADAPA", installationAddress: "Door No. 14/275, Municipal Corporation Main Road, Near Central Market, Kadapa",
    liftDescription: "13 Passenger Automatic Door Lift", reference: "LIFT-LONG-2026",
    hocDate: "29/08/2026", dueDate: "29/08/2027",
  },
  fallbacks: {
    customerId: "fallback", customerName: "Customer", recipientLocation: "",
    installationAddress: "your premises", liftDescription: "Passenger Lift",
    reference: "fallback", hocDate: "29/08/2026", dueDate: "29/08/2027",
  },
};
for (const [name, data] of Object.entries(samples)) {
  fs.writeFileSync(`/tmp/amardip-handover-samples/${name}.pdf`, generateCustomerHandoverPdf(data));
}
'
```

Then render each with the PDF skill’s Poppler workflow:

```bash
pdftoppm -png -r 150 /tmp/amardip-handover-samples/normal.pdf /tmp/amardip-handover-samples/normal
pdftoppm -png -r 150 /tmp/amardip-handover-samples/long-values.pdf /tmp/amardip-handover-samples/long-values
pdftoppm -png -r 150 /tmp/amardip-handover-samples/fallbacks.pdf /tmp/amardip-handover-samples/fallbacks
```

Inspect all three page PNGs at 100%. Adjust only renderer coordinates, wrapping, or local font size until header/footer do not overlap and each sample remains one page. Re-run the automated renderer test after every adjustment.

- [ ] **Step 8: Commit the template, background, renderer, and tests**

```bash
git add public/template_for_header_footer.docx public/handover-letterhead.png lib/customerHandoverPdf.js scripts/customer-handover-pdf.test.mjs
git commit -m "Generate branded handing-over PDFs"
```

---

### Task 3: Secure customer-only PDF endpoint

**Files:**
- Create: `lib/customerHandoverHandler.js`
- Create: `pages/api/customer/documents/handing-over/[customerId].js`
- Create: `scripts/customer-handover-api.test.mjs`

**Interfaces:**
- Consumes: `buildHandoverLetterData(customer)` and `generateCustomerHandoverPdf(letter)`.
- Produces: `createCustomerHandoverHandler({ getUserFromRequest, query, generatePdf })` returning a Pages Router handler.
- Route: `GET /api/customer/documents/handing-over/[customerId]`.

- [ ] **Step 1: Read the installed Next.js API Routes guide**

```bash
cat node_modules/next/dist/docs/02-pages/03-building-your-application/01-routing/07-api-routes.md
```

- [ ] **Step 2: Write failing route behavior tests**

Create `scripts/customer-handover-api.test.mjs` with a small response recorder supporting `setHeader`, `status`, `json`, and `send`. Test these observable outcomes:

```js
import assert from "node:assert/strict";
import test from "node:test";

const handlerModule = await import("../lib/customerHandoverHandler.js").catch(() => ({}));

function responseRecorder() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test("endpoint returns the linked customer's PDF with private no-store headers", async () => {
  assert.equal(typeof handlerModule.createCustomerHandoverHandler, "function");
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async (_sql, params) => ({ rows: params[0] === 44 && params[1] === "lift-1" ? [{
      id: "lift-1", customer_code: "LIFT-1", customer_name: "Linked Customer",
      address: "Main Road", city: "Kadapa", hoc_date: "2026-08-29",
      no_of_passenger: "8", elevator_type: null,
    }] : [] }),
    generatePdf: (letter) => Buffer.from(`PDF:${letter.customerName}:${letter.dueDate}`),
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Content-Type"], "application/pdf");
  assert.match(res.headers["Cache-Control"], /no-store/);
  assert.match(res.body.toString(), /Linked Customer:29\/08\/2027/);
});

test("endpoint does not reveal an unlinked customer record", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async () => ({ rows: [] }),
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "someone-elses-lift" } }, res);
  assert.equal(res.statusCode, 404);
});

test("endpoint rejects missing HOC before PDF generation", async () => {
  let generated = false;
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 44, role: "customer" }),
    query: async () => ({ rows: [{ id: "lift-2", customer_name: "No HOC", hoc_date: null }] }),
    generatePdf: () => { generated = true; return Buffer.from("wrong"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-2" } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(generated, false);
});
```

Add these separate authentication and method tests in the same file:

```js
test("endpoint requires authentication", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => null,
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 401);
});

test("endpoint allows only customer accounts", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 1, role: "admin" }),
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "GET", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 403);
});

test("endpoint allows only GET requests", async () => {
  const handler = handlerModule.createCustomerHandoverHandler({
    getUserFromRequest: async () => ({ id: 1, role: "customer" }),
    query: async () => { throw new Error("must not query"); },
    generatePdf: () => { throw new Error("must not generate"); },
  });
  const res = responseRecorder();
  await handler({ method: "POST", query: { customerId: "lift-1" } }, res);
  assert.equal(res.statusCode, 405);
});
```

- [ ] **Step 3: Run the route test and verify the RED state**

Run:

```bash
node --test scripts/customer-handover-api.test.mjs
```

Expected: FAIL because `createCustomerHandoverHandler` does not exist.

- [ ] **Step 4: Implement the dependency-injected handler**

Create `lib/customerHandoverHandler.js` with an ownership-enforcing query. The SQL must include both authenticated user ID and requested customer ID:

```js
import { buildHandoverLetterData } from "./customerHandoverDocument.js";

export function createCustomerHandoverHandler({ getUserFromRequest, query, generatePdf }) {
  return async function customerHandoverHandler(req, res) {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (user.role !== "customer") return res.status(403).json({ success: false, message: "Not allowed" });

    const customerId = String(req.query.customerId || "").trim();
    if (!customerId) return res.status(404).json({ success: false, message: "Document not found" });

    try {
      const result = await query(
        `SELECT c.id, c.record_no, c.customer_code, c.customer_name,
                c.address, c.city, c.location, c.hoc_date,
                c.no_of_passenger, c.elevator_type
           FROM customer_user_links cul
           JOIN elevator_service_customers c ON c.id = cul.customer_id
          WHERE cul.user_id = $1 AND c.id = $2
          LIMIT 1`,
        [user.id, customerId],
      );

      const letter = buildHandoverLetterData(result.rows[0]);
      if (!letter) return res.status(404).json({ success: false, message: "Document not found" });

      const safeReference = letter.reference.replace(/[^a-z0-9_-]+/gi, "-");
      const pdf = generatePdf(letter);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="handing-over-letter-${safeReference}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.status(200).send(pdf);
    } catch (error) {
      console.error("Customer handing-over PDF error:", error);
      return res.status(500).json({ success: false, message: "Failed to generate document" });
    }
  };
}
```

- [ ] **Step 5: Add the thin Pages Router composition route**

Create `pages/api/customer/documents/handing-over/[customerId].js`:

```js
import { getUserFromRequest } from "@/lib/auth";
import { createCustomerHandoverHandler } from "@/lib/customerHandoverHandler";
import { generateCustomerHandoverPdf } from "@/lib/customerHandoverPdf";
import { query } from "@/lib/db";

export default createCustomerHandoverHandler({
  getUserFromRequest,
  query,
  generatePdf: generateCustomerHandoverPdf,
});
```

- [ ] **Step 6: Run route, domain, and renderer tests**

```bash
node --test scripts/customer-handover-api.test.mjs scripts/customer-handover-document.test.mjs scripts/customer-handover-pdf.test.mjs
```

Expected: all handing-over tests pass.

- [ ] **Step 7: Commit the secure endpoint**

```bash
git add lib/customerHandoverHandler.js 'pages/api/customer/documents/handing-over/[customerId].js' scripts/customer-handover-api.test.mjs
git commit -m "Add secure customer handing-over PDF endpoint"
```

---

### Task 4: One-fetch PDF browser resource

**Files:**
- Create: `lib/customerDocumentResource.js`
- Create: `scripts/customer-document-resource.test.mjs`

**Interfaces:**
- Produces: `loadCustomerPdfResource({ customerId, downloadName, fetchImpl, urlApi })`.
- Returns: `{ objectUrl, downloadName, dispose() }`.
- Throws a user-safe `Error` when the endpoint response is not successful.

- [ ] **Step 1: Write the failing one-fetch lifecycle test**

Create `scripts/customer-document-resource.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const resourceModule = await import("../lib/customerDocumentResource.js").catch(() => ({}));

test("viewer and download reuse one fetched PDF object URL", async () => {
  assert.equal(typeof resourceModule.loadCustomerPdfResource, "function");
  let fetchCount = 0;
  let revoked = null;
  const blob = new Blob(["%PDF-test"], { type: "application/pdf" });

  const resource = await resourceModule.loadCustomerPdfResource({
    customerId: "lift-1",
    downloadName: "handing-over-letter-LIFT-1.pdf",
    fetchImpl: async () => {
      fetchCount += 1;
      return { ok: true, blob: async () => blob };
    },
    urlApi: {
      createObjectURL: (received) => received === blob ? "blob:handover-1" : "blob:wrong",
      revokeObjectURL: (url) => { revoked = url; },
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(resource.objectUrl, "blob:handover-1");
  assert.equal(resource.downloadName, "handing-over-letter-LIFT-1.pdf");
  resource.dispose();
  assert.equal(revoked, "blob:handover-1");
});

test("failed PDF responses expose a retryable message", async () => {
  await assert.rejects(
    () => resourceModule.loadCustomerPdfResource({
      customerId: "lift-2",
      downloadName: "letter.pdf",
      fetchImpl: async () => ({ ok: false, status: 500 }),
      urlApi: URL,
    }),
    /Unable to open this document/,
  );
});
```

- [ ] **Step 2: Run the test and verify the RED state**

```bash
node --test scripts/customer-document-resource.test.mjs
```

Expected: FAIL because `loadCustomerPdfResource` does not exist.

- [ ] **Step 3: Implement the resource lifecycle helper**

Create `lib/customerDocumentResource.js`:

```js
export async function loadCustomerPdfResource({
  customerId,
  downloadName,
  fetchImpl = fetch,
  urlApi = URL,
}) {
  const response = await fetchImpl(
    `/api/customer/documents/handing-over/${encodeURIComponent(customerId)}`,
    { cache: "no-store" },
  );

  if (!response.ok) throw new Error("Unable to open this document. Please try again.");
  const blob = await response.blob();
  const objectUrl = urlApi.createObjectURL(blob);
  let disposed = false;

  return {
    objectUrl,
    downloadName,
    dispose() {
      if (disposed) return;
      disposed = true;
      urlApi.revokeObjectURL(objectUrl);
    },
  };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

```bash
node --test scripts/customer-document-resource.test.mjs
```

Expected: 2 tests pass with exactly one fetch in the success case.

- [ ] **Step 5: Commit the browser resource helper**

```bash
git add lib/customerDocumentResource.js scripts/customer-document-resource.test.mjs
git commit -m "Add customer PDF preview resource"
```

---

### Task 5: Connect the Customer Dashboard Documents UI

**Files:**
- Create: `components/customer/CustomerDocumentsPanel.jsx`
- Modify: `pages/Customerdashboard.jsx:1-7`
- Modify: `pages/Customerdashboard.jsx:292-296`
- Modify: `pages/Customerdashboard.jsx:954-1012`
- Modify: `pages/Customerdashboard.jsx:1423-1500`
- Test: `scripts/customer-handover-document.test.mjs`
- Test: `scripts/customer-document-resource.test.mjs`

**Interfaces:**
- Consumes: `customerRecords`, `buildHandoverDocumentDescriptor(customer)`, and `loadCustomerPdfResource(...)`.
- Produces: `<CustomerDocumentsPanel customerRecords={customerRecords} />`.

- [ ] **Step 1: Read the installed Next.js client data-fetching guide**

```bash
cat node_modules/next/dist/docs/02-pages/03-building-your-application/03-data-fetching/05-client-side.md
```

- [ ] **Step 2: Add a failing search/list view-model test**

Extend `scripts/customer-handover-document.test.mjs` with a pure `filterHandoverDocuments(customers, search)` behavior. It must omit invalid HOC records and match search against document name, category, and lift label:

```js
test("filterHandoverDocuments omits missing HOC and searches eligible lifts", () => {
  const customers = [
    { id: "1", customer_code: "LIFT-A", customer_name: "Alpha", hoc_date: "2026-08-29", elevator_type: "Passenger Lift" },
    { id: "2", customer_code: "LIFT-B", customer_name: "Beta", hoc_date: null, elevator_type: "Goods Lift" },
    { id: "3", customer_code: "LIFT-C", customer_name: "Gamma", hoc_date: "2026-08-30", elevator_type: "Goods Lift" },
  ];

  assert.deepEqual(
    documentModule.filterHandoverDocuments(customers, "goods").map((doc) => doc.customerId),
    ["3"],
  );
  assert.deepEqual(
    documentModule.filterHandoverDocuments(customers, "").map((doc) => doc.customerId),
    ["1", "3"],
  );
});
```

- [ ] **Step 3: Run the test and verify the RED state**

```bash
node --test scripts/customer-handover-document.test.mjs
```

Expected: FAIL because `filterHandoverDocuments` does not exist.

- [ ] **Step 4: Implement the tested list/filter helper**

Add to `lib/customerHandoverDocument.js`:

```js
export function filterHandoverDocuments(customers = [], search = "") {
  const term = String(search).trim().toLowerCase();
  return customers
    .map(buildHandoverDocumentDescriptor)
    .filter(Boolean)
    .filter((document) => !term || [document.name, document.category, document.liftLabel]
      .some((value) => String(value).toLowerCase().includes(term)));
}
```

Run the domain test again and confirm it passes.

- [ ] **Step 5: Build the focused Documents panel**

Create `components/customer/CustomerDocumentsPanel.jsx` with this state and resource lifecycle; apply the existing dashboard card/modal classes to the shown structure without changing the behavior:

```jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { filterHandoverDocuments } from "@/lib/customerHandoverDocument";
import { loadCustomerPdfResource } from "@/lib/customerDocumentResource";

export default function CustomerDocumentsPanel({ customerRecords = [] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resourceRef = useRef(null);
  const requestIdRef = useRef(0);
  const documents = filterHandoverDocuments(customerRecords, search);

  const disposeCurrent = useCallback(() => {
    resourceRef.current?.dispose();
    resourceRef.current = null;
    setResource(null);
  }, []);

  const closeViewer = useCallback(() => {
    requestIdRef.current += 1;
    disposeCurrent();
    setSelected(null);
    setLoading(false);
    setError("");
  }, [disposeCurrent]);

  const openDocument = useCallback(async (document) => {
    if (loading) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    disposeCurrent();
    setSelected(document);
    setLoading(true);
    setError("");

    try {
      const next = await loadCustomerPdfResource({
        customerId: document.customerId,
        downloadName: document.downloadName,
      });
      if (requestIdRef.current !== requestId) {
        next.dispose();
        return;
      }
      resourceRef.current = next;
      setResource(next);
    } catch (loadError) {
      if (requestIdRef.current === requestId) {
        setError(loadError.message || "Unable to open this document. Please try again.");
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [disposeCurrent, loading]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    resourceRef.current?.dispose();
  }, []);

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Documents</h1>
        <p className="mt-0.5 text-xs text-slate-500">View and download handing-over letters for your lifts.</p>
      </div>

      <input
        type="search"
        aria-label="Search documents"
        placeholder="Search documents..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#0a649d]"
      />

      <div className="space-y-2.5">
        {documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-sm font-extrabold text-slate-700">No handing-over documents available</p>
            <p className="mt-1 text-xs text-slate-500">A letter appears after your lift has a valid HOC date.</p>
          </div>
        ) : documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => openDocument(document)}
            disabled={loading && selected?.id === document.id}
            className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-extrabold text-slate-800">{document.name}</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {document.liftLabel} · HOC {document.date}
              </span>
            </span>
            <span className="shrink-0 pl-3 text-[10px] font-bold text-[#0a649d]">View →</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#0a649d] px-5 py-4 text-white">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">{selected.name}</h2>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/75">{selected.category}</p>
              </div>
              <button type="button" onClick={closeViewer} aria-label="Close document viewer" className="h-9 w-9 rounded-full bg-white/10">×</button>
            </div>

            <div className="min-h-[60vh] flex-1 bg-slate-100 p-3">
              {loading ? (
                <div className="flex h-full min-h-[60vh] items-center justify-center text-sm font-bold text-slate-500">Loading PDF…</div>
              ) : error ? (
                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm font-bold text-red-600">{error}</p>
                  <button type="button" onClick={() => openDocument(selected)} className="rounded-xl bg-[#0a649d] px-4 py-2 text-xs font-bold text-white">Try again</button>
                </div>
              ) : resource ? (
                <iframe title={selected.name} src={resource.objectUrl} className="h-[65vh] w-full rounded-xl bg-white" />
              ) : null}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              {resource ? (
                <a
                  href={resource.objectUrl}
                  download={resource.downloadName}
                  className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#0a649d] text-xs font-black text-white"
                >
                  Download PDF
                </a>
              ) : (
                <button type="button" disabled className="h-11 w-full rounded-2xl bg-slate-200 text-xs font-black text-slate-400">Download PDF</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

This code calls `filterHandoverDocuments(customerRecords, search)` during render, omits invalid-HOC records, makes exactly one PDF request per open, and gives the viewer and download action the same `resource.objectUrl`.

Use the existing Customer Dashboard colors, rounded-card treatment, modal backdrop, focus styles, and mobile sizing. Keep the PDF viewer tall enough to read on mobile (`min-h-[60vh]`) and use accessible button labels.

- [ ] **Step 6: Replace the mock Documents code in the dashboard**

In `pages/Customerdashboard.jsx`:

1. Import `CustomerDocumentsPanel`.
2. Remove `documents`, `docSearch`, and `viewingDoc` state.
3. Replace the entire Documents tab block with:

```jsx
{activeTab === "documents" && (
  <CustomerDocumentsPanel customerRecords={customerRecords} />
)}
```

4. Remove the mock `VIEW DOCUMENT PREVIEW` modal.
5. Leave the separate AMC modal and all other tabs unchanged.

- [ ] **Step 7: Run focused tests and lint the changed UI**

```bash
node --test scripts/customer-handover-document.test.mjs scripts/customer-document-resource.test.mjs
npx eslint components/customer/CustomerDocumentsPanel.jsx pages/Customerdashboard.jsx lib/customerHandoverDocument.js lib/customerDocumentResource.js
```

Expected: all focused tests pass and ESLint exits 0.

- [ ] **Step 8: Build and verify the real customer flow**

Run:

```bash
npm run build
```

Then start the production build on an unused local port and verify with a real customer account that has at least one valid HOC:

1. Log in as that customer.
2. Open Documents.
3. Confirm only HOC-eligible linked lifts appear.
4. Open one letter and confirm the PDF renders before the download action.
5. Confirm name, address, HOC, and HOC-plus-one-year due date match the authorized database row.
6. Click the bottom Download PDF button and confirm it downloads without a second network request.
7. Attempt the endpoint with another customer’s record ID and confirm `404`.

- [ ] **Step 9: Commit the Customer Dashboard integration**

```bash
git add components/customer/CustomerDocumentsPanel.jsx pages/Customerdashboard.jsx lib/customerHandoverDocument.js scripts/customer-handover-document.test.mjs
git commit -m "Show handing-over PDFs in customer documents"
```

---

## Final Verification

- [ ] Run the complete test suite with the project environment:

```bash
node --env-file=.env.local --test scripts/*.test.mjs
```

- [ ] Run lint across every changed source and test file:

```bash
npx eslint \
  lib/customerHandoverDocument.js \
  lib/customerHandoverPdf.js \
  lib/customerHandoverHandler.js \
  lib/customerDocumentResource.js \
  components/customer/CustomerDocumentsPanel.jsx \
  'pages/api/customer/documents/handing-over/[customerId].js' \
  pages/Customerdashboard.jsx \
  scripts/customer-handover-document.test.mjs \
  scripts/customer-handover-pdf.test.mjs \
  scripts/customer-handover-api.test.mjs \
  scripts/customer-document-resource.test.mjs
```

- [ ] Run the production build:

```bash
npm run build
```

- [ ] Confirm no whitespace errors and no confidential outputs are staged:

```bash
git diff --check
git status --short
```

Expected: tests, lint, and build exit 0; `output/` remains untracked and unstaged.

- [ ] Re-render the final normal, long-value, and fallback PDFs and inspect every page at 100% before claiming visual completion.
