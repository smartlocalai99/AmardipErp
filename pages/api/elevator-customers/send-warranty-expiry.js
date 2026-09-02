import { getUserFromRequest } from "@/lib/auth";
import { runWarrantyExpiryCheck } from "@/lib/warrantyExpiry";
import { createAuditLog } from "@/lib/auditLog";

const ADMIN_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

function isAuthorizedCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret && req.headers.authorization === `Bearer ${cronSecret}`);
}

export const config = {
  maxDuration: 15,
};

// GET is the daily Vercel cron trigger (bearer-secret authorized, see
// vercel.json); POST is the admin's manual "Send now" button. Both run the
// exact same check so the 30-day rule behaves identically either way.
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let actor = null;
  if (req.method === "GET") {
    if (!isAuthorizedCron(req)) {
      return res.status(401).json({ success: false, message: "Invalid cron authorization" });
    }
  } else {
    actor = await getUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (!ADMIN_ROLES.has(actor.role)) return res.status(403).json({ success: false, message: "Not allowed" });
  }

  try {
    const result = await runWarrantyExpiryCheck(30);

    if (actor) {
      await createAuditLog({
        req,
        actor,
        entityType: "WARRANTY_EXPIRY_NOTIFY",
        entityId: "manual",
        action: "WARRANTY_EXPIRY_LETTERS_SENT",
        newValues: result,
        changedFields: ["sent"],
      }).catch((error) => console.error("Warranty-expiry audit failed:", error));
    }

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to run warranty-expiry check:", error);
    return res.status(500).json({ success: false, message: "Failed to run warranty-expiry check" });
  }
}
