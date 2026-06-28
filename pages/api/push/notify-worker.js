import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendPushToRoles, sendPushToUserIds } from "@/lib/pushNotifications";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const actor = await getUserFromRequest(req);
  if (!actor || !["superadmin", "admin", "manager", "front_office"].includes(actor.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  const { workerName, title, body, data } = req.body || {};
  if (!title || !body) return res.status(400).json({ success: false, message: "title and body required" });

  try {
    // Find subscriptions for the worker by name if given, else all workers
    let subs;
    if (workerName) {
      const userRes = await query(
        `SELECT u.id AS user_id, ps.endpoint, ps.p256dh, ps.auth
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id
         WHERE u.name = $1 AND u.role = 'worker'`,
        [workerName]
      );
      subs = userRes.rows;
    } else {
      // Broadcast to all workers
      const allRes = await query(
        `SELECT ps.endpoint, ps.p256dh, ps.auth
         FROM push_subscriptions ps
         JOIN users u ON u.id = ps.user_id
         WHERE u.role = 'worker'`
      );
      subs = allRes.rows;
    }

    const payload = {
      title,
      body,
      data: data || {},
    };

    const userIds = workerName ? subs.map((sub) => sub.user_id).filter(Boolean) : [];
    const result = workerName
      ? await sendPushToUserIds(userIds, payload)
      : await sendPushToRoles(["worker"], payload);

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("push/notify-worker error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
