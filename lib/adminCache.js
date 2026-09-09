const CACHE_PREFIX = "amardip_admin_cache";
const MAX_CACHE_ENTRIES = 100;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
let cacheGeneration = 0;

export function getSessionCacheGeneration() {
  return cacheGeneration;
}

function getStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function makeUserCacheKey(user, key) {
  if (typeof user === "string" || typeof user === "number") {
    return `${CACHE_PREFIX}_${user}_${key}`;
  }

  const userPart =
    user?.id ||
    user?.username ||
    user?.role ||
    "anonymous";

  return `${CACHE_PREFIX}_${userPart}_${key}`;
}

export function getSessionCache(key, ttlMs) {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!cached || typeof cached.savedAt !== "number") return null;

    const age = Date.now() - cached.savedAt;
    if (age < 0 || age > MAX_CACHE_AGE_MS) {
      storage.removeItem(key);
      return null;
    }
    // Keep recently expired entries for a temporary network outage.
    if (ttlMs > 0 && age > ttlMs) return null;

    return cached.value;
  } catch {
    return null;
  }
}

export function setSessionCache(key, value) {
  const storage = getStorage();
  if (!storage) return;

  try {
    const now = Date.now();
    const entries = [];
    for (const entryKey of Object.keys(storage)) {
      if (!entryKey.startsWith(`${CACHE_PREFIX}_`) || entryKey === key) continue;
      let savedAt;
      try {
        savedAt = JSON.parse(storage.getItem(entryKey))?.savedAt;
      } catch {
        // Discard malformed entries while reclaiming cache space.
      }
      if (!Number.isFinite(savedAt) || now - savedAt > MAX_CACHE_AGE_MS || savedAt > now) {
        storage.removeItem(entryKey);
      } else {
        entries.push({ key: entryKey, savedAt });
      }
    }
    entries.sort((a, b) => a.savedAt - b.savedAt);
    for (let index = 0; index <= entries.length - MAX_CACHE_ENTRIES; index += 1) {
      storage.removeItem(entries[index].key);
    }
    storage.setItem(
      key,
      JSON.stringify({
        value,
        savedAt: now,
      })
    );
  } catch {
    // Ignore storage limits/private-mode failures.
  }
}

export function clearSessionCache(prefix = CACHE_PREFIX) {
  cacheGeneration += 1;
  const storage = getStorage();
  if (!storage) return;

  try {
    Object.keys(storage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore storage access failures.
  }
}
