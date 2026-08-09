import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { createAuditLog } from "@/lib/auditLog";
import { sendPushToUserIds } from "@/lib/pushNotifications";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const VALID_BUCKETS = new Set(["this_month", "next_month"]);

async function safeAudit(args) {
  try {
    await createAuditLog(args);
  } catch (err) {
    console.error("Notify-expiring audit failed:", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (BLOCKED_ROLES.has(actor.role)) return res.status(403).json({ success: false, message: "Not allowed" });

  const bucketRaw = String(req.body?.bucket || "next_month").trim().toLowerCase();
  const bucket = VALID_BUCKETS.has(bucketRaw) ? bucketRaw : "next_month";
  const monthOffsetSql = bucket === "this_month" ? "" : "+ INTERVAL '1 month'";

  try {
    // Every AMC/EMC/Warranty customer whose contract falls due in the target
    // month, matched to a customer login (if any) by mobile number — the
    // same normalization the complaints module already uses.
    const dueResult = await query(`
      WITH dated AS (
        SELECT
          id,
          customer_name,
          mobile_no,
          CASE
            WHEN amc_warranty_due IS NOT NULL AND amc_warranty_due::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN amc_warranty_due::text::date
            WHEN amc_ending_date IS NOT NULL AND amc_ending_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
              THEN amc_ending_date::text::date
            ELSE NULL
          END AS due_date
        FROM elevator_service_customers
      )
      SELECT d.id, d.customer_name, d.mobile_no, d.due_date, u.id AS user_id
      FROM dated d
      LEFT JOIN users u
        ON u.role = 'customer'
        AND regexp_replace(COALESCE(u.username, ''), '\\D', '', 'g') = regexp_replace(COALESCE(d.mobile_no, ''), '\\D', '', 'g')
        AND regexp_replace(COALESCE(d.mobile_no, ''), '\\D', '', 'g') <> ''
      WHERE d.due_date IS NOT NULL
        AND date_trunc('month', d.due_date) = date_trunc('month', CURRENT_DATE ${monthOffsetSql})
    `);

    const rows = dueResult.rows;
    const matched = rows.filter((row) => row.user_id);

    const results = await Promise.allSettled(
      matched.map((row) => {
        const dueLabel = new Date(row.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        return sendPushToUserIds([row.user_id], {
          title: "AMC Renewal Reminder",
          body: `Your AMC/warranty is due on ${dueLabel}. Contact Amardip Lifts to renew and avoid a service gap.`,
          data: { url: "/Customerdashboard", type: "AMC_RENEWAL_REMINDER" },
        });
      })
    );

    const notified = results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value.sent : 0), 0);

    await safeAudit({
      req,
      actor,
      entityType: "AMC_NOTIFY",
      entityId: bucket,
      action: "AMC_EXPIRING_NOTIFIED",
      newValues: { bucket, totalDue: rows.length, matchedAccounts: matched.length, notified },
      changedFields: ["bucket", "notified"],
    });

    return res.status(200).json({
      success: true,
      bucket,
      totalDue: rows.length,
      matchedAccounts: matched.length,
      notified,
    });
  } catch (error) {
    console.error("Failed to notify expiring AMC customers:", error);
    return res.status(500).json({ success: false, message: "Failed to send notifications" });
  }
}
