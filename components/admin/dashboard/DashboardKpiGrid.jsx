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

function ChevronRightIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function KpiCard({ title, value, icon, colorClass, onClick }) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-3xl bg-white border border-slate-200/60 p-4 shadow-sm flex flex-col justify-between h-28 select-none text-left w-full ${
        onClick ? "hover:shadow active:scale-98 transition cursor-pointer" : ""
      }`}
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight whitespace-pre-line">
          {title}
        </span>

        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>
      </div>

      <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
    </Component>
  );
}

export default function DashboardKpiGrid({
  kpiCounts,
  customerStats,
  setActiveTab,
  setMoreSubTab,
}) {
  const totalCustomers =
    customerStats?.totalCustomers ?? kpiCounts?.totalCustomers ?? 0;

  const activeAmc =
    customerStats?.activeAmc ?? kpiCounts?.activeAMC ?? 0;

  function openCustomersTable() {
    setActiveTab("more");
    setMoreSubTab?.("customers");
  }

  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
        Performance Indicators
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          title={"Total\nCustomers"}
          value={totalCustomers}
          icon={<CustomersIcon className="h-4.5 w-4.5" />}
          colorClass="bg-sky-50 text-[#0a649d]"
          onClick={openCustomersTable}
        />

        <KpiCard
          title={"Active\nAMCs"}
          value={activeAmc}
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          colorClass="bg-emerald-50 text-emerald-600"
        />

        <KpiCard
          title={"Today's\nServices"}
          value={kpiCounts?.todayService ?? 0}
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            </svg>
          }
          colorClass="bg-amber-50 text-amber-600"
          onClick={() => setActiveTab("service")}
        />

        <KpiCard
          title={"Open\nComplaints"}
          value={kpiCounts?.openComplaints ?? 0}
          icon={<AlertIcon className="h-4.5 w-4.5" />}
          colorClass="bg-red-50 text-red-600"
          onClick={() => setActiveTab("complaints")}
        />

        <KpiCard
          title={"Pending\nInstalls"}
          value={kpiCounts?.pendingInstallations ?? 0}
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" />
            </svg>
          }
          colorClass="bg-[#e6f9ff] text-[#0a649d]"
        />

        <KpiCard
          title={"Upcoming\nChecks"}
          value={kpiCounts?.upcomingMaintenance ?? 0}
          icon={
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          }
          colorClass="bg-[#f0f7fc] text-[#0a649d]"
        />

        <KpiCard
          title={"Technician\nStatus"}
          value={`${kpiCounts?.availTechnicians ?? 0} / ${kpiCounts?.totalTechnicians ?? 0}`}
          icon={<TechniciansIcon className="h-4.5 w-4.5" />}
          colorClass="bg-emerald-50 text-emerald-600"
          onClick={() => setActiveTab("technicians")}
        />

        <button
          type="button"
          onClick={() => {
            setActiveTab("more");
          }}
          className="rounded-3xl col-span-2 bg-[#0a649d]/5 border border-[#0a649d]/15 p-4 shadow-sm hover:bg-[#0a649d]/10 active:scale-98 transition flex items-center justify-between h-18 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#0a649d] text-white flex items-center justify-center shadow-sm shrink-0">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
            </div>

            <div className="text-left">
              <p className="text-xs font-bold text-slate-800">Manage Leads</p>
              <p className="text-[10px] text-slate-400 leading-tight">
                Track inquiries and new elevator requests
              </p>
            </div>
          </div>

          <ChevronRightIcon className="text-slate-400 h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
