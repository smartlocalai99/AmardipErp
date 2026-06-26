import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    try {
        // Retrieve user from the database
        const userRes = await query("SELECT * FROM users WHERE username = $1", [username.trim().toLowerCase()]);
        
        if (userRes.rowCount === 0) {
            return res.status(401).json({ success: false, message: "Invalid username or password" });
        }

        const user = userRes.rows[0];

        // Compare password hash
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: "Invalid username or password" });
        }

        // Generate signed JWT token containing ID, username, name, and role
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
            },
            process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026",
            { expiresIn: "24h" }
        );

        // Set HttpOnly cookie for session management
        res.setHeader(
            "Set-Cookie",
            `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        );

        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                name: user.name,
                role: user.role,
            },
        });
    } catch (err) {
        console.error("Login endpoint error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
