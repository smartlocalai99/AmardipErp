import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ALLOWED_PRIORITIES,
  cleanNumber,
  ensureServiceSchedulesTable,
} from "@/lib/serviceSchedules";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);

async function requireAdmin(req, res) {
  const user = await getUserFromRequest(req);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
    return null;
  }

  if (BLOCKED_ROLES.has(user.role)) {
    res.status(403).json({
      success: false,
      message: "Not allowed",
    });
    return null;
  }

  return user;
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    await ensureServiceSchedulesTable();

    if (req.method === "GET") {
      const page = cleanNumber(req.query.page, 1, 1, 999999);
      const pageSize = cleanNumber(req.query.pageSize, 25, 10, 100);
      const offset = (page - 1) * pageSize;

      const countResult = await query(`
        SELECT COUNT(*)::int AS total
        FROM service_schedules
      `);

      const total = countResult.rows[0]?.total || 0;

      const schedulesResult = await query(
        `
        SELECT
          s.*,
          c.customer_code,
          c.customer_name,
          c.mobile_no,
          c.city,
          c.customer_status
        FROM service_schedules s
        JOIN elevator_service_customers c ON c.id = s.customer_id
        ORDER BY
          s.schedule_month DESC,
          s.scheduled_date ASC NULLS LAST,
          s.created_at DESC
        LIMIT $1
        OFFSET $2
        `,
        [pageSize, offset]
      );

      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return res.status(200).json({
        success: true,
        schedules: schedulesResult.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasPrev: page > 1,
          hasNext: page < totalPages,
        },
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }

    const {
      customerId,
      scheduledDate,
      preferredTime,
      assignedTechnicianUserId,
      assignedTechnicianName,
      priority,
      notes,
    } = req.body || {};

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer is required",
      });
    }

    const cleanPriority = String(priority || "NORMAL").trim().toUpperCase();

    if (!ALLOWED_PRIORITIES.includes(cleanPriority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority",
      });
    }

    const customerResult = await query(
      `
      SELECT id, customer_code, customer_name
      FROM elevator_service_customers
      WHERE id = $1
      LIMIT 1
      `,
      [customerId]
    );

    if (customerResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const technicianName = String(assignedTechnicianName || "").trim();
    const technicianUserId = assignedTechnicianUserId
      ? Number.parseInt(assignedTechnicianUserId, 10)
      : null;
    const status = technicianName || technicianUserId ? "ASSIGNED" : "SCHEDULED";

    try {
      const insertResult = await query(
        `
        INSERT INTO service_schedules (
          customer_id,
          schedule_month,
          scheduled_date,
          preferred_time,
          status,
          priority,
          service_type,
          assigned_technician_user_id,
          assigned_technician_name,
          notes,
          created_by_user_id
        )
        VALUES (
          $1,
          date_trunc('month', CURRENT_DATE)::date,
          NULLIF($2, '')::date,
          NULLIF($3, ''),
          $4,
          $5,
          'MONTHLY_SERVICE',
          $6,
          NULLIF($7, ''),
          NULLIF($8, ''),
          $9
        )
        RETURNING *
        `,
        [
          customerId,
          scheduledDate || "",
          String(preferredTime || "").trim(),
          status,
          cleanPriority,
          Number.isNaN(technicianUserId) ? null : technicianUserId,
          technicianName,
          String(notes || "").trim(),
          user.id,
        ]
      );

      return res.status(201).json({
        success: true,
        schedule: insertResult.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This customer is already scheduled for this month.",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Service schedule API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process service schedule",
    });
  }
}
