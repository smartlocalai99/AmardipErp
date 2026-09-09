-- ─────────────────────────────────────────────────────────────────────────────
-- Amardip Elevators — Performance Indexes
-- Optional maintenance after reviewing EXPLAIN plans and storage usage.
-- Reuse the original schema index names: IF NOT EXISTS only checks the name,
-- so giving an existing index a new name would allocate a duplicate copy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── elevator_service_customers ──────────────────────────────────────────────
-- Existing index supports raw status equality. UPPER(TRIM(...)) expressions
-- are not covered by this plain-column index.
CREATE INDEX IF NOT EXISTS idx_elevator_customers_status
  ON elevator_service_customers (customer_status);

-- Used in ORDER BY and lookup by code
CREATE INDEX IF NOT EXISTS idx_elevator_customers_code
  ON elevator_service_customers (customer_code);

-- Exact phone lookup; regexp-normalized matching requires a different plan.
CREATE INDEX IF NOT EXISTS idx_elevator_customers_mobile
  ON elevator_service_customers (mobile_no);

-- record_no is already indexed by elevator_service_customers_record_no_key.

-- ── elevator_service_visits ─────────────────────────────────────────────────
-- Heavy: all upcoming/report queries filter service_date >= start-of-month
CREATE INDEX IF NOT EXISTS idx_service_visits_service_date
  ON elevator_service_visits (service_date);

-- JOIN key: service_visits JOIN customers ON customer_id
CREATE INDEX IF NOT EXISTS idx_service_visits_customer_id
  ON elevator_service_visits (customer_id);

-- Candidate for NOT EXISTS (customer_id AND date range); measure its benefit.
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

-- username is already indexed by the users_username_key unique constraint.

-- ── complaints (already handled by ensureComplaintsTable — listed for reference)
-- idx_complaints_status, idx_complaints_created_at, idx_complaints_assigned_worker
-- These are created automatically in lib/complaints.js on first request.
