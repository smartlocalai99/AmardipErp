import { getUserFromRequest } from "@/lib/auth";
import { CUSTOMER_DUE_DATE_SQL } from "@/lib/customerDates";
import { query } from "@/lib/db";
import { createAuditLog } from "@/lib/auditLog";
import { sendPushToUserIds } from "@/lib/pushNotifications";
import { createCustomerNotification } from "@/lib/customerNotifications";

const BLOCKED_ROLES = new Set(["customer", "worker", "storekeeper"]);
const VALID_BUCKETS = new Set(["this_month", "next_month", "expired"]);

const NOTIFICATION_CONTENT = {
  this_month: {
    title: "AMC renewal reminder",
    message: (dueLabel) => `Your AMC is due this month on ${dueLabel}. Contact Amardip Lifts to renew and avoid a service gap.`,
    type: "AMC_DUE_THIS_MONTH",
  },
  next_month: {
    title: "AMC renewal reminder",
    message: (dueLabel) => `Your AMC is due next month on ${dueLabel}. Contact Amardip Lifts to renew in time.`,
    type: "AMC_DUE_NEXT_MONTH",
  },
  expired: {
    title: "Your AMC has expired",
    message: (dueLabel) => `Your AMC expired on ${dueLabel}. Contact Amardip Lifts to renew your contract and restore coverage.`,
    type: "AMC_EXPIRED",
  },
};

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
  const bucketWhereSql = {
    this_month: `
      d.due_date >= CURRENT_DATE
      AND d.due_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
    `,
    next_month: `
      d.due_date >= (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
      AND d.due_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '2 months')::date
    `,
    expired: "d.due_date < CURRENT_DATE",
  }[bucket];
  const notification = NOTIFICATION_CONTENT[bucket];

  try {
    // Every AMC/EMC/Warranty customer in the selected expiry group, matched
    // to a customer login (if any) by mobile number — the same normalization
    // the complaints module already uses.
    const dueResult = await query(`
      WITH dated AS (
        SELECT
          id,
          customer_name,
          mobile_no,
          ${CUSTOMER_DUE_DATE_SQL} AS due_date
        FROM elevator_service_customers
        WHERE UPPER(TRIM(COALESCE(customer_status, ''))) IN ('AMC', 'EMC', 'WARRANTY')
      )
      SELECT d.id, d.customer_name, d.mobile_no, d.due_date, u.id AS user_id
      FROM dated d
      LEFT JOIN users u
        ON u.role = 'customer'
        AND regexp_replace(COALESCE(u.username, ''), '\\D', '', 'g') = regexp_replace(COALESCE(d.mobile_no, ''), '\\D', '', 'g')
        AND regexp_replace(COALESCE(d.mobile_no, ''), '\\D', '', 'g') <> ''
      WHERE d.due_date IS NOT NULL
        AND ${bucketWhereSql}
    `);

    const rows = dueResult.rows;
    const matched = rows.filter((row) => row.user_id);

    const results = await Promise.allSettled(
      matched.map(async (row) => {
        const dueLabel = new Date(row.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const message = notification.message(dueLabel);

        // Persisted so it shows in the customer's own bell icon next time
        // they open the app, independent of whether the push below actually
        // reaches a live subscription.
        await createCustomerNotification({
          userId: row.user_id,
          category: notification.title,
          message,
          data: { type: notification.type, customerRecordId: row.id },
        }).catch((err) => console.error("Failed to persist customer notification:", err));

        return sendPushToUserIds([row.user_id], {
          title: notification.title,
          body: message,
          data: { url: "/Customerdashboard", type: notification.type },
        });
      })
    );

    const notified = results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value.sent : 0), 0);

    await safeAudit({
      req,
      actor,
      entityType: "AMC_NOTIFY",
      entityId: bucket,
      action: "AMC_CUSTOMERS_NOTIFIED",
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
