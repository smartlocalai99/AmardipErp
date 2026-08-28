# Admin AMC Date Fix Design

## Problem

The Admin overview correctly receives live totals for customers, AMC accounts,
and upcoming monthly services. The Admin AMC date buckets do not work because
the customer import stores dates as text, predominantly in `D/M/YYYY` or
`DD/MM/YYYY` form, while the AMC APIs only accept ISO `YYYY-MM-DD` text.

This makes every imported due date evaluate to `NULL`, so Expired, This Month,
Next Month, due-date filters, reminder matching, and AMC status badges all show
zero or `Missing` despite valid dates being present.

## Required behavior

- Continue accepting ISO `YYYY-MM-DD` dates written by the in-app renewal flow.
- Accept valid imported `D/M/YYYY` and `DD/MM/YYYY` dates.
- Reject impossible dates such as `31/9/2025` instead of normalizing them.
- Use `amc_warranty_due` first, falling back to `amc_ending_date`.
- Restrict expired/month buckets to service-contract statuses: AMC, EMC, and
  WARRANTY.
- Keep Total Customers, AMC status count, and Upcoming Services backed by their
  existing live APIs.
- Use the same parsing rules in Admin API filters, reminder matching, and the
  two Admin customer tables' AMC status badges.

## Scope

Create one shared customer-date module containing a JavaScript parser and a
safe PostgreSQL expression builder. Update only the Admin customer/AMC paths
that currently duplicate the broken parser. Do not rewrite imported records or
alter database schema.

## Verification

- A test must fail before implementation because the shared parser is absent.
- The test must exercise the generated PostgreSQL expression against controlled
  `VALUES` rows, not inspect SQL source text.
- Live read-only database checks must return non-zero real date buckets.
- Browser verification must confirm Admin cards and the Expired/Next Month
  lists show records.
- Focused tests and the production build must pass.
