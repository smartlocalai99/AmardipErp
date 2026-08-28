import { query } from "@/lib/db";
import { normalizeMobileNumber } from "@/lib/customerAccounts";
import { ensureCustomerAccountSchema } from "@/lib/usersSchema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { mobileNumber, username, password } = req.body || {};
    const isCustomerMobileLogin = mobileNumber !== undefined;
    const identifier = isCustomerMobileLogin
        ? normalizeMobileNumber(mobileNumber)
        : String(username || "").trim().toLowerCase();

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            message: isCustomerMobileLogin
                ? "Mobile number and password are required"
                : "Username and password are required",
        });
    }

    try {
        await ensureCustomerAccountSchema();

        // Retrieve user from the database
        const userRes = await query(
            isCustomerMobileLogin
                ? "SELECT * FROM users WHERE username = $1 AND role = 'customer' LIMIT 1"
                : "SELECT * FROM users WHERE username = $1 LIMIT 1",
            [identifier]
        );
        
        if (userRes.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: isCustomerMobileLogin
                    ? "Invalid mobile number or password"
                    : "Invalid username or password",
            });
        }

        const user = userRes.rows[0];

        // Compare password hash
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: isCustomerMobileLogin
                    ? "Invalid mobile number or password"
                    : "Invalid username or password",
            });
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
