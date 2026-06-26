import { getUserFromRequest } from "@/lib/auth";
import { ensurePasskeyTables, removeUserPasskeyDevice } from "@/lib/passkeys";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Face Lock device id is required" });
  }

  try {
    await ensurePasskeyTables();
    const removed = await removeUserPasskeyDevice(user.id, id);

    if (!removed) {
      return res.status(404).json({ success: false, message: "Face Lock device not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Face Lock removed successfully",
    });
  } catch (error) {
    console.error("Face Lock remove error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove Face Lock",
    });
  }
}
