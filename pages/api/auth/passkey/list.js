import { getUserFromRequest } from "@/lib/auth";
import { ensurePasskeyTables, getUserPasskeyDevices } from "@/lib/passkeys";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  try {
    await ensurePasskeyTables();
    const devices = await getUserPasskeyDevices(user.id);

    return res.status(200).json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error("Face Lock device list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load Face Lock devices",
    });
  }
}
