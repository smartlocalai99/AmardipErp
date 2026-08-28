import { getUserFromRequest } from "@/lib/auth";
import { syncServiceHistory } from "@/lib/serviceHistorySync.mjs";

const ADMIN_ROLES = new Set(["superadmin", "admin", "manager", "front_office"]);

function isAuthorizedCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(
    cronSecret && req.headers.authorization === `Bearer ${cronSecret}`
  );
}

export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (req.method === "GET") {
    if (!isAuthorizedCron(req)) {
      return res.status(401).json({ success: false, message: "Invalid cron authorization" });
    }
  } else {
    const actor = await getUserFromRequest(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (!ADMIN_ROLES.has(actor.role)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }
  }

  try {
    const result = await syncServiceHistory({ apply: true });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Service history sync failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync service history from Google Sheets",
    });
  }
}
