import { randomUUID } from "crypto";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { rpID, rpName } from "@/lib/webauthnConfig";
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

  const sessionUser = await getUserFromRequest(req);
  if (!sessionUser) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  try {
    await ensurePasskeyTables();
    await deleteExpiredChallenges();

    const userResult = await query(
      "SELECT id, username, name, role FROM users WHERE id = $1 LIMIT 1",
      [sessionUser.id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];
    const passkeys = await getUserPasskeys(user.id);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(String(user.id)),
      userName: user.username,
      userDisplayName: user.name || user.username,
      attestationType: "none",
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.credential_id,
        transports: passkey.transports || undefined,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const flowId = randomUUID();
    await saveChallenge({
      userId: user.id,
      challenge: options.challenge,
      challengeType: "registration",
      flowId,
      username: user.username,
    });

    return res.status(200).json({
      success: true,
      flowId,
      options,
    });
  } catch (error) {
    console.error("Passkey register options error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create passkey registration options",
    });
  }
}
