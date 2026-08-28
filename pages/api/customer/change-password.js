import bcrypt from "bcryptjs";
import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const actor = await getUserFromRequest(req);
  if (!actor || actor.role !== "customer") {
    return res.status(403).json({ success: false, message: "Customer access required." });
  }

  const newPassword = String(req.body?.newPassword || "").trim();
  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, message: "Password must be at least 4 characters." });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'customer'", [passwordHash, actor.id]);
    return res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Customer password update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update password." });
  }
}
