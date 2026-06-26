import { getUserFromRequest } from "@/lib/auth";
import { DataListSkeleton, MetricSkeletonGrid } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function displayValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value === null || value === undefined || value === "" ? "-" : value;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-IN");
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

function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${className}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, tone = "blue" }) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "green"
          ? "text-emerald-600"
          : "text-[#0a649d]";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{formatCount(value)}</p>
    </div>
  );
}

function CustomerCard({ row }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
            {displayValue(row.customer_code)}
          </p>
          <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
            {displayValue(row.customer_name)}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {displayValue(row.city)} - {displayValue(row.mobile_no)}
          </p>
        </div>
        <Badge className={statusClasses(row.customer_status)}>{displayValue(row.customer_status)}</Badge>
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
        {displayValue(row.address)}
      </p>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">AMC/Warranty Due</span>
        {displayValue(row.due_date || row.amc_warranty_due)}
      </div>
    </article>
  );
}

function ServiceCard({ row }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
        {displayValue(row.customer_code)}
      </p>
      <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
        {displayValue(row.customer_name || row.customer_name_snapshot)}
      </h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        {displayValue(row.service_date || row.scheduled_date)} - {displayValue(row.service_type || row.schedule_status)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Technician</span>
          {displayValue(row.technician_1 || row.assigned_technician_name)}
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Mobile</span>
          {displayValue(row.mobile_no || row.mobile_no_snapshot)}
        </div>
      </div>
    </article>
  );
}

function ReportList({ title, rows, type = "customer" }) {
  return (
    <section className="space-y-3">
      <h3 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">{title}</h3>
      {rows?.length ? (
        <>
          <div className="space-y-3 md:hidden">
            {rows.map((row, index) => (
              type === "service"
                ? <ServiceCard key={row.id || row.schedule_id || `${title}-${index}`} row={row} />
                : <CustomerCard key={row.id || row.customer_code || `${title}-${index}`} row={row} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] text-left text-xs">
                <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {["Code", "Name", "Mobile", "City", "Status/Type", "Date", "Technician"].map((label) => (
                      <th key={label} className="whitespace-nowrap px-3 py-3 font-black">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={row.id || row.schedule_id || row.customer_code || `${title}-${index}`} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-[#0a649d]">{displayValue(row.customer_code)}</td>
                      <td className="max-w-[260px] whitespace-nowrap px-3 py-3 font-bold text-slate-800">{displayValue(row.customer_name || row.customer_name_snapshot)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.mobile_no || row.mobile_no_snapshot)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.city || row.city_snapshot)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.customer_status || row.service_type || row.schedule_status)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.due_date || row.service_date || row.scheduled_date || row.amc_warranty_due)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{displayValue(row.technician_1 || row.assigned_technician_name)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm">
          No records found.
        </div>
      )}
    </section>
  );
}

export async function getServerSideProps(context) {
  const user = await getUserFromRequest(context.req);

  if (!user) {
    return { redirect: { destination: "/Adminlogin", permanent: false } };
  }

  if (user.role === "customer") {
    return { redirect: { destination: "/Customerdashboard", permanent: false } };
  }

  if (user.role === "worker") {
    return { redirect: { destination: "/Techniciandashboard", permanent: false } };
  }

  if (user.role === "storekeeper") {
    return { redirect: { destination: "/Storedashboard", permanent: false } };
  }

  return { props: { user } };
}

export default function AdminReportsPage({ user }) {
  const router = useRouter();
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadReports() {
      setLoading(false);
      setError("");

      try {
        const data = await cachedGetJson("/api/admin/reports/summary", {
          cacheKey: "admin_reports_summary",
          ttlMs: 2 * 60 * 1000,
          user,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to load reports");
        }

        setReports(data.reports);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load reports");
        }
      } finally {
        setLoading(false);
      }
    }

    loadReports();
    return () => controller.abort();
  }, [user]);

  const queryText = searchInput.trim().toLowerCase();

  function filterRows(rows = []) {
    if (!queryText) return rows;
    return rows.filter((row) =>
      [
        row.customer_code,
        row.customer_name,
        row.customer_name_snapshot,
        row.mobile_no,
        row.mobile_no_snapshot,
        row.city,
        row.city_snapshot,
        row.address,
        row.customer_status,
        row.service_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(queryText))
    );
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
              Data quality and operations
            </p>
            <h1 className="truncate text-lg font-black tracking-tight">Admin Reports</h1>
            <p className="mt-1 text-xs font-semibold text-white/75">Logged in as {user?.name || "Admin"}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 sm:py-6">
        <section className="grid grid-cols-2 gap-2">
          {[
            ["View Customers", "/admin/customers"],
            ["View AMC", "/admin/amc"],
            ["View Service Visits", "/admin/service-visits"],
            ["View Upcoming Services", "/admin/upcoming-services"],
          ].map(([label, href]) => (
            <button
              type="button"
              key={href}
              onClick={() => router.push(href)}
              className="h-11 rounded-2xl bg-[#0a649d] px-3 text-xs font-black text-white shadow-sm active:scale-95"
            >
              {label}
            </button>
          ))}
        </section>

        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search report rows"
          className="amardip-search-field w-full"
        />

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-5">
            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">AMC / Warranty Expiry</h2>
              <MetricSkeletonGrid count={3} columns="grid-cols-3" />
              <DataListSkeleton columns={7} rows={4} minWidth="980px" />
            </section>
            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">Monthly Service Due</h2>
              <MetricSkeletonGrid count={4} />
              <DataListSkeleton columns={7} rows={4} minWidth="980px" />
            </section>
            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">Data Quality</h2>
              <MetricSkeletonGrid count={4} />
              <DataListSkeleton columns={7} rows={4} minWidth="980px" />
            </section>
          </div>
        )}

        {!loading && !error && !reports && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
            No report data found.
          </div>
        )}

        {reports && (
          <>
            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">AMC / Warranty Expiry</h2>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="This Month" value={reports.amcWarrantyExpiry.counts.due_this_month} tone="amber" />
                <MetricCard label="Next 30 Days" value={reports.amcWarrantyExpiry.counts.due_next_30_days} tone="blue" />
                <MetricCard label="Expired" value={reports.amcWarrantyExpiry.counts.expired} tone="red" />
              </div>
              <ReportList title="Due This Month" rows={filterRows(reports.amcWarrantyExpiry.dueThisMonth)} />
              <ReportList title="Expired AMC / Warranty" rows={filterRows(reports.amcWarrantyExpiry.expired)} />
            </section>

            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">Monthly Service Due</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label="To Schedule" value={reports.monthlyServiceDue.counts.to_be_scheduled} tone="amber" />
                <MetricCard label="Scheduled" value={reports.monthlyServiceDue.counts.scheduled} tone="green" />
                <MetricCard label="Missed" value={reports.monthlyServiceDue.counts.missed} tone="red" />
                <MetricCard label="Completed" value={reports.monthlyServiceDue.counts.completed_current_month} tone="blue" />
              </div>
              <ReportList title="To Be Scheduled Customers" rows={filterRows(reports.monthlyServiceDue.toBeScheduled)} />
              <ReportList title="Scheduled Services" rows={filterRows(reports.monthlyServiceDue.scheduled)} type="service" />
            </section>

            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">Customer Data Quality</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label="Missing Mobile" value={reports.customerDataQuality.counts.missing_mobile} tone="red" />
                <MetricCard label="Missing City" value={reports.customerDataQuality.counts.missing_city} tone="amber" />
                <MetricCard label="Missing Due" value={reports.customerDataQuality.counts.missing_amc_warranty_due} tone="amber" />
                <MetricCard label="No History" value={reports.customerDataQuality.counts.no_linked_service_history} tone="red" />
                <MetricCard label="Missing Status" value={reports.customerDataQuality.counts.missing_customer_status} tone="amber" />
                <MetricCard label="Duplicate Codes" value={reports.customerDataQuality.counts.duplicate_customer_code_groups} tone="red" />
                <MetricCard label="Blank Codes" value={reports.customerDataQuality.counts.blank_customer_code} tone="red" />
              </div>
              <ReportList title="Missing Mobile Number" rows={filterRows(reports.customerDataQuality.missingMobile)} />
              <ReportList title="Customers With No Linked Service History" rows={filterRows(reports.customerDataQuality.noLinkedServiceHistory)} />
            </section>

            <section className="space-y-3">
              <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">Service Data Quality</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label="Total Visits" value={reports.serviceDataQuality.counts.total_service_visits} tone="blue" />
                <MetricCard label="Linked" value={reports.serviceDataQuality.counts.linked_visits} tone="green" />
                <MetricCard label="Unlinked" value={reports.serviceDataQuality.counts.unlinked_visits} tone="amber" />
                <MetricCard label="Paid Count" value={reports.serviceDataQuality.counts.payment_collected_count} tone="green" />
                <MetricCard label="Missing Date" value={reports.serviceDataQuality.counts.missing_service_date} tone="red" />
                <MetricCard label="Missing Type" value={reports.serviceDataQuality.counts.missing_service_type} tone="red" />
                <MetricCard label="Missing Technician" value={reports.serviceDataQuality.counts.missing_technician_name} tone="amber" />
              </div>
              <ReportList title="Unlinked Service Visits" rows={filterRows(reports.serviceDataQuality.unlinkedVisits)} type="service" />
              <ReportList title="Service Visits Missing Technician" rows={filterRows(reports.serviceDataQuality.missingTechnicianName)} type="service" />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
