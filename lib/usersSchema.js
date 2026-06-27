import { query } from "@/lib/db";

export async function ensureUsersDesignationColumn() {
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)");
}
