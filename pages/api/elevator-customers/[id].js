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

    const result = await query(
      `
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
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to fetch elevator customer:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch elevator customer",
    });
  }
}
