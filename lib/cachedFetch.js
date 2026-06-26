import { getSessionCache, makeUserCacheKey, setSessionCache } from "@/lib/adminCache";

export async function cachedGetJson(url, options = {}) {
  const {
    cacheKey = url,
    ttlMs = 2 * 60 * 1000,
    forceRefresh = false,
    user = null,
    fetchOptions = {},
    onNetworkStart = null,
  } = options;

  const key = makeUserCacheKey(user, cacheKey);
  const cached = getSessionCache(key, ttlMs);

  if (cached && !forceRefresh) {
    return {
      ...cached,
      _fromCache: true,
    };
  }

  try {
    onNetworkStart?.();
    const response = await fetch(url, {
      ...fetchOptions,
      method: "GET",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    setSessionCache(key, data);
    return data;
  } catch (error) {
    const stale = getSessionCache(key, 0);
    if (stale) {
      return {
        ...stale,
        _fromStaleCache: true,
        _cacheWarning: error.message || "Using stale cached data",
      };
    }

    throw error;
  }
}
