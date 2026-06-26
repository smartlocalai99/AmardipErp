import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { DataListSkeleton } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";

const AMC_COLUMNS = [
  { key: "record_no", label: "Record No" },
  { key: "customer_code", label: "Customer ID" },
  { key: "customer_name", label: "Customer Name" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "mobile_no", label: "Mobile No" },
  { key: "customer_status", label: "Status" },
  { key: "amc_warranty_due", label: "AMC/Warranty Due" },
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

function Pager({ pagination, page, setPage }) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">
        Page <span className="text-slate-900">{pagination.page}</span> of{" "}
        <span className="text-slate-900">{pagination.totalPages}</span> -{" "}
        <span className="text-slate-900">{pagination.total}</span> AMC records
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

export default function AdminAmcTable({ user, embedded = false }) {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(null);
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

    async function fetchAmcCustomers() {
      setLoading(false);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          status: "AMC",
        });

        if (search) params.set("search", search);

        const data = await cachedGetJson(`/api/elevator-customers?${params.toString()}`, {
          cacheKey: `amc_${params.toString()}`,
          ttlMs: 2 * 60 * 1000,
          user,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to load AMC customers");
        }

        setCustomers(data.customers || []);
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load AMC customers");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAmcCustomers();

    return () => controller.abort();
  }, [page, pageSize, search, user]);

  function openCustomer(customer) {
    if (!customer?.id) return;
    router.push(`/admin/customers/${customer.id}`);
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
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Showing {visibleFrom} - {visibleTo} of {pagination?.total || 0} active AMC records
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search ID, name, mobile, city, address"
                className="amardip-search-field flex-1"
              />

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
          <DataListSkeleton columns={AMC_COLUMNS.length} minWidth="1900px" />
        )}

        {!loading && !error && customers.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            No active AMC customers found.
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
