export default function ModuleComingSoon({
  title = "Coming Soon",
  reason = "This module is ready to connect once the required data is uploaded.",
  icon = null,
  primaryText = "Waiting for client data",
  secondaryText = "This module is ready to connect once the required data is uploaded.",
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0a649d]/10 text-[#0a649d]">
          {icon || (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black leading-tight text-slate-900">
              {title}
            </h2>
            <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">
              Coming Soon
            </span>
          </div>

          <p className="mt-2 text-sm font-black text-[#0a649d]">
            {primaryText}
          </p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
            {reason || secondaryText}
          </p>

          <button
            type="button"
            disabled
            className="mt-4 h-10 rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-400"
          >
            Waiting for Data
          </button>
        </div>
      </div>
    </section>
  );
}
