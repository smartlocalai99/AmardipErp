import { getUserFromRequest } from "@/lib/auth";
import { DataListSkeleton, MetricSkeletonGrid } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";
import { clearSessionCache } from "@/lib/adminCache";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function statusClasses(status) {
  const upper = String(status || "").trim().toUpperCase();

  if (upper === "AMC") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (upper === "EMC") return "border-sky-100 bg-sky-50 text-sky-700";
  if (upper === "WARRANTY") return "border-blue-100 bg-blue-50 text-blue-700";
  if (upper === "OUT OF WARRANTY") return "border-red-100 bg-red-50 text-red-700";
  if (upper === "PENDING" || upper === "ON GOING") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function scheduleStatusClasses(status) {
  const upper = String(status || "").trim().toUpperCase();

  if (upper === "TO_BE_SCHEDULED") return "border-amber-100 bg-amber-50 text-amber-700";
  if (upper === "ASSIGNED") return "border-sky-100 bg-sky-50 text-sky-700";
  if (upper === "IN_PROGRESS") return "border-blue-100 bg-blue-50 text-blue-700";
  if (upper === "MISSED") return "border-red-100 bg-red-50 text-red-700";
  return "border-emerald-100 bg-emerald-50 text-emerald-700";
}

function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${className}`}>
      {children}
    </span>
  );
}

function SummaryCard({ label, value, tone }) {
  const toneClass =
    tone === "green"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-[#0a649d]";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function Pager({ pagination, page, setPage }) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">
        Page <span className="text-slate-900">{pagination.page}</span> of{" "}
        <span className="text-slate-900">{pagination.totalPages}</span> -{" "}
        <span className="text-slate-900">{pagination.total}</span> services
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

export async function getServerSideProps(context) {
  const user = await getUserFromRequest(context.req);

  if (!user) {
    return {
      redirect: {
        destination: "/Adminlogin",
        permanent: false,
      },
    };
  }

  if (user.role === "customer") {
    return {
      redirect: {
        destination: "/Customerdashboard",
        permanent: false,
      },
    };
  }

  if (user.role === "worker") {
    return {
      redirect: {
        destination: "/Techniciandashboard",
        permanent: false,
      },
    };
  }

  if (user.role === "storekeeper") {
    return {
      redirect: {
        destination: "/Storedashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user,
    },
  };
}

export default function UpcomingServicesPage({ user }) {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ scheduled: 0, toBeScheduled: 0, total: 0 });
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRow, setSelectedRow] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledDate: "",
    preferredTime: "",
    assignedTechnicianName: "",
    priority: "NORMAL",
    notes: "",
  });
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

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
    const controller = new AbortController();

    async function loadUpcomingServices() {
      setLoading(false);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          mode,
          status,
        });

        if (search) params.set("search", search);

        const data = await cachedGetJson(`/api/service-schedules/upcoming?${params.toString()}`, {
          cacheKey: `upcoming_services_${params.toString()}`,
          ttlMs: 2 * 60 * 1000,
          forceRefresh: refreshKey > 0,
          user,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to load upcoming services");
        }

        setRows(data.rows || []);
        setSummary(data.summary || { scheduled: 0, toBeScheduled: 0, total: 0 });
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load upcoming services");
        }
      } finally {
        setLoading(false);
      }
    }

    loadUpcomingServices();

    return () => controller.abort();
  }, [page, pageSize, search, mode, status, refreshKey, user]);

  function openSchedule(row) {
    setSelectedRow(row);
    setScheduleError("");
    setScheduleForm({
      scheduledDate: "",
      preferredTime: "",
      assignedTechnicianName: "",
      priority: "NORMAL",
      notes: "",
    });
  }

  async function submitSchedule(event) {
    event.preventDefault();
    if (!selectedRow) return;

    setScheduleBusy(true);
    setScheduleError("");

    try {
      const response = await fetch("/api/service-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedRow.customerId,
          scheduledDate: scheduleForm.scheduledDate,
          preferredTime: scheduleForm.preferredTime,
          assignedTechnicianName: scheduleForm.assignedTechnicianName,
          priority: scheduleForm.priority,
          notes: scheduleForm.notes,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to schedule service");
      }

      clearSessionCache("amardip_admin_cache");
      setSelectedRow(null);
      setMode("all");
      setStatus("ALL");
      setPage(1);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setScheduleError(err.message || "Failed to schedule service");
    } finally {
      setScheduleBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a]">
      <header className="sticky top-0 z-30 bg-[#0a649d] px-4 py-4 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
              Monthly service planning
            </p>
            <h1 className="truncate text-lg font-black tracking-tight">
              Upcoming Services
            </h1>
            <p className="mt-1 text-xs font-semibold text-white/75">
              Logged in as {user?.name || "Admin"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 sm:py-6">
        {loading && !pagination ? (
          <MetricSkeletonGrid count={3} columns="grid-cols-3" />
        ) : (
          <section className="grid grid-cols-3 gap-3">
            <SummaryCard label="Scheduled" value={summary.scheduled} tone="green" />
            <SummaryCard label="To Schedule" value={summary.toBeScheduled} tone="amber" />
            <SummaryCard label="Total" value={summary.total} tone="blue" />
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-base font-black text-slate-900">Service Planning Queue</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Showing {visibleFrom} - {visibleTo} of {pagination?.total || 0} monthly service records
            </p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer, mobile, city"
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-800 outline-none focus:border-[#0a649d] lg:col-span-2"
            />
            <select
              value={mode}
              onChange={(event) => {
                setPage(1);
                setMode(event.target.value);
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-[#0a649d]"
            >
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="to_be_scheduled">To Be Scheduled</option>
            </select>
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-[#0a649d]"
            >
              <option value="ALL">All Status</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="MISSED">MISSED</option>
              <option value="TO_BE_SCHEDULED">TO_BE_SCHEDULED</option>
            </select>
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-[#0a649d]"
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
          <DataListSkeleton columns={11} minWidth="1600px" />
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            No upcoming service records found.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <section className="space-y-3 md:hidden">
              {rows.map((row) => (
                <article key={`${row.rowType}-${row.scheduleId || row.customerId}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                        {displayValue(row.customerCode)}
                      </p>
                      <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
                        {displayValue(row.customerName)}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {displayValue(row.city)} - {displayValue(row.mobileNo)}
                      </p>
                    </div>
                    <Badge className={statusClasses(row.customerStatus)}>
                      {displayValue(row.customerStatus)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Last Service</span>
                      {displayValue(row.lastServiceDate)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Days Since</span>
                      {displayValue(row.daysSinceLastService)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Scheduled</span>
                      {displayValue(row.scheduledDate)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Due</span>
                      {displayValue(row.amcWarrantyDue)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Badge className={scheduleStatusClasses(row.scheduleStatus)}>
                      {displayValue(row.scheduleStatus)}
                    </Badge>
                    {row.rowType === "TO_BE_SCHEDULED" ? (
                      <button
                        type="button"
                        onClick={() => openSchedule(row)}
                        className="h-9 rounded-xl bg-[#0a649d] px-4 text-xs font-black text-white active:scale-95"
                      >
                        Schedule Service
                      </button>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-slate-400">Already Scheduled</span>
                    )}
                  </div>
                </article>
              ))}
            </section>

            <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-[1600px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      {["Customer", "Mobile", "City", "Customer Status", "Last Service", "Days", "Schedule Status", "Scheduled Date", "Technician", "AMC/Warranty", "Action"].map((label) => (
                        <th key={label} className="whitespace-nowrap px-3 py-3 font-black">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={`${row.rowType}-${row.scheduleId || row.customerId}`} className="hover:bg-slate-50">
                        <td className="max-w-[260px] px-3 py-3 font-semibold text-slate-700">
                          <p className="font-black text-slate-900">{displayValue(row.customerName)}</p>
                          <p className="text-[10px] font-black uppercase text-[#0a649d]">{displayValue(row.customerCode)}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.mobileNo)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.city)}</td>
                        <td className="whitespace-nowrap px-3 py-3"><Badge className={statusClasses(row.customerStatus)}>{displayValue(row.customerStatus)}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.lastServiceDate)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.daysSinceLastService)}</td>
                        <td className="whitespace-nowrap px-3 py-3"><Badge className={scheduleStatusClasses(row.scheduleStatus)}>{displayValue(row.scheduleStatus)}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.scheduledDate)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.assignedTechnicianName)}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.amcWarrantyDue)}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {row.rowType === "TO_BE_SCHEDULED" ? (
                            <button
                              type="button"
                              onClick={() => openSchedule(row)}
                              className="h-9 rounded-xl bg-[#0a649d] px-4 text-xs font-black text-white active:scale-95"
                            >
                              Schedule
                            </button>
                          ) : (
                            <span className="text-[10px] font-black uppercase text-slate-400">Already Scheduled</span>
                          )}
                        </td>
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

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close schedule drawer"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedRow(null)}
          />
          <form onSubmit={submitSchedule} className="relative w-full max-w-lg rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                  Schedule Service
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {displayValue(selectedRow.customerName)}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {displayValue(selectedRow.customerCode)} - {displayValue(selectedRow.mobileNo)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-500"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                type="date"
                value={scheduleForm.scheduledDate}
                onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledDate: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#0a649d]"
              />
              <input
                type="text"
                value={scheduleForm.preferredTime}
                onChange={(event) => setScheduleForm((current) => ({ ...current, preferredTime: event.target.value }))}
                placeholder="Preferred time"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#0a649d]"
              />
              <input
                type="text"
                value={scheduleForm.assignedTechnicianName}
                onChange={(event) => setScheduleForm((current) => ({ ...current, assignedTechnicianName: event.target.value }))}
                placeholder="Technician name"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#0a649d]"
              />
              <select
                value={scheduleForm.priority}
                onChange={(event) => setScheduleForm((current) => ({ ...current, priority: event.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-[#0a649d]"
              >
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="EMERGENCY">EMERGENCY</option>
              </select>
              <textarea
                value={scheduleForm.notes}
                onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Notes"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-[#0a649d]"
              />
            </div>

            {scheduleError && (
              <p className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                {scheduleError}
              </p>
            )}

            <button
              type="submit"
              disabled={scheduleBusy}
              className="mt-4 h-11 w-full rounded-2xl bg-[#0a649d] text-sm font-black text-white active:scale-95 disabled:opacity-60"
            >
              {scheduleBusy ? "Scheduling..." : "Save Schedule"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
