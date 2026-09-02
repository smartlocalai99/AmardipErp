import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ensureUsersDesignationColumn, ensureUserLoginDeviceColumns, ensureUserPasswordPlainColumn } from "@/lib/usersSchema";

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
        await ensureUserLoginDeviceColumns();
        await ensureUserPasswordPlainColumn();

        // Staff directory only — customer accounts aren't shown here.
        // password_plain is the actual login PIN/password in the clear; it's
        // only included for superadmin plus the specific named admins who
        // asked to see the full staff directory (amarnath, dileep, kethan),
        // matching the one place in the UI that displays it.
        const canViewCredentials = requester.role === "superadmin"
            || ["amarnath", "dileep", "kethan"].includes(requester.username);
        const columns = canViewCredentials
            ? "id, username, name, role, phone, designation, created_at, last_login_device, last_login_at, password_plain"
            : "id, username, name, role, phone, designation, created_at, last_login_device, last_login_at";

        const usersRes = await query(
            `SELECT ${columns} FROM users WHERE role <> 'customer' ORDER BY role, id DESC`
        );

        return res.status(200).json({ success: true, users: usersRes.rows });
    } catch (err) {
        console.error("Fetch users error:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}
