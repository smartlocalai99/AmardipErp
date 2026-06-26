export default function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    // Clear the auth_token cookie by setting Max-Age to 0
    res.setHeader(
        "Set-Cookie",
        "auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    );

    return res.status(200).json({ success: true });
}
