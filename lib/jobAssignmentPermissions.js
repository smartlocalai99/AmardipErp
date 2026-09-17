// Deleting a service schedule (or cancelling a breakdown ticket) removes a
// dispatched job outright, so it's restricted to a small allowlist of
// trusted admin accounts rather than every admin-level login — the newer
// engineer-designation admin accounts (Hari Vardhan Reddy, Chiranjeevi,
// Iqbal) don't get this capability. Pure logic, no imports, so both the
// API routes and the client-rendered admin dashboard can use it directly
// (importing lib/db.js here would break the browser bundle).
const ALWAYS_ALLOWED_ROLES = new Set(["superadmin"]);
const ALLOWED_ADMIN_USERNAMES = new Set(["kethan", "amarnath", "dileep"]);

export function canDeleteJobAssignment(user) {
  if (!user) return false;
  if (ALWAYS_ALLOWED_ROLES.has(user.role)) return true;
  if (user.role === "admin") return ALLOWED_ADMIN_USERNAMES.has(String(user.username || "").trim().toLowerCase());
  return false;
}
