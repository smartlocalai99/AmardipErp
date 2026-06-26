import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DataListSkeleton } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";

const TABLE_COLUMNS = [
  { key: "customer_code", label: "Customer ID" },
  { key: "customer_name", label: "Customer Name" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "mobile_no", label: "Mobile No" },
  { key: "hoc_date", label: "HOC Date" },
  { key: "customer_status", label: "Status" },
  { key: "amc_warranty_due", label: "AMC/Warranty Due" },
  { key: "amc_state", label: "AMC State" },
];

const DETAIL_COLUMNS = [
  { key: "record_no", label: "Record No" },
  ...TABLE_COLUMNS,
  { key: "amc_starting_date", label: "AMC Start" },
  { key: "amc_ending_date", label: "AMC End" },
  { key: "no_of_passenger", label: "Passengers" },
  { key: "door_type", label: "Door Type" },
  { key: "cabin", label: "Cabin" },
  { key: "no_of_floors", label: "Floors" },
  { key: "motor_make", label: "Motor Make" },
  { key: "controller_make", label: "Controller" },
  { key: "drive_make", label: "Drive" },
  { key: "ard_make", label: "ARD" },
  { key: "drive_model_no", label: "Drive Model" },
  { key: "motor_model_no", label: "Motor Model" },
  { key: "elevator_type", label: "Elevator Type" },
  { key: "door_make", label: "Door Make" },
  { key: "remarks", label: "Remarks" },
];

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function CountSkeleton() {
  return (
    <span className="mt-2 block h-3 w-40 animate-pulse rounded-full bg-slate-200" />
  );
}

function getAmcState(customer) {
  const rawDate = customer?.amc_warranty_due || customer?.amc_ending_date;
  if (!rawDate) return { label: "Missing", classes: "bg-slate-100 text-slate-700 border-slate-200" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${String(rawDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return { label: "Missing", classes: "bg-slate-100 text-slate-700 border-slate-200" };

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: "Expired", classes: "bg-red-50 text-red-700 border-red-100" };
  if (diffDays <= 30) return { label: "Due Soon", classes: "bg-amber-50 text-amber-700 border-amber-100" };
  return { label: "Active", classes: "bg-emerald-50 text-emerald-700 border-emerald-100" };
}

function AmcStateBadge({ customer }) {
  const state = getAmcState(customer);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${state.classes}`}>
      {state.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "Unknown").trim();
  const upper = value.toUpperCase();

  let classes = "bg-slate-100 text-slate-700 border-slate-200";

  if (upper === "AMC") {
    classes = "bg-emerald-50 text-emerald-700 border-emerald-100";
  } else if (upper === "EMC") {
    classes = "bg-sky-50 text-sky-700 border-sky-100";
  } else if (upper === "WARRANTY") {
    classes = "bg-blue-50 text-blue-700 border-blue-100";
  } else if (upper === "OUT OF WARRANTY") {
    classes = "bg-red-50 text-red-700 border-red-100";
  } else if (upper === "ON GOING" || upper === "PENDING") {
    classes = "bg-amber-50 text-amber-700 border-amber-100";
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase whitespace-nowrap ${classes}`}>
      {value || "—"}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-2 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="text-xs font-semibold leading-relaxed text-slate-700 break-words">
        {displayValue(value)}
      </span>
    </div>
  );
}

function Pagination({ pagination, page, setPage }) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-bold text-slate-500">
        Page <span className="text-slate-900">{pagination.page}</span> of{" "}
        <span className="text-slate-900">{pagination.totalPages}</span> •{" "}
        <span className="text-slate-900">{pagination.total}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <button
          type="button"
          disabled={!pagination.hasPrev}
          onClick={() => setPage(Math.max(1, page - 1))}
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={!pagination.hasNext}
          onClick={() => setPage(page + 1)}
          className="h-10 rounded-xl bg-[#0a649d] px-4 text-xs font-black text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function CustomerDetailsSheet({ customer, onClose }) {
  if (!customer) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close customer details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section className="relative max-h-[86dvh] w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[28px]">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0a649d]">
                {displayValue(customer.customer_code)}
              </p>
              <h2 className="mt-1 text-lg font-black leading-tight text-slate-900">
                {displayValue(customer.customer_name)}
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {displayValue(customer.city)} • {displayValue(customer.mobile_no)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-black leading-none text-slate-500 active:scale-95"
            >
              ×
            </button>
          </div>
        </div>

        <div className="max-h-[calc(86dvh-108px)] overflow-y-auto px-4 py-3">
          <div className="rounded-2xl bg-slate-50 px-3">
            {DETAIL_COLUMNS.map((column) => (
              <DetailRow
                key={column.key}
                label={column.label}
                value={customer[column.key]}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminCustomersTable({ user, embedded = false, returnTo = "/admin/customers" }) {
  const router = useRouter();
  const userCacheKey = user?.id || user?.username || user?.role || "anonymous";
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

    async function fetchCustomers() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });

        if (search) {
          params.set("search", search);
        }

        const data = await cachedGetJson(`/api/elevator-customers?${params.toString()}`, {
          cacheKey: `customers_${params.toString()}`,
          ttlMs: 5 * 60 * 1000,
          user: userCacheKey,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });
        if (!data.success) {
          throw new Error(data.message || "Failed to load customers");
        }

        setCustomers(data.customers || []);
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load customers");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();

    return () => controller.abort();
  }, [page, pageSize, search, userCacheKey]);

  function openCustomer(customer) {
    if (!customer?.id) return;
    router.push({
      pathname: `/admin/customers/${customer.id}`,
      query: {
        returnTo,
      },
    });
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
                Customer Service Database
              </h1>
              <p className="mt-1 text-xs font-semibold text-white/75">
                Logged in as {user?.name || "Admin"}
              </p>
            </div>
          </div>
        </header>
      )}

      <main className={`${embedded ? "space-y-3" : "mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-5 sm:py-6"}`}>
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                All Elevator Customers
              </h2>
              {loading && !pagination ? (
                <CountSkeleton />
              ) : (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Showing {visibleFrom} - {visibleTo} of {pagination?.total || 0} records
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, ID, mobile, city, status"
                  className="amardip-search-field w-full pr-10"
                />

                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-500 active:scale-95"
                  >
                    ×
                  </button>
                )}
              </div>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
                className="amardip-field text-sm"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <DataListSkeleton columns={TABLE_COLUMNS.length} minWidth="1120px" />
        )}

        {!loading && !error && customers.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            No customers found.
          </div>
        )}

        {!loading && !error && customers.length > 0 && (
          <>
            <section className="space-y-3 md:hidden">
              {customers.map((customer) => (
                <button
                  type="button"
                  key={customer.id || `${customer.record_no}-${customer.customer_code}`}
                  onClick={() => openCustomer(customer)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                        {displayValue(customer.customer_code)}
                      </p>

                      <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
                        {displayValue(customer.customer_name)}
                      </h3>

                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {displayValue(customer.city)} • {displayValue(customer.mobile_no)}
                      </p>
                    </div>

                    <StatusBadge status={customer.customer_status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">HOC Date</span>
                      {displayValue(customer.hoc_date)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">AMC/Warranty</span>
                      {displayValue(customer.amc_warranty_due)}
                    </div>
                  </div>
                  <div className="mt-3">
                    <AmcStateBadge customer={customer} />
                  </div>
                </button>
              ))}
            </section>

            <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-[1120px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th key={column.key} className="whitespace-nowrap px-3 py-3 font-black">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id || `${customer.record_no}-${customer.customer_code}`}
                        onClick={() => openCustomer(customer)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        {TABLE_COLUMNS.map((column) => (
                          <td
                            key={column.key}
                            className="max-w-[220px] whitespace-nowrap px-3 py-3 font-semibold text-slate-700"
                          >
                            {column.key === "customer_status" ? (
                              <StatusBadge status={customer[column.key]} />
                            ) : column.key === "amc_state" ? (
                              <AmcStateBadge customer={customer} />
                            ) : (
                              <span title={String(displayValue(customer[column.key]))}>
                                {displayValue(customer[column.key])}
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

            <Pagination pagination={pagination} page={page} setPage={setPage} />
          </>
        )}
      </main>

      <CustomerDetailsSheet
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
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
