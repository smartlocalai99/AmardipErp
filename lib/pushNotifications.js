import webpush from "web-push";
import { query } from "./db.js";

let pushConfigured = false;

function configurePush() {
  if (pushConfigured) return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  pushConfigured = true;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || process.env.VAPID_EMAIL || "mailto:amardipelevators@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

export async function ensurePushSubscriptionsTable() {
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

async function sendToSubscriptions(rows, payload) {
  if (!configurePush()) {
    console.error("[push] VAPID configuration is missing.");
    return { sent: 0, failed: rows.length, expired: 0, total: rows.length, skipped: true };
  }
  if (rows.length === 0) {
    console.warn("[push] No saved subscriptions matched the notification target.");
    return { sent: 0, failed: 0, expired: 0, total: 0, skipped: true };
  }

  const body = JSON.stringify({
    title: payload.title || "Amardip Lifts",
    body: payload.body || "",
    icon: "/adlogo-pwa-192.png",
    badge: "/adlogo-pwa-192.png",
    data: payload.data || {},
  });

  const results = await Promise.allSettled(
    rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  );

  const expired = results
    .map((result, index) =>
      result.status === "rejected" && (result.reason?.statusCode === 410 || result.reason?.statusCode === 404)
        ? rows[index].endpoint
        : null
    )
    .filter(Boolean);

  if (expired.length) {
    await query("DELETE FROM push_subscriptions WHERE endpoint = ANY($1)", [expired]).catch(() => {});
  }

  const rejected = results.flatMap((result, index) => {
    if (result.status !== "rejected") return [];
    let provider = "unknown";
    try {
      provider = new URL(rows[index].endpoint).host;
    } catch {}
    return [{
      provider,
      statusCode: result.reason?.statusCode || null,
      message: result.reason?.body || result.reason?.message || "Push provider rejected the notification.",
    }];
  });

  const summary = {
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: rejected.length,
    expired: expired.length,
    total: rows.length,
    skipped: false,
  };

  if (rejected.length) console.warn("[push] Provider rejections", rejected);
  console.log("[push] Delivery complete", summary);

  return summary;
}

export async function sendPushToUserIds(userIds = [], payload = {}) {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];
  if (!ids.length) return { sent: 0, total: 0 };
  await ensurePushSubscriptionsTable();
  const result = await query(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)",
    [ids]
  );
  return sendToSubscriptions(result.rows, payload);
}

export async function sendPushToRoles(roles = [], payload = {}) {
  const roleList = [...new Set(roles.filter(Boolean))];
  if (!roleList.length) return { sent: 0, total: 0 };
  await ensurePushSubscriptionsTable();
  const result = await query(
    `SELECT ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role = ANY($1)`,
    [roleList]
  );
  return sendToSubscriptions(result.rows, payload);
}

export async function safeSendPush(target, payload) {
  try {
    if (target.userIds) return await sendPushToUserIds(target.userIds, payload);
    if (target.roles) return await sendPushToRoles(target.roles, payload);
  } catch (err) {
    console.error("Push notification failed:", err);
  }
  return { sent: 0, total: 0, failed: true };
}
