import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { DataListSkeleton } from "@/components/ui/SkeletonLoaders";
import { getCustomerDueDate } from "@/lib/customerDates";

const AMC_COLUMNS = [
  { key: "record_no", label: "Record No" },
  { key: "customer_code", label: "Customer ID" },
  { key: "customer_name", label: "Customer Name" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "mobile_no", label: "Mobile No" },
  { key: "customer_status", label: "Status" },
  { key: "amc_warranty_due", label: "AMC/Warranty Due" },
  { key: "amc_state", label: "AMC State" },
  { key: "amc_starting_date", label: "AMC Start" },
  { key: "amc_ending_date", label: "AMC End" },
  { key: "no_of_passenger", label: "Passengers" },
  { key: "door_type", label: "Door Type" },
  { key: "cabin", label: "Cabin" },
  { key: "no_of_floors", label: "Floors" },
  { key: "motor_make", label: "Motor Make" },
  { key: "controller_make", label: "Controller" },
  { key: "drive_make", label: "Drive" },
  { key: "elevator_type", label: "Elevator Type" },
  { key: "door_make", label: "Door Make" },
];

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function CountSkeleton() {
  return (
    <span className="mt-2 block h-3 w-44 animate-pulse rounded-full bg-slate-200" />
  );
}

function getAmcState(customer) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = getCustomerDueDate(customer);
  if (!dueDate) return { label: "Missing", classes: "border-slate-200 bg-slate-100 text-slate-700" };

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: "Expired", classes: "border-red-100 bg-red-50 text-red-700" };
  if (diffDays <= 30) return { label: "Due Soon", classes: "border-amber-100 bg-amber-50 text-amber-700" };
  return { label: "Active", classes: "border-emerald-100 bg-emerald-50 text-emerald-700" };
}

function AmcStateBadge({ customer }) {
  const state = getAmcState(customer);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${state.classes}`}>
      {state.label}
    </span>
  );
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

// Infinite-scroll end marker — an IntersectionObserver on this node loads
// the next page instead of a page-size dropdown + Previous/Next buttons.
function InfiniteScrollSentinel({ sentinelRef, hasMore, loadingMore, hasItems }) {
  if (!hasItems) return null;
  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-5">
      {loadingMore ? (
        <span className="text-xs font-bold text-slate-400">Loading more…</span>
      ) : !hasMore ? (
        <span className="text-xs font-bold text-slate-300">You&apos;ve reached the end</span>
      ) : null}
    </div>
  );
}

export default function AdminAmcTable({ user, embedded = false, returnTo = "/admin/amc", filterMode = "amc" }) {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef(null);

  const filterModeLabel =
    filterMode === "expired" ? "expired AMC" : filterMode === "this_month" ? "expiring this month" : filterMode === "next_month" ? "expiring next month" : "active AMC";

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(timer);
  }, [filterMode]);

  useEffect(() => {
    const controller = new AbortController();
    const isFirstPage = page === 1;

    async function fetchAmcCustomers() {
      if (isFirstPage) setLoading(true); else setLoadingMore(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        if (filterMode === "amc") {
          params.set("status", "AMC");
        } else {
          params.set("dueFilter", filterMode);
        }

        if (search) params.set("search", search);

        // Real-time AMC data, no client cache — an admin renewing a contract
        // or completing a service needs the list to reflect that immediately.
        const response = await fetch(`/api/elevator-customers?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load AMC customers");
        }

        setCustomers((prev) => (isFirstPage ? (data.customers || []) : [...prev, ...(data.customers || [])]));
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load AMC customers");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    }

    fetchAmcCustomers();

    return () => controller.abort();
  }, [page, search, filterMode]);

  useEffect(() => {
    if (!pagination?.hasNext || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setPage((prev) => prev + 1);
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [pagination?.hasNext, loading, loadingMore]);

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
              Active AMC Customers
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
                AMC Service Accounts
              </h2>
              {loading && !pagination ? (
                <CountSkeleton />
              ) : (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Loaded {customers.length} of {pagination?.total || 0} {filterModeLabel} records
                </p>
              )}
            </div>

            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search ID, name, mobile, city, address"
              className="amardip-search-field w-full"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <DataListSkeleton columns={AMC_COLUMNS.length} minWidth="1900px" />
        )}

        {!loading && !error && customers.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            {filterMode === "expired"
              ? "No expired AMC contracts."
              : filterMode === "this_month"
              ? "Nothing expiring this month."
              : filterMode === "next_month"
              ? "Nothing expiring next month."
              : "No active AMC customers found."}
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
                        {displayValue(customer.city)} - {displayValue(customer.mobile_no)}
                      </p>
                    </div>
                    <StatusBadge status={customer.customer_status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Due</span>
                      {displayValue(customer.amc_warranty_due)}
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Floors</span>
                      {displayValue(customer.no_of_floors)}
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
                <table className="min-w-[1900px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      {AMC_COLUMNS.map((column) => (
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
                        {AMC_COLUMNS.map((column) => (
                          <td key={column.key} className="max-w-[240px] whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                            {column.key === "customer_status" ? (
                              <StatusBadge status={customer.customer_status} />
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

            <InfiniteScrollSentinel
              sentinelRef={sentinelRef}
              hasMore={Boolean(pagination?.hasNext)}
              loadingMore={loadingMore}
              hasItems={customers.length > 0}
            />
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
