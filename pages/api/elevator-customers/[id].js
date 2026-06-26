import { getUserFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";
import { query } from "@/lib/db";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const DATE_FIELDS = new Set(["hoc_date", "amc_warranty_due", "amc_starting_date", "amc_ending_date"]);
const ALLOWED_UPDATE_FIELDS = [
  "customer_name",
  "address",
  "city",
  "mobile_no",
  "hoc_date",
  "customer_status",
  "amc_warranty_due",
  "amc_starting_date",
  "amc_ending_date",
  "no_of_passenger",
  "door_type",
  "cabin",
  "no_of_floors",
  "motor_make",
  "controller_make",
  "drive_make",
  "ard_make",
  "drive_model_no",
  "motor_model_no",
  "elevator_type",
  "door_make",
  "location",
  "remarks",
];

const CUSTOMER_SELECT = `
  SELECT
    id,
    record_no,
    customer_code,
    customer_name,
    address,
    city,
    mobile_no,
    hoc_date,
    customer_status,
    amc_warranty_due,
    amc_starting_date,
    amc_ending_date,
    no_of_passenger,
    door_type,
    cabin,
    no_of_floors,
    motor_make,
    controller_make,
    drive_make,
    ard_make,
    drive_model_no,
    motor_model_no,
    elevator_type,
    door_make,
    location,
    remarks
  FROM elevator_service_customers
`;

function normalizeDateValue(value, field) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const trimmed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${field} must be a valid date`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new Error(`${field} must be a valid date`);
  }

  return trimmed;
}

function normalizeValue(field, value) {
  if (DATE_FIELDS.has(field)) {
    return normalizeDateValue(value, field);
  }

  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function sameValue(a, b) {
  const left = a === null || a === undefined ? "" : String(a);
  const right = b === null || b === undefined ? "" : String(b);
  return left === right;
}

export default async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
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

    const result = await query(
      `${CUSTOMER_SELECT} WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (req.method === "GET") {
      return res.status(200).json({
        success: true,
        customer: result.rows[0],
      });
    }

    const body = req.body || {};

    if (Object.prototype.hasOwnProperty.call(body, "id")) {
      return res.status(400).json({
        success: false,
        message: "Customer ID cannot be changed",
      });
    }

    const updates = {};
    const oldValues = {};
    const newValues = {};
    const changedFields = [];

    try {
      ALLOWED_UPDATE_FIELDS.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(body, field)) return;

        const normalized = normalizeValue(field, body[field]);

        if (!sameValue(result.rows[0][field], normalized)) {
          updates[field] = normalized;
          oldValues[field] = result.rows[0][field] ?? null;
          newValues[field] = normalized;
          changedFields.push(field);
        }
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message || "Invalid customer data",
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No customer fields were changed",
      });
    }

    const setSql = Object.keys(updates)
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");

    const updatedResult = await query(
      `
      UPDATE elevator_service_customers
      SET ${setSql}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, ...Object.values(updates)]
    );

    const updatedCustomer = updatedResult.rows[0];

    await createAuditLog({
      req,
      actor: user,
      entityType: "CUSTOMER",
      entityId: id,
      action: "CUSTOMER_UPDATED",
      oldValues,
      newValues,
      changedFields,
    });

    return res.status(200).json({
      success: true,
      customer: updatedCustomer,
      changedFields,
    });
  } catch (error) {
    console.error("Failed to handle elevator customer:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to handle elevator customer",
    });
  }
}
