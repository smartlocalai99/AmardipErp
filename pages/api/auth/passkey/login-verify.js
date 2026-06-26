import jwt from "jsonwebtoken";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { origin, rpID } from "@/lib/webauthnConfig";
import {
  deleteChallenge,
  ensurePasskeyTables,
  getPasskeyByCredentialId,
  getValidChallenge,
  publicKeyFromStorage,
  updatePasskeyCounterAndLastUsed,
} from "@/lib/passkeys";

function redirectForRole(role) {
  if (role === "customer") return "/Customerdashboard";
  if (role === "worker") return "/Techniciandashboard";
  if (role === "storekeeper") return "/Storedashboard";
  return "/Admindashboard";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { flowId, credential } = req.body || {};
  if (!flowId || !credential) {
    return res.status(400).json({ success: false, message: "Face Lock login data is required" });
  }

  try {
    await ensurePasskeyTables();

    const challenge = await getValidChallenge(flowId, "authentication");
    if (!challenge) {
      return res.status(400).json({ success: false, message: "Face Lock login expired or invalid" });
    }

    const passkey = await getPasskeyByCredentialId(credential.id);
    if (!passkey) {
      return res.status(401).json({ success: false, message: "Face Lock is not enabled" });
    }

    if (challenge.user_id && challenge.user_id !== passkey.user_id) {
      return res.status(401).json({ success: false, message: "Face Lock does not match this login request" });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyFromStorage(passkey.credential_public_key),
        counter: Number(passkey.counter || 0),
        transports: passkey.transports || undefined,
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ success: false, message: "Face Lock login could not be verified" });
    }

    await updatePasskeyCounterAndLastUsed(
      passkey.credential_id,
      verification.authenticationInfo.newCounter
    );
    await deleteChallenge(flowId);

    const user = {
      id: passkey.user_id,
      username: passkey.username,
      name: passkey.name,
      role: passkey.role,
    };

    const token = jwt.sign(
      user,
      process.env.JWT_SECRET || "super-secret-key-amardip-elevators-2026",
      { expiresIn: "24h" }
    );

    res.setHeader(
      "Set-Cookie",
      `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
    );

    return res.status(200).json({
      success: true,
      user,
      redirectTo: redirectForRole(user.role),
    });
  } catch (error) {
    console.error("Passkey login verify error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify Face Lock login",
    });
  }
}
