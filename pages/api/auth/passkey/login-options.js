import { randomUUID } from "crypto";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { query } from "@/lib/db";
import { rpID } from "@/lib/webauthnConfig";
import {
  deleteExpiredChallenges,
  ensurePasskeyTables,
  getUserPasskeys,
  saveChallenge,
} from "@/lib/passkeys";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const username = String(req.body?.username || "").trim().toLowerCase();

  try {
    await ensurePasskeyTables();
    await deleteExpiredChallenges();

    let user = null;
    let passkeys = [];

    if (username) {
      const userResult = await query(
        "SELECT id, username, name, role FROM users WHERE username = $1 LIMIT 1",
        [username]
      );

      if (userResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: "No Face Lock found for this username" });
      }

      user = userResult.rows[0];
      passkeys = await getUserPasskeys(user.id);

      if (passkeys.length === 0) {
        return res.status(404).json({ success: false, message: "No Face Lock found for this username" });
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: username
        ? passkeys.map((passkey) => ({
            id: passkey.credential_id,
            transports: passkey.transports || undefined,
          }))
        : undefined,
      userVerification: "preferred",
    });

    const flowId = randomUUID();
    await saveChallenge({
      userId: user?.id || null,
      challenge: options.challenge,
      challengeType: "authentication",
      flowId,
      username: username || null,
    });

    return res.status(200).json({
      success: true,
      flowId,
      options,
    });
  } catch (error) {
    console.error("Passkey login options error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Face Lock login options",
    });
  }
}
