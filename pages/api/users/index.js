import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ensureUsersDesignationColumn } from "@/lib/usersSchema";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    // Authenticate the request
    const requester = await getUserFromRequest(req);
    const allowedRoles = new Set(["superadmin", "admin", "manager", "front_office"]);
    if (!requester || !allowedRoles.has(requester.role)) {
        return res.status(403).json({ success: false, message: "Unauthorized. Admin role required." });
    }

    try {
        await ensureUsersDesignationColumn();

        // Fetch all users (excluding password hashes) sorted by ID descending
        const usersRes = await query(
            "SELECT id, username, name, role, phone, designation, created_at FROM users ORDER BY role, id DESC"
        );

        return res.status(200).json({ success: true, users: usersRes.rows });
    } catch (err) {
        console.error("Fetch users error:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}
