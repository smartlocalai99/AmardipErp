import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

async function ensurePushTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const actor = await getUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { subscription } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, message: "Invalid subscription" });
    }

    try {
      await ensurePushTable();
      await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, updated_at = NOW()`,
        [actor.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("push/subscribe error:", err);
      return res.status(500).json({ success: false, message: "Failed to save subscription" });
    }
  }

  if (req.method === "DELETE") {
    const actor = await getUserFromRequest(req);
    if (!actor) return res.status(401).json({ success: false });
    const { endpoint } = req.body || {};
    if (endpoint) {
      await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [endpoint, actor.id]).catch(() => {});
    }
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ success: false, message: "Method not allowed" });
}
