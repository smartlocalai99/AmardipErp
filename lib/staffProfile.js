import { query } from "./db.js";

export async function getStaffProfile(userId) {
  const result = await query("SELECT phone, designation FROM users WHERE id = $1 LIMIT 1", [userId]);
  return result.rows[0] || { phone: null, designation: null };
}
