# Amardip ERP — Performance Checklist

## After every deploy

- [ ] Open `/api/admin/apply-indexes` (logged in as superadmin) — applies DB indexes, safe to re-run

---

## Vercel settings

| Setting | Value |
|---|---|
| Function region | **sin1** (Singapore) — set in `vercel.json`, matches Neon region |
| Neon branch | `main` — always use the pooler URL |

**Why sin1?** Neon is in `ap-southeast-1` (Singapore). Vercel's default region is `iad1`
(US East), which adds 250–350 ms round-trip latency per DB call. Setting `sin1` cuts
that to <5 ms.

---

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (ends in `-pooler.…neon.tech`) |
| `DIRECT_DATABASE_URL` | Neon **direct** string (without `-pooler`) — only if you run migrations |
| `JWT_SECRET` | Long random string — set this, do not rely on the hardcoded fallback |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_EMAIL` | `mailto:amardipelevators@gmail.com` |

**How to get the pooled connection string:**  
Neon Console → your project → Connection Details → choose **Pooled connection** toggle
→ copy the string. It ends with `-pooler.c-2.ap-southeast-1.aws.neon.tech`.

---

## Neon plan

| Symptom | Action |
|---|---|
| First request after >5 min is slow (cold start + Neon wake-up) | **Upgrade to Neon Launch ($19/mo)** — disables auto-suspend |
| Connection errors under load | Upgrade to Neon Launch — 100 connections vs free tier's 5 |
| App is fine, just occasional 2 s first load | Stay on free tier — acceptable for low traffic |

**How to check if Neon is sleeping:**  
Neon Console → Compute → "Computes" tab — green dot = active, grey = suspended.
The first query after suspension takes 1–3 seconds to wake. All subsequent queries
within 5 minutes are fast.

---

## Vercel plan

| Need | Plan |
|---|---|
| Basic app, <100 req/min | Hobby (free) — fine |
| Faster cold starts, analytics, custom domains | Pro ($20/mo) |
| Edge functions for sub-50 ms auth | Pro |

For this app at current scale: **free tier is sufficient**. Upgrade if you see
sustained >3 s load times after the DB and region fixes are applied.

---

## Measuring API response time

1. **Vercel Dashboard** → Functions tab → click any function → see duration histogram
2. **Browser DevTools** → Network tab → look at `Time` column for `/api/*` calls
3. **Vercel Log Drain** — enable in Project Settings for structured JSON logs
4. **In code** — the `query()` function in `lib/db.js` logs any query taking >200 ms:
   ```
   [DB 342ms rows=1] SELECT COUNT(*)::int AS total_customers ...
   ```
   View these in Vercel → Logs → filter by your function name.

---

## What was slow and what was fixed

| Issue | Before | After |
|---|---|---|
| `ensureServiceSchedulesTable()` had no guard | 7 DDL queries per cold-start request | 0 after first warm invocation |
| Vercel region `iad1` vs Neon `sin1` | +250 ms per DB round-trip | <5 ms (same region) |
| Pool `max` unset (default 10) | Could exhaust Neon's 5-connection limit | `max: 1`, PgBouncer handles the rest |
| Stats endpoints hit DB on every call | Full aggregate query each request | 5-min server-side cache + `stale-while-revalidate` |
| Query logger printed full SQL on every query | Large log volume in production | Only logs queries >200 ms |
| Missing indexes on `elevator_service_visits` | Sequential scan on every report | B-tree index on `(customer_id, service_date)` |

---

## Expected response times after fixes

| Endpoint | Before | After |
|---|---|---|
| `/api/elevator-customers/stats` (warm) | 400–800 ms | <10 ms (cached) |
| `/api/elevator-service-visits/stats` (warm) | 600–1200 ms | <10 ms (cached) |
| `/api/elevator-customers` (list) | 300–600 ms | 150–300 ms |
| `/api/complaints` (list) | 300–500 ms | 150–250 ms |
| `/api/admin/reports/summary` (warm) | 1–2 s | <10 ms (cached) |
| First request after Neon sleep | 3–5 s | 3–5 s (unchanged — needs paid plan) |
| First request on cold Vercel lambda | 1–2 s | 500 ms–1 s (no DDL overhead) |

---

## Quick test after deploy

```bash
# Test response time from terminal
curl -w "\n\nTotal: %{time_total}s\n" -o /dev/null -s \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  https://your-app.vercel.app/api/elevator-customers/stats
```

First call: expect 300–600 ms (DB query + cold start).  
Second call immediately after: expect <50 ms (server cache hit).
