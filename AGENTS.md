<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Database free-tier budget

- The owner wants to stay on Neon's free tier. Evaluate database storage, compute time, transferred bytes, connection lifetime, and unnecessary writes for every data-related change.
- Keep the pooled DATABASE_URL and the small shared connection pool. Use `withTransaction` from `lib/db.js` for multi-query writes; never send BEGIN/COMMIT through shared pool.query calls. Await all DB work and keep external network calls outside transactions.
- Reuse concurrent reads, cancel superseded searches, fetch only needed fields, and use bounded pagination. Preserve live counts and existing complete-history behavior; never silently truncate results to reduce usage.
- Skip unchanged upserts, batch related work, and initialize schemas once per warm process with failure retry. Check existing equivalent indexes before adding one: UNIQUE constraints already provide indexes.
- Run `npm run db:capacity` for read-only size/connection/index metadata when doing database optimization. Check Neon Console for project-wide storage and monthly compute/transfer; SQL size alone cannot prove remaining free-tier allowance. Avoid keep-alive queries and frequent monitoring cron jobs.
- Preserve business records, signatures, audit history, and source imports. Propose a concrete export/retention policy before deleting or archiving existing data. Do not change billing plans or enable paid services without explicit authorization.
- Verify relevant regression tests and the production build. Keep current limits and operational guidance in PERFORMANCE_CHECKLIST.md, with primary-source links and verification dates.
