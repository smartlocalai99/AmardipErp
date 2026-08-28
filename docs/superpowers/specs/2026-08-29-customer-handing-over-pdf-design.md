# Customer Handing-Over PDF Design

## Purpose

Give every logged-in customer access to a customer-specific handing-over letter in the existing Customer Dashboard Documents tab. Each eligible lift gets its own PDF. The PDF is generated only when opened, displays inside the portal first, and can then be downloaded from a button below the viewer.

## Current State

- The Customer Dashboard already has a Documents tab, search field, preview modal, and download button styling.
- Its `documents` collection is currently empty and the preview/download behavior is placeholder-only.
- Customer users may be linked to more than one `elevator_service_customers` record through `customer_user_links`.
- The customer data already includes customer name, address, city, lift/customer code, lift details, and HOC date.
- The uploaded handing-over letter supplies the body wording.
- `public/template_for_header_footer.docx` supplies the Amardip letterhead design.
- Existing imported customer records are not linked to quotation records, so quotation dates cannot be populated reliably.

## Eligibility

A handing-over document is available only when all of the following are true:

1. The requester has a valid authenticated customer session.
2. The requested lift/customer record is linked to that user through `customer_user_links`.
3. The record contains a valid HOC date supported by the shared customer-date parser.

Records without a valid HOC date do not appear in the Documents list, and the PDF endpoint does not generate a document for them.

## Customer Experience

- The Documents tab shows one `Handing Over Letter` entry per eligible linked lift.
- Each entry includes enough lift identity to distinguish multiple records, using customer/lift code and the available elevator label.
- Search continues to filter the visible document entries.
- Selecting an entry fetches its PDF once and opens an in-app PDF viewer.
- A `Download PDF` button appears below the viewer and downloads the already-loaded PDF blob, avoiding a second API or database request.
- Closing the viewer releases the temporary browser object URL.
- No background polling or pre-generation occurs.

## Document Content

The generated letter preserves the meaning of the uploaded handing-over letter while using the supplied Amardip header/footer template.

Dynamic values are mapped as follows:

| Letter value | Source or rule |
| --- | --- |
| Customer name | `elevator_service_customers.customer_name` |
| Recipient location line | Uppercase customer `city`; otherwise the first non-empty `location` or `address`; omit only when all are empty |
| Installation address | Non-empty `address` and `city` joined with a comma; otherwise `location`; otherwise `your premises` |
| Lift description | Customer `elevator_type`; otherwise `<no_of_passenger> Passenger Lift`; otherwise `Passenger Lift` |
| Customer/lift reference | `customer_code`; fallback to `record_no` |
| HOC date | Parsed customer `hoc_date`, formatted `DD/MM/YYYY` |
| AMC/warranty due | Exactly one calendar year after HOC, formatted `DD/MM/YYYY` |

The HOC date is used in all three places required by the letter: letter date, commissioning date, and warranty commencement date.

The quotation wording becomes:

> as per the specifications agreed with you

No quotation date is shown because existing customers do not have a reliable quotation relationship.

The body copy is:

> **Sub: Handing over of Lift duly erected, tested & operated in full shape - Regarding.**
>
> We are happy to inform you that we have completed the erection of the [lift description] at [installation address], as per the specifications agreed with you. We have tested and commissioned the above lift in your presence on [HOC date].
>
> Our service warranty for the above lift commences on [HOC date] and expires on [AMC/warranty due date]. Our warranty is limited to manufacturing defects only. The warranty does not cover damage caused to the lift by natural calamities, acts of God, external power-supply fluctuations, or short circuits.
>
> We assure you of our best services always.

The addressee block remains `To, MR/MS [customer name]`, followed by the recipient location line when available. The closing remains `Thanking you sir` and `Yours sincerely`.

The warranty due date is the same calendar day and month in the following year. For a 29 February HOC followed by a non-leap year, the anniversary is 28 February.

## PDF Rendering

- Convert `public/template_for_header_footer.docx` once during implementation into a high-resolution, page-sized letterhead background asset suitable for the deployed runtime.
- Keep the DOCX as the editable source template and commit the generated background beside the application assets.
- Generate the PDF on demand with the already-installed `jspdf` package in the server API.
- Place the dynamic letter body inside the safe content area between the header and footer.
- Wrap long customer names and addresses without overlapping the letterhead or footer.
- Produce one US Letter page, matching the source template's `8.5 × 11 inch` page geometry. Long values must wrap or reduce locally without creating a second page.
- Return `Content-Type: application/pdf` and an inline filename suitable for later download.
- Return `Cache-Control: private, no-store` so changed customer data is reflected on the next open.

## Server API and Security

Add `GET /api/customer/documents/handing-over/[customerId]` under the existing Pages Router API structure, scoped to one customer/lift record.

The endpoint will:

1. Accept only `GET`.
2. Authenticate with the existing `auth_token` flow.
3. Require the `customer` role.
4. Query the requested customer record through a join with `customer_user_links` using the authenticated user ID.
5. Return a not-found response when the record is absent, not linked to the user, or lacks a valid HOC date.
6. Generate and stream the PDF only after authorization and eligibility checks pass.

The endpoint never trusts customer identity, customer name, dates, or addresses supplied by the browser. All document values come from the authorized database query.

## Client Data Flow

The existing server-rendered `customerRecords` payload is sufficient to build the Documents list, so no separate list endpoint or additional database request is required.

When an eligible entry is opened:

1. The client requests that record’s handing-over PDF endpoint.
2. The response is converted to a browser `Blob`.
3. One object URL is used by both the embedded viewer and the bottom download button.
4. The object URL is revoked when replaced, when the modal closes, or when the component unmounts.

Loading and failure states appear inside the document modal. An endpoint failure does not affect the rest of the Customer Dashboard.

## Error Handling

- Invalid or expired session: use the existing authentication behavior.
- Wrong role: return forbidden.
- Unlinked or unknown customer record: return not found without revealing whether another customer owns it.
- Missing or invalid HOC date: return not found and omit the entry from the list.
- PDF-generation failure: return a generic server error and show a retryable message in the viewer.
- Missing optional address or lift-description fields: use documented fallbacks rather than blocking generation.

## Testing and Verification

Automated tests will cover:

- one visible document per eligible linked lift;
- omission of records with missing or invalid HOC dates;
- exact one-calendar-year due-date calculation, including leap-day behavior;
- customer ownership enforcement and cross-customer access denial;
- use of database values rather than request-provided values;
- successful PDF response headers and non-empty output;
- reuse of the already-loaded PDF blob for download, with no second PDF request.

Verification will include:

- lint and production build;
- the complete existing test suite;
- rendered PDF inspection for a normal record, a long customer name/address, and missing optional fields;
- Customer Dashboard flow verification: Documents list, opening the viewer, and downloading the same PDF.

## Non-Goals

- No bulk PDF generation.
- No database table or file-storage system for generated PDFs.
- No background refresh or polling.
- No Admin document-management workflow in this change.
- No quotation-date backfill.
- No handing-over document for records without a valid HOC date.
