import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

// Run this ONCE after deploy to create performance indexes in Neon.
// Access: GET /api/admin/apply-indexes  (must be logged in as superadmin)
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getUserFromRequest(req);
  if (!user || user.role !== "superadmin") {
    return res.status(403).json({ success: false, message: "Superadmin only." });
  }

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_esc_customer_status ON elevator_service_customers (customer_status)`,
    `CREATE INDEX IF NOT EXISTS idx_esc_customer_code ON elevator_service_customers (customer_code)`,
    `CREATE INDEX IF NOT EXISTS idx_esc_mobile_no ON elevator_service_customers (mobile_no)`,
    `CREATE INDEX IF NOT EXISTS idx_esc_record_no ON elevator_service_customers (record_no)`,
    `CREATE INDEX IF NOT EXISTS idx_esv_service_date ON elevator_service_visits (service_date DESC NULLS LAST)`,
    `CREATE INDEX IF NOT EXISTS idx_esv_customer_id ON elevator_service_visits (customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_esv_customer_id_date ON elevator_service_visits (customer_id, service_date DESC NULLS LAST)`,
    `CREATE INDEX IF NOT EXISTS idx_ss_customer_month_status ON service_schedules (customer_id, schedule_month, status)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`,
  ];

  const results = [];
  for (const sql of indexes) {
    try {
      await query(sql);
      results.push({ sql: sql.slice(0, 80), ok: true });
    } catch (err) {
      results.push({ sql: sql.slice(0, 80), ok: false, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
}
