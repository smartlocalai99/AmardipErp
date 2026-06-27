import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureServiceSchedulesTable } from "@/lib/serviceSchedules";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const ALLOWED_STATUSES = ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (BLOCKED_ROLES.has(user.role)) return res.status(403).json({ success: false, message: "Not allowed" });

  await ensureServiceSchedulesTable();

  const id = Number.parseInt(req.query.id, 10);
  if (!id || Number.isNaN(id)) return res.status(400).json({ success: false, message: "Invalid id" });

  if (req.method === "PATCH") {
    const { status } = req.body || {};
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const result = await query(
      `UPDATE service_schedules SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Not found" });
    return res.status(200).json({ success: true, schedule: result.rows[0] });
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
