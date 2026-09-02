import { query } from "@/lib/db";
import { normalizeMobileNumber } from "@/lib/customerAccounts";
import { ensureCustomerAccountSchema, ensureUserLoginDeviceColumns } from "@/lib/usersSchema";
import { describeDevice } from "@/lib/deviceInfo";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Staff logins stay signed in by default instead of expiring after a day;
// only the customer portal keeps the shorter session.
const STAFF_SESSION_SECONDS = 60 * 60 * 24 * 30;
const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24;
const STAFF_ROLES = new Set(["superadmin", "admin", "manager", "front_office", "storekeeper", "worker"]);

// Which device someone last logged in from is only tracked for store and
// worker accounts, per the admin's request — not for admin logins.
const DEVICE_TRACKED_ROLES = new Set(["storekeeper", "worker"]);

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

        if (DEVICE_TRACKED_ROLES.has(user.role)) {
            await ensureUserLoginDeviceColumns();
            await query(
                "UPDATE users SET last_login_device = $1, last_login_at = NOW() WHERE id = $2",
                [describeDevice(req.headers["user-agent"]), user.id]
            );
        }

        const sessionSeconds = STAFF_ROLES.has(user.role) ? STAFF_SESSION_SECONDS : CUSTOMER_SESSION_SECONDS;

        // Generate signed JWT token containing ID, username, name, and role
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
            },
            process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026",
            { expiresIn: sessionSeconds }
        );

        // Set HttpOnly cookie for session management — stays signed in by
        // default (no "remember me" checkbox) for the duration above.
        res.setHeader(
            "Set-Cookie",
            `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionSeconds}`
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
