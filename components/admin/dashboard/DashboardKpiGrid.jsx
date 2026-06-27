import { useRouter } from "next/router";
import { MetricSkeletonGrid } from "@/components/ui/SkeletonLoaders";
import { getQuotationDashboardCard } from "@/lib/quotationDashboard";

function CustomersIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </svg>
  );
}

function TechniciansIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21a8.5 8.5 0 0 1 13 0M16 11l2 2 4-4" />
    </svg>
  );
}

function AlertIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ReportsIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-4M5 5v14h14" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function KpiCard({ title, value, body, icon, accent, onClick, enabled = true }) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={enabled ? onClick : undefined}
      className={`rounded-[22px] bg-white p-4 flex flex-col justify-between select-none text-left w-full overflow-hidden relative ${
        onClick && enabled
          ? "active:scale-[0.96] transition-transform duration-100 cursor-pointer"
          : ""
      }`}
      style={{ boxShadow: "0 2px 12px rgba(15,23,42,0.07), 0 0 0 1px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-tight whitespace-pre-line pt-0.5">
          {title}
        </span>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <p
          className={`text-[28px] font-black leading-none tracking-tight ${
            enabled ? "text-slate-900" : "text-slate-300"
          }`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {enabled ? value : "—"}
        </p>
        {body && enabled && (
          <p className="mt-1.5 whitespace-pre-line text-[10px] font-medium leading-relaxed text-slate-400">
            {body}
          </p>
        )}
        {!enabled && (
          <p className="mt-1 text-[9px] font-semibold text-amber-500 uppercase tracking-wider">
            Awaiting data
          </p>
        )}
      </div>
    </Component>
  );
}

function QuotationBanner({ card, quotationStats, onClick, enabled = true }) {
  if (!card?.visible) return null;
  const total = quotationStats?.totalQuotations ?? 0;
  const generated = quotationStats?.generatedQuotations ?? 0;

  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      className={`mb-3 w-full overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0a649d] via-[#0875b4] to-[#06456e] p-4 text-left text-white shadow-[0_14px_30px_rgba(10,100,157,0.28)] ${
        enabled ? "active:scale-[0.98] transition-transform duration-100" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M9 13h6M9 17h4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black leading-tight">{card.title}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-white/78">{card.subtitle}</p>
            </div>
            <ChevronRightIcon className="mt-1 h-5 w-5 shrink-0 text-white/75" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.pills.map((pill) => (
              <span key={pill} className="rounded-full bg-white/14 px-2.5 py-1 text-[10px] font-black text-white ring-1 ring-white/20">
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-4">
            <span className="flex h-10 w-full items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-[#0a649d] shadow-sm">
              {card.buttonText}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function DashboardKpiGrid({
  kpiCounts,
  customerStats,
  serviceStats,
  statsLoading = false,
  setActiveTab,
  setMoreSubTab,
  moduleAvailability = {},
  user,
  quotationStats,
  hasBoqPermission = false,
}) {
  const router = useRouter();
  const totalCustomers = customerStats?.totalCustomers ?? kpiCounts?.totalCustomers ?? 0;
  const activeAmc = customerStats?.activeAmc ?? kpiCounts?.activeAMC ?? 0;
  const totalServiceVisits = serviceStats?.totalServiceVisits ?? 0;
  const scheduledUpcomingServices = serviceStats?.scheduledUpcomingServices ?? 0;
  const toBeScheduledServices = serviceStats?.toBeScheduledServices ?? 0;
  const upcomingServicesTotal =
    serviceStats?.upcomingServicesTotal ?? scheduledUpcomingServices + toBeScheduledServices;
  const isLive = (key) => moduleAvailability?.[key]?.enabled !== false;
  const quotationCard = getQuotationDashboardCard(user, hasBoqPermission);

  function openCustomersTable() { setMoreSubTab?.("customers"); }
  function openAmcTable() { setMoreSubTab?.("amc"); }
  function openServiceVisits() { setMoreSubTab?.("serviceVisits"); }
  function openUpcomingServices() { router.push("/admin/upcoming-services"); }
  function openReports() { router.push("/admin/reports"); }
  function openQuotations() { router.push("/admin/quotations"); }

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 px-0.5">
        Overview
      </p>

      <QuotationBanner
        card={quotationCard}
        quotationStats={quotationStats}
        onClick={openQuotations}
        enabled={isLive("quotations")}
      />

      {statsLoading ? (
        <MetricSkeletonGrid count={8} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard
            title={"Total\nCustomers"}
            value={totalCustomers}
            icon={<CustomersIcon className="h-4 w-4" />}
            accent="bg-sky-50 text-[#0a649d]"
            onClick={openCustomersTable}
            enabled={isLive("customers")}
          />

          <KpiCard
            title={"Active\nAMCs"}
            value={activeAmc}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            accent="bg-emerald-50 text-emerald-600"
            onClick={openAmcTable}
            enabled={isLive("amc")}
          />

          <KpiCard
            title={"Total\nServices"}
            value={totalServiceVisits}
            body="Completed history"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
              </svg>
            }
            accent="bg-amber-50 text-amber-600"
            onClick={openServiceVisits}
            enabled={isLive("serviceVisits")}
          />

          <KpiCard
            title={"Upcoming\nServices"}
            value={upcomingServicesTotal}
            body={`Scheduled: ${scheduledUpcomingServices}\nPending: ${toBeScheduledServices}`}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            }
            accent="bg-[#eaf4fb] text-[#0a649d]"
            onClick={openUpcomingServices}
            enabled={isLive("servicePlanner")}
          />

          <KpiCard
            title={"Open\nComplaints"}
            value={kpiCounts?.openComplaints ?? 0}
            icon={<AlertIcon className="h-4 w-4" />}
            accent="bg-red-50 text-red-500"
            onClick={() => setActiveTab("complaints")}
            enabled={isLive("complaints")}
          />

          <KpiCard
            title={"Pending\nInstalls"}
            value={kpiCounts?.pendingInstallations ?? 0}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" />
              </svg>
            }
            accent="bg-[#eaf4fb] text-[#0a649d]"
          />

          <KpiCard
            title={"Technician\nStatus"}
            value={`${kpiCounts?.availTechnicians ?? 0}/${kpiCounts?.totalTechnicians ?? 0}`}
            body="Available / Total"
            icon={<TechniciansIcon className="h-4 w-4" />}
            accent="bg-emerald-50 text-emerald-600"
            onClick={() => setActiveTab("technicians")}
            enabled={isLive("technicians")}
          />

          <KpiCard
            title={"Reports\nQuality"}
            value="View"
            body="AMC & service analytics"
            icon={<ReportsIcon className="h-4 w-4" />}
            accent="bg-violet-50 text-violet-600"
            onClick={openReports}
            enabled={isLive("reports")}
          />

        </div>
      )}
    </div>
  );
}
