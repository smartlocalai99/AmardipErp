import { query } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ensureUsersDesignationColumn } from "@/lib/usersSchema";
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

    const { username, password, name, role, phone, designation } = req.body;

    // Validate inputs
    if (!username || !password || !name || !role) {
        return res.status(400).json({ success: false, message: "All fields (username, password, name, role) are required." });
    }

    const validRoles = ["admin", "manager", "worker", "customer", "front_office"];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role selected." });
    }

    try {
        await ensureUsersDesignationColumn();

        // Check if username already exists
        const checkUser = await query("SELECT id FROM users WHERE username = $1", [username.trim().toLowerCase()]);
        if (checkUser.rowCount > 0) {
            return res.status(409).json({ success: false, message: "Username already taken." });
        }

        // Hash the new user's password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert new user
        await query(
            `INSERT INTO users (username, password_hash, name, role, phone, designation)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                username.trim().toLowerCase(),
                passwordHash,
                name.trim(),
                role,
                phone ? phone.trim() : null,
                designation ? designation.trim() : null
            ]
        );

        return res.status(201).json({ success: true, message: `User ${name} successfully onboarded as ${role}.` });
    } catch (err) {
        console.error("Onboarding error:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
}
