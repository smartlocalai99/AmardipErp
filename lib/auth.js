import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026";

// Every login path (password, Face Lock) signs its session through this one
// place instead of each hardcoding its own duration — that's exactly how
// customers ended up with a 1-day session via the password login form while
// Face Lock separately hardcoded 24h too: two copies of the same number
// that nobody kept in sync. Customers used to get bumped out after a day,
// which is the "the app keeps logging me out" complaint — everyone now
// stays signed in for a year once they log in, not forgotten after a day.
const SESSION_SECONDS = 60 * 60 * 24 * 365;

export function getSessionSeconds() {
    return SESSION_SECONDS;
}

// Signs a session JWT for the given user payload ({id, username, name,
// role}) and returns the ready-to-use Set-Cookie header value.
export function issueSessionCookie(payload) {
    const sessionSeconds = getSessionSeconds();
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: sessionSeconds });
    return `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionSeconds}`;
}

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
        const decoded = jwt.verify(token, JWT_SECRET);
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
