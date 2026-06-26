import { cachedGetJson } from "@/lib/cachedFetch";
import { clearSessionCache } from "@/lib/adminCache";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const DASHBOARD_TTL_MS = 5 * 60 * 1000;

const AdminAppDataContext = createContext(null);

const initialState = {
  customerStats: null,
  serviceStats: null,
  upcomingPreview: null,
  loading: true,
  error: "",
  lastFetchedAt: null,
};

export function AdminAppDataProvider({ user, children }) {
  const [state, setState] = useState(initialState);
  const fetchRef = useRef(null);

  const loadAdminData = useCallback(async ({ forceRefresh = false } = {}) => {
    if (fetchRef.current && !forceRefresh) {
      return fetchRef.current;
    }

    setState((current) => ({ ...current, loading: true, error: "" }));

    fetchRef.current = Promise.all([
      cachedGetJson("/api/elevator-customers/stats", {
        cacheKey: "dashboard_customer_stats",
        ttlMs: DASHBOARD_TTL_MS,
        forceRefresh,
        user,
      }),
      cachedGetJson("/api/elevator-service-visits/stats", {
        cacheKey: "dashboard_service_stats",
        ttlMs: DASHBOARD_TTL_MS,
        forceRefresh,
        user,
      }),
      cachedGetJson("/api/service-schedules/upcoming?page=1&pageSize=5", {
        cacheKey: "dashboard_upcoming_preview",
        ttlMs: DASHBOARD_TTL_MS,
        forceRefresh,
        user,
      }),
    ])
      .then(([customerData, serviceData, upcomingData]) => {
        const nextState = {
          customerStats: customerData?.stats || null,
          serviceStats: serviceData?.stats || null,
          upcomingPreview: upcomingData || null,
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
  }, [user]);

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
