import { ensureAuditLogTable } from "@/lib/auditLog";
import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (BLOCKED_ROLES.has(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not allowed",
      });
    }

    const id = String(req.query.id || "").trim();
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    await ensureAuditLogTable();

    const logsResult = await query(
      `
      SELECT
        id,
        actor_username AS "actorUsername",
        actor_role AS "actorRole",
        action,
        changed_fields AS "changedFields",
        old_values AS "oldValues",
        new_values AS "newValues",
        created_at AS "createdAt"
      FROM admin_audit_logs
      WHERE entity_type = 'CUSTOMER'
        AND entity_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      logs: logsResult.rows,
    });
  } catch (error) {
    console.error("Failed to fetch customer audit logs:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer audit logs",
    });
  }
}
