import jwt from "jsonwebtoken";

export async function getUserFromRequest(req) {
    const cookies = req.headers?.cookie;
    if (!cookies) return null;

    // Parse the cookie header manually
    const cookieMap = Object.fromEntries(
        cookies.split(";").map((c) => {
            const parts = c.trim().split("=");
            return [parts[0], decodeURIComponent(parts[1] || "")];
        })
    );

    const token = cookieMap["auth_token"];
    if (!token) return null;

    try {
        // Verify the JWT token using the secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026");
        return {
            id: decoded.id,
            username: decoded.username,
            name: decoded.name,
            role: decoded.role,
        };
    } catch (err) {
        console.error("JWT verification failed:", err.message);
        return null;
    }
}
