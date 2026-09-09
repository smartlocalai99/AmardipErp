import { getUserFromRequest } from "@/lib/auth";
import { listQuotations } from "@/lib/quotations";
import { PROJECT_CHECKLIST_PHASES, PROJECT_CHECKLIST_ITEMS } from "@/lib/projectChecklist";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";

const typeOptions = {
  noOfFloors: ["G+1", "G+2", "G+3", "G+4", "G+5"],
  noOfPassenger: [6, 8, 10, 13, 18],
  doorType: ["MS FRAME COLLAPSIBLE GATE", "SS FRAME COLLAPSIBLE GATE", "MS SWING DOOR SMALL VISION", "SS SWING DOOR SMALL VISION", "MANUAL MS TELISCOPIC DOOR", "MANUAL SS TELISCOPIC DOOR", "MS CLAD AUTO DOOR", "SS CLAD AUTO DOOR", "SS HALF VISION GLASS AUTO DOOR", "SS FULL VISION GLASS AUTO DOOR", "MS HALF VISION GLASS AUTO DOOR", "MS FULL VISION GLASS AUTO DOOR"],
  cabinType: ["MS CABIN", "SS CABIN", "SS CABIN AUTO DOOR", "MS CABIN AUTO DOOR"],
  motorType: ["GEARED MOTOR", "GEAR LESS MOTOR"],
  headRoom: ["MACHINE ROOM", "MACHINE ROOM LESS"],
  doorOpening: ["600MM", "700MM", "800MM", "900MM", "1000MM", "1200MM"],
};

const fieldLabels = {
  serialNo: "S.NO",
  name: "Customer Name",
  address: "Address",
  mobileNo: "Mobile No",
  wellWidth: "Wall Width",
  wellDepth: "Wall Depth",
  noOfFloors: "No. of Floors",
  noOfPassenger: "No. of Passenger",
  doorType: "Door Type",
  cabinType: "Cabin Type",
  motorType: "Motor Type",
  headRoom: "Head Room",
  doorOpening: "Door Opening",
};

const placeholders = {
  name: "Enter customer name",
  address: "Enter full address",
  mobileNo: "10-digit mobile number",
  wellWidth: "e.g. 1500",
  wellDepth: "e.g. 1500",
  noOfFloors: "Select no. of floors",
  noOfPassenger: "Select passenger capacity",
  doorType: "Select door type",
  cabinType: "Select cabin type",
  motorType: "Select motor type",
  headRoom: "Select head room",
  doorOpening: "Select door opening size",
};

const requiredFields = [
  "name",
  "mobileNo",
  "wellWidth",
  "wellDepth",
  "noOfFloors",
  "noOfPassenger",
  "doorType",
  "cabinType",
  "motorType",
  "headRoom",
  "doorOpening",
];

const initialForm = {
  serialNo: "",
  name: "",
  address: "",
  mobileNo: "",
  wellWidth: "",
  wellDepth: "",
  noOfFloors: "",
  noOfPassenger: "",
  doorType: "",
  cabinType: "",
  motorType: "",
  headRoom: "",
  doorOpening: "",
};

const INCH_TO_MM = 25.4;
const initialDimensionUnits = { wellWidth: "mm", wellDepth: "mm" };

function Spinner({ className = "h-4 w-4 border-2" }) {
  return <span className={`inline-block shrink-0 rounded-full border-white/40 border-t-white animate-spin ${className}`} />;
}

function formatRupees(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-IN");
}

const DEFAULT_PAGE_SIZE = 25;

export async function getServerSideProps({ req }) {
  const user = await getUserFromRequest(req);
  if (!user) return { redirect: { destination: "/Adminlogin", permanent: false } };
  if (["customer", "worker", "storekeeper"].includes(user.role)) return { notFound: true };
  // Fetch the first page here so the list and the "+ Create" button (gated on
  // canGenerate) render correctly on the very first paint — no client-side
  // fetch-then-flip flash on every page load.
  let initialData = { quotations: [], total: 0, canGenerate: false };
  try {
    const result = await listQuotations({ actor: user, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    initialData = { quotations: result.rows, total: result.total, canGenerate: result.canGenerate };
  } catch {
    // Fall back to an empty list; the client effect will retry on mount.
  }
  // Quotation/project rows carry raw Date objects (createdAt, onboardedAt,
  // etc.) straight from pg — Next.js's props serializer rejects those, so
  // round-tripping through JSON here (which turns each Date into its ISO
  // string, same as what the client-side fetch API path already returns)
  // is required, not optional.
  return { props: { user, initialData: JSON.parse(JSON.stringify(initialData)) } };
}

export default function QuotationsPage({ user, initialData }) {
  const router = useRouter();
  const [quotations, setQuotations] = useState(initialData.quotations);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialData.total);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef(null);
  const [canGenerate, setCanGenerate] = useState(initialData.canGenerate);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [dimensionUnits, setDimensionUnits] = useState(initialDimensionUnits);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState("");
  // quotationView holds the full quotation object to show in the View Quotation full-screen card
  const [quotationView, setQuotationView] = useState(null);
  const [boqView, setBoqView] = useState(null);
  const [activeTab, setActiveTab] = useState(router.query.tab === "projects" ? "projects" : "quotations");
  const [projects, setProjects] = useState([]);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectQuotation, setProjectQuotation] = useState(null);
  const [startProjectTarget, setStartProjectTarget] = useState(null);
  const [checklistProject, setChecklistProject] = useState(null);
  const projectsCacheRef = useRef(new Map());
  const projectsRequestRef = useRef(null);
  const projectsAbortRef = useRef(null);
  const fieldRefs = useRef({});
  // Guards against double-tap double-submits: React state updates (and the
  // `disabled` attribute they drive) land on the next render, which is too
  // slow to block a fast double-tap on mobile. A ref flips synchronously.
  const createInFlightRef = useRef(false);
  const priceRefreshInFlightRef = useRef(new Set());
  // Fast typing/paging can fire several requests at once; a slower older one
  // can resolve after a newer one and overwrite the list with stale data.
  // This counter makes only the most recently *sent* request allowed to win.
  const requestIdRef = useRef(0);
  const isFirstRunRef = useRef(true);

  async function fetchPage(pageNum, { append = false } = {}) {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(DEFAULT_PAGE_SIZE) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // a newer request already landed
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load quotations");
      setQuotations((prev) => (append ? [...prev, ...(data.quotations || [])] : (data.quotations || [])));
      setTotal(data.total || 0);
      setCanGenerate(Boolean(data.canGenerate));
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }

  async function fetchProjects() {
    const cacheKey = search.trim().toLowerCase();
    const cached = projectsCacheRef.current.get(cacheKey);
    if (cached) {
      projectsAbortRef.current?.abort();
      projectsRequestRef.current = null;
      setProjects(cached.projects);
      setProjectsTotal(cached.total);
      setProjectsLoading(false);
      return;
    }
    if (projectsRequestRef.current === cacheKey) return;
    projectsRequestRef.current = cacheKey;
    projectsAbortRef.current?.abort();
    const controller = new AbortController();
    projectsAbortRef.current = controller;
    setProjectsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", pageSize: String(DEFAULT_PAGE_SIZE) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/quotations/projects?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load ongoing projects");
      const nextProjects = data.projects || [];
      const nextTotal = data.total || 0;
      projectsCacheRef.current.set(cacheKey, { projects: nextProjects, total: nextTotal });
      setProjects(nextProjects);
      setProjectsTotal(nextTotal);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      const isCurrentRequest = projectsRequestRef.current === cacheKey && projectsAbortRef.current === controller;
      if (isCurrentRequest) {
        projectsRequestRef.current = null;
        projectsAbortRef.current = null;
        setProjectsLoading(false);
      }
    }
  }

  // Used by callers that need an immediate, first-page refresh (after
  // creating or updating a quotation) rather than waiting on the debounced
  // page-driven effect below.
  async function load() {
    if (page !== 1) {
      setPage(1);
    } else {
      await fetchPage(1, { append: false });
    }
  }

  useEffect(() => {
    // The server already fetched page 1 with no search filter — skip the
    // redundant duplicate request on first mount.
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    const timer = setTimeout(() => fetchPage(page, { append: page > 1 }), 250);
    return () => clearTimeout(timer);
  }, [search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== "projects") return undefined;
    const timer = setTimeout(() => fetchProjects(), 250);
    return () => clearTimeout(timer);
  }, [activeTab, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loads the next 25 once the sentinel at the bottom of the list scrolls
  // into view — replaces a page-size dropdown + Previous/Next buttons.
  useEffect(() => {
    const hasMore = quotations.length < total;
    if (!hasMore || loading || loadingMore) return;
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
  }, [quotations.length, total, loading, loadingMore]);

  // Auto-set serial number when creating form opens — uses the real total
  // count, not the current page's length, since the list is now paginated.
  useEffect(() => {
    if (!showCreate) return undefined;
    const timer = setTimeout(() => setForm((prev) => ({ ...prev, serialNo: String(total + 1) })), 0);
    return () => clearTimeout(timer);
  }, [showCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: "" }));
  }

  function registerField(key, node) {
    fieldRefs.current[key] = node;
  }

  function validateForm() {
    const nextErrors = {};
    requiredFields.forEach((key) => {
      if (!String(form[key] ?? "").trim()) nextErrors[key] = `${fieldLabels[key]} is required.`;
    });
    const digits = String(form.mobileNo || "").replace(/\D/g, "");
    if (form.mobileNo && digits.length !== 10) nextErrors.mobileNo = "Enter a valid 10-digit mobile number.";
    setFormErrors(nextErrors);
    const firstInvalid = requiredFields.find((key) => nextErrors[key]) || "mobileNo";
    if (Object.keys(nextErrors).length > 0) {
      fieldRefs.current[firstInvalid]?.scrollIntoView({ behavior: "smooth", block: "center" });
      fieldRefs.current[firstInvalid]?.focus?.();
      return false;
    }
    return true;
  }

  async function createQuotation() {
    if (createInFlightRef.current) return; // blocks a fast mobile double-tap
    setError("");
    if (!validateForm()) return;
    createInFlightRef.current = true;
    setSubmitting("generate");
    try {
      const payload = {
        ...form,
        wellWidth: dimensionUnits.wellWidth === "inches" ? Number(form.wellWidth) * INCH_TO_MM : form.wellWidth,
        wellDepth: dimensionUnits.wellDepth === "inches" ? Number(form.wellDepth) * INCH_TO_MM : form.wellDepth,
      };
      const createRes = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) throw new Error(createData.message || "Failed to create quotation");

      // Price comes from the client's real "boq automation" Google Sheet — we
      // post the spec, the sheet's formulas calculate it, we read it back.
      // This is the customer-facing price quotation, not the (separate,
      // not-yet-built) detailed Bill of Quantities.
      setSubmitting("pricing");
      const priceRes = await fetch(`/api/quotations/${createData.quotation.id}/generate-boq`, {
        method: "POST",
      });
      const priceData = await priceRes.json();
      if (!priceRes.ok || !priceData.success) throw new Error(priceData.message || "Failed to get price from sheet");

      setForm(initialForm);
      setFormErrors({});
      setDimensionUnits(initialDimensionUnits);
      setShowCreate(false);
      setQuotationView(priceData.quotation);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting("");
      createInFlightRef.current = false;
    }
  }

  async function refreshPriceFromSheet(id) {
    if (priceRefreshInFlightRef.current.has(id)) return; // blocks a fast mobile double-tap
    priceRefreshInFlightRef.current.add(id);
    setError("");
    setSubmitting(`price-${id}`);
    try {
      const res = await fetch(`/api/quotations/${id}/generate-boq`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to get price from sheet");
      setQuotationView(data.quotation);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting("");
      priceRefreshInFlightRef.current.delete(id);
    }
  }

  // Open BOQ is its own simple screen — just the quotation number and the
  // full sheet row for that one quotation, nothing else.
  if (boqView) {
    return <BoqOnlyView quotation={boqView} onBack={() => setBoqView(null)} />;
  }

  // Full-screen view of the customer-facing quotation document.
  if (quotationView) {
    return (
      <QuotationViewCard
        quotation={quotationView}
        onBack={() => setQuotationView(null)}
        onOpenBoq={() => setBoqView(quotationView)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2f7] text-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a649d] px-4 pt-safe-top">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link href="/Admindashboard" className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center active:bg-white/25 transition">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Amardip Lifts ERP</p>
              <h1 className="text-base font-black text-white leading-tight">Quotations & BOQ</h1>
            </div>
          </div>
          {canGenerate && (
            <button
              onClick={() => setShowCreate(true)}
              className="h-9 px-4 rounded-xl bg-white text-[#0a649d] text-xs font-black active:scale-95 transition shadow-sm"
            >
              + Create
            </button>
          )}
        </div>
      </div>

      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Search & filters */}
        <input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by name, mobile, quotation no…"
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#0a649d] transition"
        />
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-200 p-1">
          {[{ key: "quotations", label: "Quotations" }, { key: "projects", label: "Ongoing Projects" }].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                router.replace({ pathname: router.pathname, query: tab.key === "projects" ? { tab: "projects" } : {} }, undefined, { shallow: true });
              }}
              className={`h-10 rounded-xl text-xs font-black transition ${activeTab === tab.key ? "bg-white text-[#0a649d] shadow-sm" : "text-slate-500"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {user.role === "superadmin" && (
          <Link className="flex h-10 items-center justify-center rounded-2xl border border-[#0a649d]/20 bg-white text-xs font-black text-[#0a649d]" href="/admin/boq-permissions">
            Manage BOQ Permissions
          </Link>
        )}

        {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        {activeTab === "projects" ? (
          projectsLoading ? (
            <p className="rounded-3xl bg-white p-8 text-center text-xs font-bold text-slate-400">Loading ongoing projects…</p>
          ) : projects.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
              <p className="text-base font-black text-slate-900">No ongoing projects</p>
              <p className="mt-1 text-xs font-bold text-slate-400">Projects onboarded from accepted quotations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onStartProject={setStartProjectTarget}
                  onOpenChecklist={setChecklistProject}
                />
              ))}
            </div>
          )
        ) : loading ? (
          <p className="rounded-3xl bg-white p-8 text-center text-xs font-bold text-slate-400">Loading quotations…</p>
        ) : quotations.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-base font-black text-slate-900">No quotations yet</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Create your first lift quotation and share the price with your customer.</p>
            {canGenerate && (
              <button onClick={() => setShowCreate(true)} className="mt-4 h-10 rounded-2xl bg-[#0a649d] px-5 text-xs font-black text-white">
                Create Quotation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {quotations.map((q, i) => (
              <QuotationCard
                key={q.id}
                quotation={q}
                index={i}
                canGenerate={canGenerate}
                busy={submitting === `price-${q.id}`}
                onRefreshPrice={() => refreshPriceFromSheet(q.id)}
                onViewQuotation={() => setQuotationView(q)}
                onOnboardProject={() => setProjectQuotation(q)}
                onOpenBoq={() => setBoqView(q)}
              />
            ))}
          </div>
        )}

        {activeTab === "projects" && !projectsLoading && projectsTotal > 0 && (
          <p className="text-center text-xs font-bold text-slate-500">Showing {projects.length} of {projectsTotal} ongoing projects</p>
        )}

        {!loading && total > 0 && (
          <>
            <p className="text-center text-xs font-bold text-slate-500">
              Loaded {quotations.length} of {total} quotations
            </p>
            <div ref={sentinelRef} className="flex items-center justify-center py-2">
              {loadingMore ? (
                <span className="text-xs font-bold text-slate-400">Loading more…</span>
              ) : quotations.length >= total ? (
                <span className="text-xs font-bold text-slate-300">You&apos;ve reached the end</span>
              ) : null}
            </div>
          </>
        )}
      </main>

      {/* Create Quotation Modal */}
      {showCreate && (
        <Modal title="Create Lift Quotation" onClose={() => !submitting && setShowCreate(false)}>
          <div className="pb-24 space-y-1">
            <QuotationSection title="Customer Details">
              {/* Serial no is auto-filled; show as read-only */}
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400 w-16 shrink-0">S.No</span>
                <span className="text-sm font-black text-slate-700">{form.serialNo}</span>
              </div>
              <TextField fieldKey="name" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
              <TextField fieldKey="address" form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
              <TextField fieldKey="mobileNo" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} inputMode="tel" />
            </QuotationSection>
            <QuotationSection title="Wall Details">
              <DimensionField
                fieldKey="wellWidth"
                form={form}
                errors={formErrors}
                registerField={registerField}
                onChange={updateForm}
                unit={dimensionUnits.wellWidth}
                onUnitChange={(unit) => setDimensionUnits((current) => ({ ...current, wellWidth: unit }))}
              />
              <DimensionField
                fieldKey="wellDepth"
                form={form}
                errors={formErrors}
                registerField={registerField}
                onChange={updateForm}
                unit={dimensionUnits.wellDepth}
                onUnitChange={(unit) => setDimensionUnits((current) => ({ ...current, wellDepth: unit }))}
              />
              <SelectField fieldKey="noOfFloors" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.noOfFloors} />
              <SelectField fieldKey="noOfPassenger" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.noOfPassenger} />
            </QuotationSection>
            <QuotationSection title="Lift Specification">
              <SelectField fieldKey="doorType" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.doorType} />
              <SelectField fieldKey="cabinType" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.cabinType} />
              <SelectField fieldKey="motorType" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.motorType} />
              <SelectField fieldKey="headRoom" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.headRoom} />
              <SelectField fieldKey="doorOpening" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} options={typeOptions.doorOpening} />
            </QuotationSection>
          </div>
          <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-slate-100 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
            {error && <p className="mb-3 rounded-xl border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-700">{error}</p>}
            {submitting === "pricing" && (
              <p className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50 p-2.5 text-xs font-bold text-sky-700">
                <Spinner className="h-3.5 w-3.5 border-sky-200 border-t-sky-600" />
                Waiting for the sheet to calculate the price — this can take up to 10 seconds.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={Boolean(submitting)}
                onClick={() => setShowCreate(false)}
                className="h-12 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50 active:scale-98 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(submitting)}
                onClick={createQuotation}
                className="h-12 rounded-2xl bg-[#0a649d] text-sm font-black text-white disabled:opacity-50 active:scale-98 transition shadow-md flex items-center justify-center gap-2"
                style={{ background: submitting ? "#6b7280" : "linear-gradient(135deg, #073354, #0a649d)" }}
              >
                {Boolean(submitting) && <Spinner />}
                {submitting === "generate" ? "Creating…" : submitting === "pricing" ? "Getting Price…" : "Create Quotation"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {projectQuotation && (
        <ProjectOnboardingModal
          quotation={projectQuotation}
          onClose={() => setProjectQuotation(null)}
          onSuccess={() => {
            setProjectQuotation(null);
            setActiveTab("projects");
            projectsCacheRef.current.clear();
            load();
            fetchProjects();
          }}
        />
      )}

      {startProjectTarget && (
        <StartProjectModal
          project={startProjectTarget}
          onClose={() => setStartProjectTarget(null)}
          onSuccess={() => {
            setStartProjectTarget(null);
            projectsCacheRef.current.clear();
            fetchProjects();
          }}
        />
      )}

      {checklistProject && (
        <ProjectChecklistModal
          project={checklistProject}
          onClose={() => {
            setChecklistProject(null);
            projectsCacheRef.current.clear();
            fetchProjects();
          }}
          onUpdated={(updatedProject) => {
            setProjects((current) => current.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
          }}
        />
      )}

    </div>
  );
}

// ─── Open BOQ ────────────────────────────────────────────────────────────────
// Deliberately minimal: the quotation number on top, and nothing below it but
// that one quotation's full sheet row (every calculated cost column). No
// price document, no PDF, no onboarding — just the BOQ.
function BoqOnlyView({ quotation, onBack }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/quotations/${quotation.id}/boq-row`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Failed to open BOQ");
        if (!cancelled) setRows(data.rows);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to open BOQ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [quotation.id]);

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="sticky top-0 z-20 bg-[#0a649d] px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={onBack}
            className="h-9 w-9 shrink-0 rounded-xl bg-white/15 flex items-center justify-center active:bg-white/25 transition"
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Full BOQ</p>
            <h1 className="truncate text-lg font-black text-white">{quotation.quotationNo}</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl p-4">
        {loading && (
          <p className="rounded-3xl bg-white p-8 text-center text-xs font-bold text-slate-400">Loading BOQ…</p>
        )}
        {error && (
          <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>
        )}
        {rows && (
          <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {rows.map(({ heading, value }) => (
              <div key={heading} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-bold text-slate-500">{heading}</span>
                <span className="max-w-[55%] text-right font-black text-slate-900">{value || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Full-screen View Quotation Card ────────────────────────────────────────
// This is the customer-facing price quotation. "Open BOQ" is its own simple
// screen (see BoqOnlyView) with the full underlying sheet row.
// The quotation document remains available for review; project onboarding is
// handled from the quotation list so financial inputs stay explicit.
function QuotationViewCard({ quotation, onBack }) {

  const specs = [
    ["Wall Width", quotation.wellWidth],
    ["Wall Depth", quotation.wellDepth],
    ["Floors", quotation.noOfFloors],
    ["Passenger", quotation.noOfPassenger],
    ["Door Type", quotation.doorType],
    ["Cabin Type", quotation.cabinType],
    ["Motor Type", quotation.motorType],
    ["Head Room", quotation.headRoom],
    ["Door Opening", quotation.doorOpening],
  ];

  return (
    <div className="min-h-screen bg-[#eef2f7] flex flex-col print:bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a649d] px-4 pt-safe-top print:hidden">
        <div className="flex items-center justify-between py-4">
          <button
            onClick={onBack}
            className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center active:bg-white/25 transition"
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Quotation</p>
            <p className="text-sm font-black text-white">{quotation.quotationNo}</p>
          </div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(15,23,42,0.10)" }}>
          {/* Company header */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100" style={{ background: "linear-gradient(135deg, #04182b 0%, #073354 60%, #0a649d 100%)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-white border-2 border-white/30 shadow-lg shrink-0">
                <Image src="/adlogo.png" alt="Amardip" fill className="object-contain p-1" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-black text-white leading-tight">Amardip Lifts</h1>
                <p className="text-[10px] text-white/60 font-bold mt-0.5">Amardip Elevators</p>
                <p className="text-[9px] text-white/40 mt-1 font-semibold tracking-wide">PRICE QUOTATION</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-bold text-white/50 uppercase">Date</p>
                <p className="text-[11px] font-black text-white">{new Date(quotation.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
            </div>
          </div>

          {/* Quotation meta */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Quotation No</p>
                <p className="text-sm font-black text-[#0a649d] mt-0.5">{quotation.quotationNo}</p>
              </div>
              {quotation.serialNo && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">S.No</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{quotation.serialNo}</p>
                </div>
              )}
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Customer</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{quotation.customerName}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Mobile</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{quotation.mobileNo}</p>
              </div>
              {quotation.address && (
                <div className="col-span-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Address</p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{quotation.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Lift Specifications */}
          <div className="px-6 py-5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#0a649d] mb-3">Lift Specification</h2>
            <div className="space-y-0 divide-y divide-slate-50">
              {specs.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <span className="text-[11px] font-bold text-slate-500">{label}</span>
                  <span className="text-[12px] font-black text-slate-900 text-right max-w-[55%]">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="mx-6 mb-5 rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #04182b, #073354)" }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Total Quoted Price</p>
            <p className="text-3xl font-black text-white">
              ₹{formatRupees(quotation.finalPrice ?? quotation.customerPrice)}
            </p>
            <p className="text-[9px] font-bold text-white/40 mt-1">Inclusive of taxes and installation</p>
          </div>

          {/* Terms */}
          <div className="px-6 pb-5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Terms & Conditions</h2>
            <ul className="space-y-1.5 text-[11px] text-slate-500 font-medium">
              <li>• Payment as per agreed schedule with Amardip Lifts.</li>
              <li>• Price valid for 30 days from quotation date.</li>
              <li>• Installation subject to site readiness.</li>
              <li>• AMC terms applicable post warranty period.</li>
            </ul>
          </div>

          {/* Signature */}
          <div className="px-6 pb-6 border-t border-slate-100 pt-4 flex items-end justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">For Amardip Lifts</p>
              <p className="text-[10px] font-black text-slate-700 mt-4">Authorized Signatory</p>
            </div>
            <div className="h-14 w-14 relative opacity-70">
              <Image src="/adlogo.png" alt="Amardip" fill className="object-contain" sizes="56px" />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

// ─── Quotation List Card ──────────────────────────────────────────────────────
function QuotationCard({ quotation, index, canGenerate, busy, onRefreshPrice, onViewQuotation, onOnboardProject, onOpenBoq }) {
  const shareEnabled = quotation.status !== "DRAFT";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg">#{index + 1}</span>
            <p className="text-sm font-black text-slate-900">{quotation.quotationNo}</p>
          </div>
          <p className="text-xs font-bold text-slate-700 mt-0.5">{quotation.customerName}</p>
          <p className="text-[10px] text-slate-400">{quotation.mobileNo}</p>
        </div>
        <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 shrink-0">{quotation.status}</span>
      </div>
      {(quotation.createdByUsername || quotation.convertedByUsername) && (
        <p className="mt-1 text-[9.5px] font-semibold text-slate-400">
          {quotation.createdByUsername && `Created by @${quotation.createdByUsername}`}
          {quotation.createdByUsername && quotation.convertedByUsername && " · "}
          {quotation.convertedByUsername && `Converted by @${quotation.convertedByUsername}`}
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-500">
        <p>Width: <span className="text-slate-800">{quotation.wellWidth}</span></p>
        <p>Depth: <span className="text-slate-800">{quotation.wellDepth}</span></p>
        <p>Floors: <span className="text-slate-800">{quotation.noOfFloors}</span></p>
        <p>Passenger: <span className="text-slate-800">{quotation.noOfPassenger}</span></p>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 truncate">{quotation.doorType} · {quotation.cabinType}</p>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-sm font-black text-slate-900">{quotation.finalPrice ? `₹${formatRupees(quotation.finalPrice)}` : "—"}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {canGenerate && quotation.status === "DRAFT" && (
            <button
              onClick={onRefreshPrice}
              disabled={busy}
              className="col-span-2 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-[#0a649d] text-xs font-bold text-white active:scale-95 transition disabled:opacity-70"
            >
              {busy && <Spinner className="h-3 w-3 border-white/40 border-t-white" />}
              {busy ? "Getting Price…" : "Get Price From Sheet"}
            </button>
          )}
          {shareEnabled && (
            <button
              onClick={onViewQuotation}
              className="h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 active:scale-95 transition"
            >
              View Quotation
            </button>
          )}
          {canGenerate && shareEnabled && (
            <button
              onClick={onOpenBoq}
              className="h-10 rounded-xl bg-[#0a649d] text-[11px] font-black text-white active:scale-95 transition shadow-sm"
            >
              Open BOQ
            </button>
          )}
          {canGenerate && shareEnabled && quotation.status !== "CONVERTED_TO_PROJECT" && (
            <button
              onClick={onOnboardProject}
              className="col-span-2 h-10 rounded-xl bg-emerald-600 text-[11px] font-black text-white active:scale-95 transition shadow-sm"
            >
              Onboard Customer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onStartProject, onOpenChecklist }) {
  const canStart = project.source !== "google_sheet";
  const crewNames = (project.assignees || []).map((a) => a.name).join(" & ");
  const completedCount = (project.checklistCompletions || []).length;
  const totalSteps = PROJECT_CHECKLIST_ITEMS.length;
  const percent = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isComplete = completedCount >= totalSteps;
  const isStarted = canStart && Boolean(project.startedAt);

  return (
    <div
      onClick={isStarted ? () => onOpenChecklist(project) : undefined}
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${isStarted ? "cursor-pointer transition hover:border-slate-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{project.customerName}</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-500">{project.city || "City not listed"} · {project.mobileNo || "Number not listed"}</p>
        </div>
        <span className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black whitespace-nowrap ${isStarted ? (isComplete ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-[#0a649d]") : "bg-emerald-50 text-emerald-700"}`}>
          {isStarted ? (isComplete ? "COMPLETE" : `IN PROGRESS · ${percent}%`) : "ONGOING"}
        </span>
      </div>

      {isStarted && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-[#0a649d]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11px]">
        <div><p className="font-bold text-slate-400">Agreed</p><p className="mt-0.5 font-black text-slate-900">₹{formatRupees(project.agreedAmount)}</p></div>
        <div><p className="font-bold text-slate-400">Advance</p><p className="mt-0.5 font-black text-slate-900">₹{formatRupees(project.advanceAmount)}</p></div>
        <div><p className="font-bold text-slate-400">Balance</p><p className="mt-0.5 font-black text-emerald-700">₹{formatRupees(project.balanceAmount)}</p></div>
      </div>
      <p className="mt-3 text-[10px] font-bold text-slate-400">Onboarded {project.onboardedAt ? new Date(project.onboardedAt).toLocaleDateString("en-IN") : "—"}</p>

      {isStarted && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-sky-50/60 border border-sky-100 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-[#0a649d]">Crew: {crewNames || "—"}</p>
            <p className="mt-0.5 text-[9.5px] font-bold text-slate-400">Started {new Date(project.startedAt).toLocaleDateString("en-IN")}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartProject(project); }}
            className="shrink-0 text-[10px] font-black text-[#0a649d] underline underline-offset-2"
          >
            Update crew
          </button>
        </div>
      )}

      {canStart && !project.startedAt && (
        <button
          type="button"
          onClick={() => onStartProject(project)}
          className="mt-3 h-11 w-full rounded-2xl bg-[#0a649d] text-xs font-black text-white active:scale-[0.98] transition"
        >
          Start Project
        </button>
      )}
    </div>
  );
}

function StartProjectModal({ project, onClose, onSuccess }) {
  const [technicians, setTechnicians] = useState([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => (project.assignees || []).map((a) => String(a.id)));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isReassign = Boolean(project.startedAt);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (active && data.success) {
          setTechnicians((data.users || []).filter((u) => u.role === "worker"));
        }
      } catch {
        // Leave the list empty — the error below still lets them retry.
      } finally {
        if (active) setLoadingTechnicians(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function toggle(id) {
    const key = String(id);
    setSelectedIds((current) => (current.includes(key) ? current.filter((v) => v !== key) : [...current, key]));
  }

  async function submit() {
    if (selectedIds.length === 0) return setError("Pick at least one technician.");
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/quotations/projects/${project.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianUserIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to start project");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isReassign ? "Update Crew" : "Start Project"} onClose={() => !submitting && onClose()}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-sm font-black text-slate-900">{project.customerName}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{project.quotationNo}</p>
        </div>

        <div>
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
            Assign Technicians *
          </span>
          {loadingTechnicians ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs font-bold text-slate-400">Loading technicians…</p>
          ) : technicians.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs font-bold text-slate-400">No technicians found.</p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 p-1.5">
              {technicians.map((tech) => {
                const checked = selectedIds.includes(String(tech.id));
                return (
                  <label
                    key={tech.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${checked ? "bg-sky-50" : "hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(tech.id)}
                      className="h-4 w-4 accent-[#0a649d]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-800">{tech.name}</span>
                      {tech.phone && <span className="block text-[10px] font-semibold text-slate-400">{tech.phone}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="h-12 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={submitting} className="h-12 rounded-2xl bg-[#0a649d] text-sm font-black text-white disabled:opacity-50">
            {submitting ? "Saving…" : isReassign ? "Update Crew" : "Start Project"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectChecklistModal({ project, onClose, onUpdated }) {
  const [completions, setCompletions] = useState(project.checklistCompletions || []);
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");

  const completedKeys = new Set(completions.map((c) => c.itemKey));
  const completedCount = completedKeys.size;
  const totalSteps = PROJECT_CHECKLIST_ITEMS.length;
  const percent = totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0;
  const nextItemKey = PROJECT_CHECKLIST_ITEMS.find((item) => !completedKeys.has(item)) || null;
  const isComplete = completedCount >= totalSteps;

  async function toggle(itemKey, nextCompleted) {
    setPendingKey(itemKey);
    setError("");
    // Optimistic — a 52-item list feels sluggish if every tap waits on a
    // round trip before showing the check.
    setCompletions((current) =>
      nextCompleted
        ? [...current, { itemKey, completedAt: new Date().toISOString(), completedByUsername: null }]
        : current.filter((c) => c.itemKey !== itemKey)
    );
    try {
      const res = await fetch(`/api/quotations/projects/${project.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey, completed: nextCompleted }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update step");
      setCompletions(data.project.checklistCompletions || []);
      onUpdated(data.project);
    } catch (err) {
      // Roll back the optimistic change on failure.
      setCompletions((current) =>
        nextCompleted ? current.filter((c) => c.itemKey !== itemKey) : [...current, { itemKey }]
      );
      setError(err.message);
    } finally {
      setPendingKey("");
    }
  }

  return (
    <Modal title="Installation Checklist" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-sm font-black text-slate-900">{project.customerName}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{project.quotationNo}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className={`text-[11px] font-black ${isComplete ? "text-emerald-700" : "text-[#0a649d]"}`}>
              {isComplete ? "All steps complete" : `${completedCount}/${totalSteps} steps done`}
            </span>
            <span className="text-[11px] font-black text-slate-500">{percent}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-[#0a649d]"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        {PROJECT_CHECKLIST_PHASES.map((phase) => {
          const phaseDone = phase.items.filter((item) => completedKeys.has(item)).length;
          return (
            <div key={phase.phase}>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{phase.phase}</h3>
                <span className="text-[10px] font-black text-slate-400">{phaseDone}/{phase.items.length}</span>
              </div>
              <div className="space-y-1">
                {phase.items.map((item) => {
                  const checked = completedKeys.has(item);
                  const isNext = item === nextItemKey;
                  return (
                    <label
                      key={item}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                        checked
                          ? "border-emerald-100 bg-emerald-50/60"
                          : isNext
                          ? "border-[#0a649d] bg-sky-50/60"
                          : "border-slate-100 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={pendingKey === item}
                        onChange={() => toggle(item, !checked)}
                        className="mt-0.5 h-4 w-4 accent-[#0a649d] disabled:opacity-50"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs font-bold ${checked ? "text-emerald-800" : "text-slate-700"}`}>
                          {item}
                        </span>
                      </span>
                      {isNext && !checked && (
                        <span className="shrink-0 rounded-lg bg-[#0a649d] px-2 py-0.5 text-[9px] font-black uppercase text-white">
                          Next
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function ProjectOnboardingModal({ quotation, onClose, onSuccess }) {
  const [agreedAmount, setAgreedAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const agreed = Number(agreedAmount);
    const advance = Number(advanceAmount);
    if (!agreedAmount || !Number.isFinite(agreed) || agreed <= 0) return setError("Enter the agreed amount.");
    if (!advanceAmount || !Number.isFinite(advance) || advance < 0) return setError("Enter the advance amount.");
    if (advance > agreed) return setError("Advance cannot be greater than agreed amount.");
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/onboard-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreedAmount: agreed, advanceAmount: advance }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to onboard project");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Onboard Customer" onClose={() => !submitting && onClose()}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-sm font-black text-slate-900">{quotation.customerName}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{quotation.quotationNo}</p>
        </div>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">Agreed Amount *</span><input type="number" min="0" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value)} placeholder="Enter agreed amount" className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#0a649d]" /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">Advance *</span><input type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="Enter advance amount" className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#0a649d]" /></label>
        {error && <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="h-12 rounded-2xl border-2 border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={submitting} className="h-12 rounded-2xl bg-emerald-600 text-sm font-black text-white disabled:opacity-50">{submitting ? "Onboarding…" : "Onboard Customer"}</button>
        </div>
      </div>
    </Modal>
  );
}

function QuotationSection({ title, children }) {
  return (
    <section className="mb-5 space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#0a649d] pt-2">{title}</h3>
      {children}
    </section>
  );
}

function TextField({ fieldKey, required = false, helper = "", inputMode, form, errors, registerField, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {fieldLabels[fieldKey]} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        ref={(node) => registerField(fieldKey, node)}
        value={form[fieldKey]}
        inputMode={inputMode}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={placeholders[fieldKey] || `Enter ${fieldLabels[fieldKey]}`}
        className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.08)] transition ${errors[fieldKey] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
      />
      {helper && <span className="mt-1 block text-[10px] font-semibold text-slate-400">{helper}</span>}
      {errors[fieldKey] && <span className="mt-1 block text-[10px] font-bold text-red-600">{errors[fieldKey]}</span>}
    </label>
  );
}

// Numeric-keypad dimension input (Wall Width / Wall Depth) with an mm/inches
// unit toggle — defaults to mm, matching the sheet's existing data.
function DimensionField({ fieldKey, form, errors, registerField, onChange, unit, onUnitChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {fieldLabels[fieldKey]} <span className="text-red-500">*</span>
      </span>
      <div className="flex gap-2">
        <input
          ref={(node) => registerField(fieldKey, node)}
          value={form[fieldKey]}
          type="text"
          inputMode="decimal"
          onChange={(e) => {
            const value = e.target.value;
            if (/^\d*\.?\d*$/.test(value)) onChange(fieldKey, value);
          }}
          placeholder={placeholders[fieldKey]}
          className={`h-12 min-w-0 flex-1 rounded-2xl border px-4 text-sm outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.08)] transition ${errors[fieldKey] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
        />
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          className="h-12 w-24 shrink-0 rounded-2xl border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 outline-none focus:border-[#0a649d] transition"
        >
          <option value="mm">mm</option>
          <option value="inches">inches</option>
        </select>
      </div>
      {errors[fieldKey] && <span className="mt-1 block text-[10px] font-bold text-red-600">{errors[fieldKey]}</span>}
    </label>
  );
}

function SelectField({ fieldKey, required = false, form, errors, registerField, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {fieldLabels[fieldKey]} {required && <span className="text-red-500">*</span>}
      </span>
      <select
        ref={(node) => registerField(fieldKey, node)}
        value={form[fieldKey]}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className={`h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:border-[#0a649d] focus:shadow-[0_0_0_3px_rgba(10,100,157,0.08)] transition appearance-none ${errors[fieldKey] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"} ${form[fieldKey] ? "text-slate-900" : "text-slate-400"}`}
      >
        <option value="">{placeholders[fieldKey]}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {errors[fieldKey] && <span className="mt-1 block text-[10px] font-bold text-red-600">{errors[fieldKey]}</span>}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 font-black text-base flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

