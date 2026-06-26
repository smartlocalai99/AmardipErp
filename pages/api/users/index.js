import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    // Authenticate the request
    const requester = await getUserFromRequest(req);
    if (!requester || requester.role !== "superadmin") {
        return res.status(403).json({ success: false, message: "Unauthorized. Superadmin role required." });
    }

    try {
        // Fetch all users (excluding password hashes) sorted by ID descending
        const usersRes = await query(
            "SELECT id, username, name, role, phone, created_at FROM users ORDER BY role, id DESC"
        );

        return res.status(200).json({ success: true, users: usersRes.rows });
    } catch (err) {
        console.error("Fetch users error:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}
