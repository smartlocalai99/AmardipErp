import { cachedGetJson } from "@/lib/cachedFetch";
import { clearSessionCache } from "@/lib/adminCache";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const DASHBOARD_TTL_MS = 5 * 60 * 1000;

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
    if (fetchRef.current && !forceRefresh) {
      return fetchRef.current;
    }

    setState((current) => ({ ...current, error: "" }));

    const markNetworkLoading = () => {
      setState((current) => ({ ...current, loading: true }));
    };

    // Customer/service/upcoming-service counts drive the admin's real-time
    // decisions (who to call, what's due) so they always hit the network —
    // no localStorage TTL cache. Module availability changes rarely, so that
    // one alone stays cached.
    const fetchFreshJson = async (url) => {
      markNetworkLoading();
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");
      return data;
    };

    fetchRef.current = Promise.all([
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
      .then(([customerData, serviceData, upcomingData, availabilityData]) => {
        const nextState = {
          customerStats: customerData?.stats || null,
          serviceStats: serviceData?.stats || null,
          upcomingPreview: upcomingData || null,
          moduleAvailability: availabilityData?.modules || null,
          loading: false,
          error: "",
          lastFetchedAt: Date.now(),
        };

        setState(nextState);
        return nextState;
      })
      .catch((error) => {
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Failed to load admin data",
        }));
        throw error;
      })
      .finally(() => {
        fetchRef.current = null;
      });

    return fetchRef.current;
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
