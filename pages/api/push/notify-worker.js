import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:amardipelevators@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

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
        `SELECT ps.endpoint, ps.p256dh, ps.auth
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

    if (subs.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: "No subscriptions found for worker" });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/adlogo-pwa-192.png",
      badge: "/adlogo-pwa-192.png",
      data: data || {},
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    // Clean up expired subscriptions
    const expired = results
      .map((r, i) => (r.status === "rejected" && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404) ? subs[i].endpoint : null))
      .filter(Boolean);
    if (expired.length) {
      await query(`DELETE FROM push_subscriptions WHERE endpoint = ANY($1)`, [expired]).catch(() => {});
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return res.status(200).json({ success: true, sent, total: subs.length });
  } catch (err) {
    console.error("push/notify-worker error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
