const CACHE_PREFIX = "amardip_admin_cache";

function isBrowser() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function makeUserCacheKey(user, key) {
  const userPart =
    user?.id ||
    user?.username ||
    user?.role ||
    "anonymous";

  return `${CACHE_PREFIX}_${userPart}_${key}`;
}

export function getSessionCache(key, ttlMs) {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached || typeof cached.savedAt !== "number") return null;

    if (ttlMs && Date.now() - cached.savedAt > ttlMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return cached.value;
  } catch {
    return null;
  }
}

export function setSessionCache(key, value) {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        value,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage limits/private-mode failures.
  }
}

export function clearSessionCache(prefix = CACHE_PREFIX) {
  if (!isBrowser()) return;

  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Ignore storage access failures.
  }
}
