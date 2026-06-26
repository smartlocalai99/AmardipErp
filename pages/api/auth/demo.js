import jwt from "jsonwebtoken";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { role } = req.body;

    if (!role || !["customer", "superadmin", "worker"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role specified" });
    }

    try {
        const payload = role === "customer" 
            ? { id: 999, username: "demo_customer", name: "Apex Business Park", role: "customer" }
            : role === "worker"
                ? { id: 50, username: "tech_suresh", name: "Suresh R.", role: "worker" }
                : { id: 1, username: "superadmin", name: "Super Admin", role: "superadmin" };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026",
            { expiresIn: "24h" }
        );

        res.setHeader(
            "Set-Cookie",
            `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        );

        return res.status(200).json({
            success: true,
            user: payload
        });
    } catch (err) {
        console.error("Demo login error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
