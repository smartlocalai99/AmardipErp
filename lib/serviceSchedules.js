import { query } from "@/lib/db";

export const ACTIVE_SCHEDULE_STATUSES = [
  "SCHEDULED",
  "ASSIGNED",
  "IN_PROGRESS",
  "MISSED",
];

export const ALLOWED_SCHEDULE_STATUSES = [
  ...ACTIVE_SCHEDULE_STATUSES,
  "COMPLETED",
  "CANCELLED",
];

export const ALLOWED_PRIORITIES = ["LOW", "NORMAL", "HIGH", "EMERGENCY"];

export async function ensureServiceSchedulesTable() {
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await query(`
    CREATE TABLE IF NOT EXISTS service_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      customer_id UUID NOT NULL REFERENCES elevator_service_customers(id) ON DELETE CASCADE,

      schedule_month DATE NOT NULL,
      scheduled_date DATE,
      preferred_time TEXT,

      status TEXT NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED')),
      priority TEXT NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'EMERGENCY')),

      service_type TEXT NOT NULL DEFAULT 'MONTHLY_SERVICE',

      assigned_technician_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_technician_name TEXT,

      notes TEXT,
      admin_notes TEXT,

      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      completed_service_visit_id UUID REFERENCES elevator_service_visits(id) ON DELETE SET NULL,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_service_schedules_customer_id ON service_schedules(customer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_service_schedules_schedule_month ON service_schedules(schedule_month)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_service_schedules_scheduled_date ON service_schedules(scheduled_date)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_service_schedules_status ON service_schedules(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_service_schedules_technician ON service_schedules(assigned_technician_user_id)`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_schedules_unique_customer_month
    ON service_schedules(customer_id, schedule_month, service_type)
    WHERE status NOT IN ('CANCELLED')
  `);
}

export function cleanNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}
