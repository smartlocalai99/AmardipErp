# Amardip ERP — Free-tier database checklist

The owner wants to stay on Neon's free plan. Reduce storage growth, active compute time, network transfer, and avoidable writes together. No optimization can guarantee unlimited growth inside a fixed allowance.

## Current limits and measured baseline

Verified on 7 September 2026 against [Neon pricing](https://neon.com/pricing): 0.5 GB storage per project, 100 CU-hours per project per month, and 5 GB public network transfer. Free compute scales to zero after five minutes of inactivity. Check the console for the actual project plan and usage; SQL access does not expose monthly billing meters.

Read-only inspection of the configured database on that date:

| Measurement | Result |
| --- | --- |
| Current database size, including indexes/catalogs | 32,325,632 bytes / 32.33 MB |
| Conservative local storage budget | 500 MB; current size 6.5% |
| Largest table including indexes | `elevator_service_visits`, 20.26 MB |
| Service-history rows | Approximately 6,555 (Postgres statistics estimate) |
| Potential duplicate indexes | Six candidates totaling 671,744 bytes; review only |
| Pool endpoint | Neon pooled connection |

This is one database's logical size, not all project branches, history storage, or monthly compute/transfer. No business records or live indexes were deleted. The inspection found no idle-in-transaction connections in its snapshot; this does not prove none can occur at other times.

## Check capacity without a paid service

Run locally on demand, before a large import, or weekly during active use:

```bash
npm run db:capacity
npm run db:capacity -- --json
npm run db:capacity -- --check
```

The command loads the normal Next environment (including `.env.local`), uses one connection and a read-only transaction, and prints only metadata: size, largest tables, estimated dead rows, connection states, and candidate equivalent indexes. `--check` exits unsuccessfully at 70% of the local budget; 85% is critical. Set `DB_STORAGE_BUDGET_MB` to use a smaller budget. The default is deliberately 500 decimal MB.

Also check Neon Console usage for project-wide storage, monthly CU-hours, and network transfer. Set a calendar reminder if needed. Do not add frequent health queries, polling, or a keep-alive cron: they wake the database and consume the compute allowance. This command does not create background monitoring or alerts.

At 70%: identify the growing tables and unnecessary writes, review duplicate indexes, and prepare export/retention options. At 85%: review large imports and storage-heavy features before adding more data. Never silently discard financial, service, customer, audit, or signature records to stay below a quota.

## Changes made in this audit

- Database writes now use a checked-out transaction client and always release it. Shared `pool.query('BEGIN')` calls were removed. Request-local context keeps nested helper queries in the correct transaction. Transaction-local statement, lock, and idle timeouts limit abandoned work.
- Job completion atomically claims the still-open assignment before adding completion/history records. A repeated submission receives a conflict instead of duplicating records and notifications.
- Module availability uses two queries instead of 18. Service-history statistics combine seven independent aggregates in one scan while keeping counts fresh.
- Assignment replacement changes only removed/new members in one statement; unchanged memberships preserve their original rows and timestamps. Unchanged push subscriptions skip updates.
- Concurrent passkey, push, inventory, audit, warranty, and notification schema checks share initialization and retry if setup fails. Inventory no longer drops and revalidates its transaction constraint on every cold start.
- Browser live reads share concurrent requests, superseded searches are cancelled, and searching complaints no longer reloads global totals. The redundant quotation-list and locked-customer directory downloads were removed.
- Cache results cannot overwrite a newer refresh or repopulate storage after mutation invalidation. Browser cache retention is bounded to 100 entries and 24 hours. Auth failures and cancellations cannot fall back to old cached records.
- Index maintenance reuses existing schema names and skips indexes already provided by unique constraints. Existing live duplicate candidates were only reported, not dropped.

## Continue using these defaults

- Keep the pooled `DATABASE_URL`. `max: 1` is an application concurrency budget, not a Neon free-tier connection limit. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling) documents the provider limits.
- Use `withTransaction` from `lib/db.js` for related writes, await all DB work, and keep Sheets, geocoding, and push network calls outside transactions. Initialize required schemas before entering the business transaction so a rollback cannot invalidate a cached setup result.
- Keep `vercel.json` in the database region (`sin1` for the currently documented Singapore setup). Allow occasional cold starts instead of adding keep-alive traffic.
- Preserve live operational counts. Cache stable lookups with user-scoped keys and invalidate them after mutations. Avoid downloading a list just to obtain a permission or count.
- Bound new lists and select only needed fields. Existing full-history screens intentionally support complete reporting; pagination changes must preserve access to all records and existing search behavior.
- Keep the sync's existing `IS DISTINCT FROM` checks so unchanged imported service rows are not rewritten. Keep source keys idempotent.
- Generate PDF documents on demand. Audio is currently processed without being stored in Postgres. Completion signatures and imported source JSON do occupy DB space; inspect actual growth before changing format or introducing storage services.
- Expired passkey challenges and dead push endpoints already have cleanup paths. Audit history and customer notifications have no automatic retention deletion. An explicit retention/export decision is needed before removing existing records.
- Review equivalent index definitions before adding any. `UNIQUE` and primary-key constraints already provide indexes. The admin maintenance endpoint is an explicit maintenance action, not something to run after every deployment.
- Leave autovacuum enabled. Estimated dead rows are not a precise bloat measurement. Avoid routine `VACUUM FULL`, mass deletes, or reindexing on the live app.

## Verification

```bash
npm test
npm run lint
npm run build
npm run db:capacity
```

Automated regressions cover concurrent query isolation, rollback/release, socket failures, rejected late transaction work, duplicate completion prevention, schema initialization/retry, cache races/cancellation, query budgets, and capacity thresholds. Most tests use fixtures/stubs; the existing date-parser test runs a read-only SQL fixture using DATABASE_URL. No test mutates the live database. A successful local build does not deploy these optimizations; production behavior changes after the normal deployment.

Audit validation: 78 tests passed, and the production build passed. Real in-memory PostgreSQL fixtures verified equivalent aggregates, unchanged assignment rows, foreign-key rollback, and index creation. The updated transaction helper also completed two concurrent read-only transactions against Neon and released both checkouts. Changed application files pass targeted lint. Repository-wide lint has existing errors in Storedashboard, Techniciandashboard, and admin/quotations; its default traversal also includes generated files in .worktrees. These are outside this database change.
