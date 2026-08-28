import { getUserFromRequest } from "@/lib/auth";
import {
  clearCustomerNotifications,
  listCustomerNotifications,
  markAllCustomerNotificationsRead,
} from "@/lib/customerNotifications";

export default async function handler(req, res) {
  const actor = await getUserFromRequest(req);
  if (!actor) return res.status(401).json({ success: false, message: "Unauthorized." });
  if (actor.role !== "customer") return res.status(403).json({ success: false, message: "Customers only." });

  if (req.method === "GET") {
    const notifications = await listCustomerNotifications(actor.id);
    return res.status(200).json({ success: true, notifications });
  }

  if (req.method === "PATCH") {
    await markAllCustomerNotificationsRead(actor.id);
    return res.status(200).json({ success: true });
  }

  if (req.method === "DELETE") {
    await clearCustomerNotifications(actor.id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, message: "Method not allowed." });
}
