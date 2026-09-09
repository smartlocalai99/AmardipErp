import { cachedGetJson } from "@/lib/cachedFetch";
import { clearSessionCache } from "@/lib/adminCache";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const AdminAppDataContext = createContext(null);

const initialState = {
  customerStats: null,
  serviceStats: null,
  upcomingPreview: null,
  moduleAvailability: null,
  loading: false,
  error: "",
  lastFetchedAt: null,
};

export function AdminAppDataProvider({ user, children }) {
  const [state, setState] = useState(initialState);
  const fetchRef = useRef(null);
  const userCacheKey = user?.id || user?.username || user?.role || "anonymous";

  const loadAdminData = useCallback(async ({ forceRefresh = false } = {}) => {
    if (fetchRef.current?.userCacheKey === userCacheKey && !forceRefresh) {
      return fetchRef.current.promise;
    }

    setState((current) => ({ ...current, error: "" }));

    const markNetworkLoading = () => {
      setState((current) => ({ ...current, loading: true }));
    };

    // Keep operational counts live while sharing simultaneous requests.
    // Only module availability, which changes rarely, uses a TTL cache.
    const fetchFreshJson = (url) => cachedGetJson(url, {
      ttlMs: 0,
      forceRefresh,
      user: userCacheKey,
      fetchOptions: { cache: "no-store" },
      onNetworkStart: markNetworkLoading,
    });

    const request = { userCacheKey, promise: null };
    fetchRef.current = request;
    request.promise = Promise.allSettled([
      fetchFreshJson("/api/elevator-customers/stats"),
      fetchFreshJson("/api/elevator-service-visits/stats"),
      fetchFreshJson("/api/service-schedules/upcoming?page=1&pageSize=5"),
      cachedGetJson("/api/admin/module-availability", {
        cacheKey: "dashboard_module_availability",
        ttlMs: 60 * 1000,
        forceRefresh,
        user: userCacheKey,
        onNetworkStart: markNetworkLoading,
      }),
    ])
      .then(([customerResult, serviceResult, upcomingResult, availabilityResult]) => {
        const customerData = customerResult.status === "fulfilled" ? customerResult.value : null;
        const serviceData = serviceResult.status === "fulfilled" ? serviceResult.value : null;
        const upcomingData = upcomingResult.status === "fulfilled" ? upcomingResult.value : null;
        const availabilityData = availabilityResult.status === "fulfilled" ? availabilityResult.value : null;
        const failedRequests = [customerResult, serviceResult, upcomingResult, availabilityResult]
          .filter((result) => result.status === "rejected");
        const nextState = {
          customerStats: customerData?.stats || null,
          serviceStats: serviceData?.stats || null,
          upcomingPreview: upcomingData || null,
          moduleAvailability: availabilityData?.modules || null,
          loading: false,
          error: failedRequests.length === 4 ? "Failed to load admin dashboard data" : "",
          lastFetchedAt: Date.now(),
        };

        if (fetchRef.current === request) setState(nextState);
        return nextState;
      })
      .catch((error) => {
        if (fetchRef.current === request) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message || "Failed to load admin data",
          }));
        }
        throw error;
      })
      .finally(() => {
        if (fetchRef.current === request) fetchRef.current = null;
      });

    return request.promise;
  }, [userCacheKey]);

  useEffect(() => {
    loadAdminData().catch(() => {});
  }, [loadAdminData]);

  const refreshAdminData = useCallback(() => {
    return loadAdminData({ forceRefresh: true });
  }, [loadAdminData]);

  const invalidateAdminCache = useCallback(() => {
    clearSessionCache("amardip_admin_cache");
  }, []);

  const value = useMemo(() => ({
    ...state,
    refreshAdminData,
    invalidateAdminCache,
  }), [state, refreshAdminData, invalidateAdminCache]);

  return (
    <AdminAppDataContext.Provider value={value}>
      {children}
    </AdminAppDataContext.Provider>
  );
}

export function useAdminAppData() {
  const context = useContext(AdminAppDataContext);

  if (!context) {
    throw new Error("useAdminAppData must be used inside AdminAppDataProvider");
  }

  return context;
}
