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

    return res.status(200).json({
      success: true,
      message: result.total > 0 ? "Test notification sent." : "No saved subscription found for this user.",
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
