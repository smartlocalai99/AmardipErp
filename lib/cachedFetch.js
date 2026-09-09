import { getSessionCache, getSessionCacheGeneration, makeUserCacheKey, setSessionCache } from "@/lib/adminCache";

const inFlightGets = new Map();

export async function cachedGetJson(url, options = {}) {
  const {
    cacheKey = url,
    ttlMs = 2 * 60 * 1000,
    forceRefresh = false,
    user = null,
    fetchOptions = {},
    onNetworkStart = null,
  } = options;

  fetchOptions.signal?.throwIfAborted();
  const key = makeUserCacheKey(user, cacheKey);
  const generation = getSessionCacheGeneration();
  const pending = inFlightGets.get(key);
  if (!forceRefresh && !fetchOptions.signal && pending?.shareable && pending.generation === generation) {
    return pending.promise;
  }

  // Live data can still share concurrent GETs without persisting old results.
  const cacheEnabled = ttlMs > 0;
  const cached = cacheEnabled ? getSessionCache(key, ttlMs) : null;

  if (cached && !forceRefresh) {
    return {
      ...cached,
      _fromCache: true,
    };
  }

  const entry = { shareable: !fetchOptions.signal, generation, promise: null };
  inFlightGets.set(key, entry);
  entry.promise = (async () => {
    try {
      onNetworkStart?.();
      const response = await fetch(url, { ...fetchOptions, method: "GET" });
      const data = await response.json().catch((error) => {
        error.status = response.status;
        throw error;
      });
      fetchOptions.signal?.throwIfAborted();
      if (!response.ok) {
        const error = new Error(data?.message || "Request failed");
        error.status = response.status;
        throw error;
      }

      // An earlier request may finish after a forced refresh or a new filter.
      if (cacheEnabled && data?.success !== false && inFlightGets.get(key) === entry && getSessionCacheGeneration() === generation) {
        setSessionCache(key, data);
      }
      return data;
    } catch (error) {
      if (fetchOptions.signal?.aborted || error.name === "AbortError") throw error;
      const canUseStale = !error.status || error.status >= 500;
      const stale = cacheEnabled && canUseStale ? getSessionCache(key, 0) : null;
      if (stale) {
        return {
          ...stale,
          _fromStaleCache: true,
          _cacheWarning: error.message || "Using stale cached data",
        };
      }
      throw error;
    } finally {
      if (inFlightGets.get(key) === entry) inFlightGets.delete(key);
    }
  })();
  return entry.promise;
}
