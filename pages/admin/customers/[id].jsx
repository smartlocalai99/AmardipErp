import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { DataListSkeleton } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const SUMMARY_FIELDS = [
  { key: "mobile_no", label: "Mobile Number" },
  { key: "city", label: "City" },
  { key: "amc_warranty_due", label: "AMC/Warranty Due" },
  { key: "amc_starting_date", label: "AMC Start" },
  { key: "amc_ending_date", label: "AMC End" },
  { key: "no_of_floors", label: "Floors" },
  { key: "no_of_passenger", label: "Passenger Capacity" },
  { key: "hoc_date", label: "HOC Date" },
];

const TECH_FIELDS = [
  { key: "door_type", label: "Door Type" },
  { key: "cabin", label: "Cabin" },
  { key: "motor_make", label: "Motor Make" },
  { key: "controller_make", label: "Controller Make" },
  { key: "drive_make", label: "Drive Make" },
  { key: "ard_make", label: "ARD Make" },
  { key: "drive_model_no", label: "Drive Model" },
  { key: "motor_model_no", label: "Motor Model" },
  { key: "elevator_type", label: "Elevator Type" },
  { key: "door_make", label: "Door Make" },
];

const VISIT_COLUMNS = [
  { key: "service_date", label: "Service Date" },
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
  { key: "source_sno", label: "Source S.No" },
];

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
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

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClasses(status)}`}>
      {displayValue(status)}
    </span>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-slate-900">
        {displayValue(value)}
      </p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="break-words text-xs font-bold text-slate-700">
        {displayValue(value)}
      </span>
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

  const customerResult = await query(
    `
    SELECT
      id,
      record_no,
      customer_code,
      customer_name,
      address,
      city,
      mobile_no,
      hoc_date,
      customer_status,
      amc_warranty_due,
      amc_starting_date,
      amc_ending_date,
      no_of_passenger,
      door_type,
      cabin,
      no_of_floors,
      motor_make,
      controller_make,
      drive_make,
      ard_make,
      drive_model_no,
      motor_model_no,
      elevator_type,
      door_make,
      location,
      remarks
    FROM elevator_service_customers
    WHERE id = $1
    LIMIT 1
    `,
    [context.params.id]
  );

  if (customerResult.rowCount === 0) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user,
      customer: JSON.parse(JSON.stringify(customerResult.rows[0])),
    },
  };
}

export default function CustomerDetailPage({ user, customer }) {
  const router = useRouter();
  const [visits, setVisits] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    serviceType: "",
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
    const controller = new AbortController();

    async function fetchVisits() {
      setLoading(false);
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

        const data = await cachedGetJson(`/api/elevator-customers/${customer.id}/service-visits?${params.toString()}`, {
          cacheKey: `customer_${customer.id}_service_visits_${params.toString()}`,
          ttlMs: 2 * 60 * 1000,
          user,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to load service history");
        }

        setVisits(data.visits || []);
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load service history");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchVisits();

    return () => controller.abort();
  }, [customer.id, page, pageSize, search, filters, user]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
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
              {displayValue(customer.customer_code)}
            </p>
            <h1 className="truncate text-lg font-black tracking-tight">
              {displayValue(customer.customer_name)}
            </h1>
            <p className="mt-1 text-xs font-semibold text-white/75">
              Logged in as {user?.name || "Admin"}
            </p>
          </div>

          <StatusBadge status={customer.customer_status} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 sm:py-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
            Customer Profile
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-slate-900">
            {displayValue(customer.customer_name)}
          </h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
            {displayValue(customer.address)}
          </p>
          {customer.location && (
            <p className="mt-1 text-xs font-bold text-slate-500">
              Location: {displayValue(customer.location)}
            </p>
          )}
          {customer.remarks && (
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600">
              {customer.remarks}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 px-1 text-xs font-black uppercase tracking-wider text-slate-400">
            Customer Summary
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SUMMARY_FIELDS.map((field) => (
              <InfoCard key={field.key} label={field.label} value={customer[field.key]} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-xs font-black uppercase tracking-wider text-slate-400">
            Lift Technical Details
          </h2>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 shadow-sm">
            {TECH_FIELDS.map((field) => (
              <DetailRow key={field.key} label={field.label} value={customer[field.key]} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                Service History
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-900">
                Visit Ledger
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Showing {visibleFrom} - {visibleTo} of {pagination?.total || 0} service records
              </p>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-6">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search service history"
                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-800 outline-none focus:border-[#0a649d] lg:col-span-2"
              />
              <input
                type="text"
                value={filters.serviceType}
                onChange={(event) => updateFilter("serviceType", event.target.value)}
                placeholder="Service type"
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-[#0a649d]"
              />
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) => updateFilter("fromDate", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-[#0a649d]"
              />
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => updateFilter("toDate", event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-[#0a649d]"
              />
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
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <DataListSkeleton columns={VISIT_COLUMNS.length} minWidth="2200px" />
          )}

          {!loading && !error && visits.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
              No service visits found for this customer.
            </div>
          )}

          {!loading && !error && visits.length > 0 && (
            <>
              <section className="space-y-3 md:hidden">
                {visits.map((visit) => (
                  <article key={visit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                          {displayValue(visit.service_date)}
                        </p>
                        <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
                          {displayValue(visit.service_type)}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {displayValue(visit.technician_1)}
                          {visit.technician_2 ? ` / ${visit.technician_2}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">
                        {formatMoney(visit.payment_amount)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Motor</span>
                        {displayValue(visit.motor_condition)}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Brake</span>
                        {displayValue(visit.brake_condition)}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Rope</span>
                        {displayValue(visit.rope_condition)}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Sensors</span>
                        {displayValue(visit.sensors_condition)}
                      </div>
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-600">
                      {displayValue(visit.remarks)}
                    </p>
                  </article>
                ))}
              </section>

              <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[2200px] text-left text-xs">
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
                        <tr key={visit.id} className="hover:bg-slate-50">
                          {VISIT_COLUMNS.map((column) => (
                            <td key={column.key} className="max-w-[260px] whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                              {column.key === "payment_amount" ? (
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
        </section>
      </main>
    </div>
  );
}
