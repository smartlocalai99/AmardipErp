-- ─────────────────────────────────────────────────────────────────────────────
-- Amardip Elevators — Performance Indexes
-- Run this once in Neon SQL editor (or let /api/admin/apply-indexes do it).
-- All statements are idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── elevator_service_customers ──────────────────────────────────────────────
-- Used in WHERE UPPER(TRIM(customer_status)) = 'AMC' etc. (stats, reports, upcoming)
CREATE INDEX IF NOT EXISTS idx_esc_customer_status
  ON elevator_service_customers (customer_status);

-- Used in ORDER BY and lookup by code
CREATE INDEX IF NOT EXISTS idx_esc_customer_code
  ON elevator_service_customers (customer_code);

-- Used in phone-based customer lookup for complaints (regexp match fallback)
CREATE INDEX IF NOT EXISTS idx_esc_mobile_no
  ON elevator_service_customers (mobile_no);

-- Used in ORDER BY record_no ASC
CREATE INDEX IF NOT EXISTS idx_esc_record_no
  ON elevator_service_customers (record_no);

-- ── elevator_service_visits ─────────────────────────────────────────────────
-- Heavy: all upcoming/report queries filter service_date >= start-of-month
CREATE INDEX IF NOT EXISTS idx_esv_service_date
  ON elevator_service_visits (service_date DESC NULLS LAST);

-- JOIN key: service_visits JOIN customers ON customer_id
CREATE INDEX IF NOT EXISTS idx_esv_customer_id
  ON elevator_service_visits (customer_id);

-- Composite used in NOT EXISTS (customer_id AND date range) — eliminates sequential scan
CREATE INDEX IF NOT EXISTS idx_esv_customer_id_date
  ON elevator_service_visits (customer_id, service_date DESC NULLS LAST);

-- ── service_schedules ───────────────────────────────────────────────────────
-- Already created by ensureServiceSchedulesTable, but included here for reference.
-- These are verified to exist after first cold-start.
-- idx_service_schedules_customer_id        — customer_id FK lookup
-- idx_service_schedules_schedule_month     — WHERE schedule_month = current month
-- idx_service_schedules_status             — WHERE status IN (...)
-- idx_service_schedules_unique_customer_month — UNIQUE constraint

-- Composite: the upcoming query filters on (customer_id, schedule_month, status)
CREATE INDEX IF NOT EXISTS idx_ss_customer_month_status
  ON service_schedules (customer_id, schedule_month, status);

-- ── users ───────────────────────────────────────────────────────────────────
-- fetchUsers filters by role = 'worker'
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

-- Login and session lookup
CREATE INDEX IF NOT EXISTS idx_users_username
  ON users (username);

-- ── complaints (already handled by ensureComplaintsTable — listed for reference)
-- idx_complaints_status, idx_complaints_created_at, idx_complaints_assigned_worker
-- These are created automatically in lib/complaints.js on first request.
