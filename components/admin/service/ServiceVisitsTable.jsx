import { useEffect, useMemo, useState } from "react";
import { DataListSkeleton, MetricSkeletonGrid } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";

const VISIT_COLUMNS = [
  { key: "service_date", label: "Service Date" },
  { key: "customer_code", label: "Customer ID" },
  { key: "customer_name_snapshot", label: "Customer Name" },
  { key: "mobile_no_snapshot", label: "Mobile" },
  { key: "city_snapshot", label: "City" },
  { key: "service_type", label: "Service Type" },
  { key: "technician_1", label: "Technician 1" },
  { key: "technician_2", label: "Technician 2" },
  { key: "ard_condition", label: "ARD" },
  { key: "motor_condition", label: "Motor" },
  { key: "gear_oil_condition", label: "Gear Oil" },
  { key: "brake_condition", label: "Brake" },
  { key: "rope_condition", label: "Rope" },
  { key: "rail_clips_condition", label: "Rail Clips" },
  { key: "limit_switch_condition", label: "Limit Switch" },
  { key: "gate_locks_condition", label: "Gate Locks" },
  { key: "rcr_condition", label: "RCR" },
  { key: "sensors_condition", label: "Sensors" },
  { key: "osg_condition", label: "OSG" },
  { key: "payment_amount", label: "Payment" },
  { key: "remarks", label: "Remarks" },
  { key: "link_status", label: "Link" },
];

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function CountSkeleton() {
  return (
    <span className="mt-2 block h-3 w-48 animate-pulse rounded-full bg-slate-200" />
  );
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

function LinkBadge({ status }) {
  const isLinked = status === "Linked";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
      isLinked
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : "border-amber-100 bg-amber-50 text-amber-700"
    }`}>
      {isLinked ? "Linked" : "Unlinked"}
    </span>
  );
}

function Pager({ pagination, page, setPage }) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">
        Page <span className="text-slate-900">{pagination.page}</span> of{" "}
        <span className="text-slate-900">{pagination.totalPages}</span> -{" "}
        <span className="text-slate-900">{pagination.total}</span> visits
      </p>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          disabled={!pagination.hasPrev}
          onClick={() => setPage(Math.max(1, page - 1))}
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!pagination.hasNext}
          onClick={() => setPage(page + 1)}
          className="h-10 rounded-xl bg-[#0a649d] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ServiceVisitsTable({ user, embedded = false }) {
  const userCacheKey = user?.id || user?.username || user?.role || "anonymous";
  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState({
    serviceType: "",
    technician: "",
    fromDate: "",
    toDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleFrom = useMemo(() => {
    if (!pagination || pagination.total === 0) return 0;
    return (pagination.page - 1) * pagination.pageSize + 1;
  }, [pagination]);

  const visibleTo = useMemo(() => {
    if (!pagination) return 0;
    return Math.min(pagination.page * pagination.pageSize, pagination.total);
  }, [pagination]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await cachedGetJson("/api/elevator-service-visits/stats", {
          cacheKey: "service_visits_stats",
          ttlMs: 5 * 60 * 1000,
          user: userCacheKey,
          onNetworkStart: () => setStats(null),
        });

        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load service stats:", err);
      }
    }

    fetchStats();
  }, [userCacheKey]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchVisits() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });

        if (search) params.set("search", search);
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });

        const data = await cachedGetJson(`/api/elevator-service-visits?${params.toString()}`, {
          cacheKey: `service_visits_${params.toString()}`,
          ttlMs: 5 * 60 * 1000,
          user: userCacheKey,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to load service visits");
        }

        setVisits(data.visits || []);
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load service visits");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchVisits();

    return () => controller.abort();
  }, [page, pageSize, search, filters, userCacheKey]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const content = (
    <>
      {!embedded && (
        <header className="sticky top-0 z-30 bg-[#0a649d] px-4 py-4 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
              Amardip Elevators
            </p>
            <h1 className="truncate text-lg font-black tracking-tight sm:text-2xl">
              Service Visits
            </h1>
            <p className="mt-1 text-xs font-semibold text-white/75">
              Logged in as {user?.name || "Admin"}
            </p>
          </div>
        </div>
        </header>
      )}

      <main className={`${embedded ? "space-y-3" : "mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 sm:py-6"}`}>
        {stats ? (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Visits</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{stats.totalServiceVisits}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Linked</p>
              <p className="mt-2 text-2xl font-black text-emerald-600">{stats.linkedServiceVisits}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Unlinked</p>
              <p className="mt-2 text-2xl font-black text-amber-600">{stats.unlinkedServiceVisits}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-slate-400">Technicians</p>
              <p className="mt-2 text-2xl font-black text-[#0a649d]">{stats.uniqueTechnicians}</p>
            </div>
          </section>
        ) : (
          <MetricSkeletonGrid count={4} />
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Service Ledger
              </h2>
              {loading && !pagination ? (
                <CountSkeleton />
              ) : (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Showing {visibleFrom} - {visibleTo} of {pagination?.total || 0} service records
                </p>
              )}
            </div>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-6">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search visits"
                className="amardip-search-field lg:col-span-2"
              />
              <input
                type="text"
                value={filters.serviceType}
                onChange={(event) => updateFilter("serviceType", event.target.value)}
                placeholder="Service type"
                className="amardip-field"
              />
              <input
                type="text"
                value={filters.technician}
                onChange={(event) => updateFilter("technician", event.target.value)}
                placeholder="Technician"
                className="amardip-field"
              />
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) => updateFilter("fromDate", event.target.value)}
                className="amardip-field text-sm"
              />
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => updateFilter("toDate", event.target.value)}
                className="amardip-field text-sm"
              />
            </div>

            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              className="amardip-field w-full text-sm sm:w-auto"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <DataListSkeleton columns={VISIT_COLUMNS.length} minWidth="2400px" />
        )}

        {!loading && !error && visits.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            No service visits found.
          </div>
        )}

        {!loading && !error && visits.length > 0 && (
          <>
            <section className="space-y-3 md:hidden">
              {visits.map((visit) => (
                <button
                  type="button"
                  key={visit.id}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                        {displayValue(visit.customer_code)}
                      </p>
                      <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
                        {displayValue(visit.customer_name_snapshot)}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {displayValue(visit.service_date)} - {displayValue(visit.service_type)}
                      </p>
                    </div>
                    <LinkBadge status={visit.link_status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Technician</span>
                      {displayValue(visit.technician_1)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Payment</span>
                      {formatMoney(visit.payment_amount)}
                    </div>
                  </div>
                </button>
              ))}
            </section>

            <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-[2400px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      {VISIT_COLUMNS.map((column) => (
                        <th key={column.key} className="whitespace-nowrap px-3 py-3 font-black">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {visits.map((visit) => (
                      <tr key={visit.id} className="cursor-pointer hover:bg-slate-50">
                        {VISIT_COLUMNS.map((column) => (
                          <td key={column.key} className="max-w-[260px] whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                            {column.key === "link_status" ? (
                              <LinkBadge status={visit.link_status} />
                            ) : column.key === "payment_amount" ? (
                              formatMoney(visit.payment_amount)
                            ) : (
                              <span title={String(displayValue(visit[column.key]))}>
                                {displayValue(visit[column.key])}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <Pager pagination={pagination} page={page} setPage={setPage} />
          </>
        )}
      </main>
    </>
  );

  if (embedded) {
    return <div className="text-[#0f172a]">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a]">
      {content}
    </div>
  );
}
