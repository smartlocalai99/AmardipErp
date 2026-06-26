import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getUserFromRequest } from "@/lib/auth";
import { origin, rpID } from "@/lib/webauthnConfig";
import {
  deleteChallenge,
  ensurePasskeyTables,
  getPasskeyByCredentialId,
  getValidChallenge,
  publicKeyToStorage,
  saveUserPasskey,
} from "@/lib/passkeys";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const sessionUser = await getUserFromRequest(req);
  if (!sessionUser) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  const { flowId, credential, deviceName } = req.body || {};
  if (!flowId || !credential) {
    return res.status(400).json({ success: false, message: "Passkey verification data is required" });
  }

  try {
    await ensurePasskeyTables();

    const challenge = await getValidChallenge(flowId, "registration");
    if (!challenge || challenge.user_id !== sessionUser.id) {
      return res.status(400).json({ success: false, message: "Passkey challenge expired or invalid" });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ success: false, message: "Passkey registration could not be verified" });
    }

    const { credential: verifiedCredential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const existing = await getPasskeyByCredentialId(verifiedCredential.id);
    if (existing) {
      await deleteChallenge(flowId);
      return res.status(409).json({ success: false, message: "This passkey is already registered" });
    }

    await saveUserPasskey({
      userId: sessionUser.id,
      credentialId: verifiedCredential.id,
      credentialPublicKey: publicKeyToStorage(verifiedCredential.publicKey),
      counter: verifiedCredential.counter,
      credentialDeviceType,
      credentialBackedUp,
      transports: credential.response?.transports || [],
      deviceName: String(deviceName || "").trim() || null,
    });

    await deleteChallenge(flowId);

    return res.status(200).json({
      success: true,
      message: "Passkey registered successfully",
    });
  } catch (error) {
    console.error("Passkey register verify error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify passkey registration",
    });
  }
}
