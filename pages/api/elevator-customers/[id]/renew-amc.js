import { createAuditLog } from "@/lib/auditLog";
import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const VALID_STATUSES = new Set(["AMC", "EMC", "WARRANTY", "OUT OF WARRANTY", "PENDING", "ON GOING"]);

function normalizeDate(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`${label} is required`);
  }

  const trimmed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must be a valid date`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${label} must be a valid date`);
  }

  return trimmed;
}

function optionalDate(value, fallback, label) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }

  return normalizeDate(value, label);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

    const existingResult = await query(
      `
      SELECT *
      FROM elevator_service_customers
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const body = req.body || {};
    let startDate;
    let endDate;
    let dueDate;

    try {
      startDate = normalizeDate(body.startDate, "Start date");
      endDate = normalizeDate(body.endDate, "End date");
      dueDate = optionalDate(body.dueDate, endDate, "Due date");
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message || "Invalid renewal date",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: "End date must be on or after start date",
      });
    }

    const renewalType = String(body.renewalType || "AMC").trim().toUpperCase();
    const status = String(body.status || "AMC").trim().toUpperCase();

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer status",
      });
    }

    const oldCustomer = existingResult.rows[0];
    const notes = body.notes === null || body.notes === undefined ? "" : String(body.notes).trim();
    const amount = body.amount === null || body.amount === undefined || String(body.amount).trim() === ""
      ? null
      : String(body.amount).trim();

    const appendedRemarks = notes
      ? [oldCustomer.remarks, `AMC Renewal (${renewalType}) ${startDate} to ${endDate}: ${notes}`]
          .filter(Boolean)
          .join("\n")
      : oldCustomer.remarks;

    const updatedResult = await query(
      `
      UPDATE elevator_service_customers
      SET
        customer_status = $2,
        amc_starting_date = $3,
        amc_ending_date = $4,
        amc_warranty_due = $5,
        remarks = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, status, startDate, endDate, dueDate, appendedRemarks]
    );

    const updatedCustomer = updatedResult.rows[0];

    await createAuditLog({
      req,
      actor: user,
      entityType: "CUSTOMER",
      entityId: id,
      action: "AMC_RENEWED",
      oldValues: {
        customer_status: oldCustomer.customer_status,
        amc_starting_date: oldCustomer.amc_starting_date,
        amc_ending_date: oldCustomer.amc_ending_date,
        amc_warranty_due: oldCustomer.amc_warranty_due,
        remarks: oldCustomer.remarks,
      },
      newValues: {
        renewalType,
        customer_status: status,
        amc_starting_date: startDate,
        amc_ending_date: endDate,
        amc_warranty_due: dueDate,
        amount,
        notes,
        remarks: appendedRemarks,
      },
      changedFields: ["customer_status", "amc_starting_date", "amc_ending_date", "amc_warranty_due", "remarks"],
    });

    return res.status(200).json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Failed to renew AMC:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to renew AMC",
    });
  }
}
