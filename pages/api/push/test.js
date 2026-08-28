import { getUserFromRequest } from "@/lib/auth";
import { sendPushToUserIds } from "@/lib/pushNotifications";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const actor = await getUserFromRequest(req);
  if (!actor) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  try {
    const result = await sendPushToUserIds([actor.id], {
      title: "Amardip notifications enabled",
      body: "This phone will receive ERP alerts for your account.",
      data: { url: roleHome(actor.role) },
    });

    const delivered = result.sent > 0;

    return res.status(delivered ? 200 : 409).json({
      success: delivered,
      message: delivered
        ? `Test notification sent to ${result.sent} device${result.sent === 1 ? "" : "s"}.`
        : "No working subscription was found. Tap Enable to renew notifications on this device.",
      ...result,
    });
  } catch (err) {
    console.error("push/test error:", err);
    return res.status(500).json({ success: false, message: "Failed to send test notification." });
  }
}

function roleHome(role) {
  if (role === "customer") return "/Customerdashboard";
  if (role === "worker") return "/Techniciandashboard";
  if (role === "storekeeper") return "/Storedashboard";
  return "/Admindashboard";
}
