import { query } from "@/lib/db";

const CHALLENGE_TTL_MINUTES = 5;

export async function ensurePasskeyTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      credential_public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      credential_device_type TEXT,
      credential_backed_up BOOLEAN DEFAULT FALSE,
      transports TEXT[],
      device_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      challenge TEXT NOT NULL,
      challenge_type TEXT NOT NULL,
      flow_id TEXT NOT NULL UNIQUE,
      username TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query("CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON user_passkeys(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_user_passkeys_credential_id ON user_passkeys(credential_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_flow_id ON webauthn_challenges(flow_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON webauthn_challenges(user_id)");
  await query("CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON webauthn_challenges(expires_at)");
}

export async function deleteExpiredChallenges() {
  await query("DELETE FROM webauthn_challenges WHERE expires_at <= NOW()");
}

export async function saveChallenge({
  userId = null,
  challenge,
  challengeType,
  flowId,
  username = null,
}) {
  await query(
    `
      INSERT INTO webauthn_challenges (user_id, challenge, challenge_type, flow_id, username, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' minutes')::interval)
    `,
    [userId, challenge, challengeType, flowId, username, CHALLENGE_TTL_MINUTES]
  );
}

export async function getValidChallenge(flowId, challengeType) {
  const result = await query(
    `
      SELECT *
      FROM webauthn_challenges
      WHERE flow_id = $1
        AND challenge_type = $2
        AND expires_at > NOW()
      LIMIT 1
    `,
    [flowId, challengeType]
  );

  return result.rows[0] || null;
}

export async function deleteChallenge(flowId) {
  await query("DELETE FROM webauthn_challenges WHERE flow_id = $1", [flowId]);
}

export async function getUserPasskeys(userId) {
  const result = await query(
    `
      SELECT *
      FROM user_passkeys
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function getPasskeyByCredentialId(credentialId) {
  const result = await query(
    `
      SELECT
        p.*,
        u.username,
        u.name,
        u.role
      FROM user_passkeys p
      JOIN users u ON u.id = p.user_id
      WHERE p.credential_id = $1
      LIMIT 1
    `,
    [credentialId]
  );

  return result.rows[0] || null;
}

export async function saveUserPasskey({
  userId,
  credentialId,
  credentialPublicKey,
  counter,
  credentialDeviceType,
  credentialBackedUp,
  transports,
  deviceName,
}) {
  const result = await query(
    `
      INSERT INTO user_passkeys (
        user_id,
        credential_id,
        credential_public_key,
        counter,
        credential_device_type,
        credential_backed_up,
        transports,
        device_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      userId,
      credentialId,
      credentialPublicKey,
      counter || 0,
      credentialDeviceType || null,
      Boolean(credentialBackedUp),
      transports || [],
      deviceName || null,
    ]
  );

  return result.rows[0];
}

export async function updatePasskeyCounterAndLastUsed(credentialId, counter) {
  await query(
    `
      UPDATE user_passkeys
      SET counter = $2,
          last_used_at = NOW()
      WHERE credential_id = $1
    `,
    [credentialId, counter]
  );
}

export function publicKeyToStorage(publicKey) {
  return Buffer.from(publicKey).toString("base64url");
}

export function publicKeyFromStorage(publicKey) {
  return Buffer.from(publicKey, "base64url");
}
