import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    // Authenticate the request
    const requester = await getUserFromRequest(req);
    if (!requester || requester.role !== "superadmin") {
        return res.status(403).json({ success: false, message: "Unauthorized. Superadmin role required." });
    }

    const { userId, newPassword } = req.body;

    // Validate inputs
    if (!userId || !newPassword) {
        return res.status(400).json({ success: false, message: "User ID and new password are required." });
    }

    if (newPassword.trim().length < 4) {
        return res.status(400).json({ success: false, message: "Password must be at least 4 characters long." });
    }

    try {
        // Verify user exists and is not the superadmin themselves (superadmin should change password via custom profile logic, or they can)
        const checkUser = await query("SELECT id, username FROM users WHERE id = $1", [userId]);
        if (checkUser.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const user = checkUser.rows[0];

        // Hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);

        return res.status(200).json({
            success: true,
            message: `Password successfully updated for user @${user.username}.`
        });
    } catch (err) {
        console.error("Update password API error:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}
