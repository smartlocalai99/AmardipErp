import { getUserFromRequest } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ModuleComingSoon from "@/components/ui/ModuleComingSoon";
import { WhatsAppIcon } from "@/components/ui/WhatsAppButton";

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
  wellWidth: "e.g. 5 ft or 1500 mm",
  wellDepth: "e.g. 5 ft or 1500 mm",
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

export async function getServerSideProps({ req }) {
  const user = await getUserFromRequest(req);
  if (!user) return { redirect: { destination: "/Adminlogin", permanent: false } };
  if (["customer", "worker", "storekeeper"].includes(user.role)) return { notFound: true };
  return { props: { user } };
}

export default function QuotationsPage({ user }) {
  const [quotations, setQuotations] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [canGenerate, setCanGenerate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState("");
  // quotationView holds the full quotation object to show in the View Quotation full-screen card
  const [quotationView, setQuotationView] = useState(null);
  const fieldRefs = useRef({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load quotations");
      setQuotations(data.quotations || []);
      setCanGenerate(Boolean(data.canGenerate));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set serial number when creating form opens
  useEffect(() => {
    if (showCreate) {
      setForm((prev) => ({ ...prev, serialNo: String(quotations.length + 1) }));
    }
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
    setError("");
    setNotice("");
    if (!validateForm()) return;
    setSubmitting("generate");
    try {
      const createRes = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      setShowCreate(false);
      setQuotationView(priceData.quotation);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting("");
    }
  }

  async function refreshPriceFromSheet(id) {
    setError("");
    setNotice("");
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
    }
  }

  const frontOffice = user.role === "front_office";

  // Full-screen View Quotation — the price quotation shared with the customer.
  // This is not the Bill of Quantities (see the separate "Generate BOQ" action
  // on this screen, which is a not-yet-built future feature).
  if (quotationView) {
    return (
      <QuotationViewCard
        quotation={quotationView}
        canGenerate={canGenerate}
        onBack={() => setQuotationView(null)}
        onOnboarded={(updatedQuotation) => {
          setQuotationView(updatedQuotation);
          load();
        }}
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
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile, quotation no…"
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#0a649d] transition"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#0a649d] transition"
          >
            <option value="">All statuses</option>
            {["DRAFT", "BOQ_GENERATED", "CALCULATED", "SENT", "ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        {user.role === "superadmin" && (
          <Link className="flex h-10 items-center justify-center rounded-2xl border border-[#0a649d]/20 bg-white text-xs font-black text-[#0a649d]" href="/admin/boq-permissions">
            Manage BOQ Permissions
          </Link>
        )}

        {notice && <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
        {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

        {loading ? (
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
                onShared={setNotice}
              />
            ))}
          </div>
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
              <TextField fieldKey="wellWidth" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
              <TextField fieldKey="wellDepth" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
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
                className="h-12 rounded-2xl bg-[#0a649d] text-sm font-black text-white disabled:opacity-50 active:scale-98 transition shadow-md"
                style={{ background: submitting ? "#6b7280" : "linear-gradient(135deg, #073354, #0a649d)" }}
              >
                {submitting === "generate" ? "Creating…" : submitting === "pricing" ? "Getting Price From Sheet…" : "Create Quotation"}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ─── Full-screen View Quotation Card ────────────────────────────────────────
// This is the customer-facing price quotation — not the Bill of Quantities.
// The BOQ itself is a separate, more detailed document generated later (once
// the customer accepts on a call); see the "Generate BOQ" action below, which
// is a placeholder until that feature is built.
const SAMPLE_BOQ_ITEMS = [
  { item: "SS Cabin Sheet (304 Grade)", unit: "Sq.Ft", qty: 120, rate: 450 },
  { item: "Motor Assembly", unit: "Nos", qty: 1, rate: 85000 },
  { item: "Guide Rail T-75", unit: "Meter", qty: 24, rate: 1200 },
  { item: "Door Operator Assembly", unit: "Set", qty: 1, rate: 32000 },
  { item: "Control Panel & Wiring", unit: "Lot", qty: 1, rate: 18000 },
];

function QuotationViewCard({ quotation, canGenerate, onBack, onOnboarded }) {
  const [shareStatus, setShareStatus] = useState("");
  const [showBoqComingSoon, setShowBoqComingSoon] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState("");
  const [onboardedCustomer, setOnboardedCustomer] = useState(null);
  const alreadyOnboarded = quotation.status === "CONVERTED_TO_CUSTOMER";

  const docRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  async function handlePreviewPdf() {
    setPdfError("");
    setGeneratingPdf(true);
    try {
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(docRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imageData = canvas.toDataURL("image/png");

      const pdf = new JsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imageData, "PNG", 0, 0, pageWidth, imageHeight);

      const blob = pdf.output("blob");
      const file = new File([blob], `${quotation.quotationNo}.pdf`, { type: "application/pdf" });

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPdfFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      setShowPreview(true);
    } catch (err) {
      setPdfError(err.message || "Could not generate the PDF. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleShareFilePdf() {
    if (!pdfFile) return;
    const shareText = `Lift quotation ${quotation.quotationNo} for ${quotation.customerName} - Final Price ₹${Number(quotation.finalPrice ?? 0).toLocaleString("en-IN")}`;

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({ files: [pdfFile], title: quotation.quotationNo, text: shareText });
        setShareStatus("Shared.");
      } catch {
        // Cancelled by the user — nothing to report.
      }
      return;
    }

    // This browser can't hand a file to the OS share sheet (common on
    // desktop browsers) — download it instead so it can be attached manually.
    handleDownloadPdf();
    setShareStatus("This browser can't share files directly. PDF downloaded — attach it in WhatsApp manually.");
  }

  function handleDownloadPdf() {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = `${quotation.quotationNo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleOnboardCustomer() {
    setOnboarding(true);
    setOnboardError("");
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/onboard-customer`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to onboard customer");
      setOnboardedCustomer(data.customer);
      onOnboarded?.(data.quotation);
    } catch (err) {
      setOnboardError(err.message || "Failed to onboard customer");
    } finally {
      setOnboarding(false);
    }
  }

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
        {/* Quotation Document Card — snapshotted into the shared PDF */}
        <div ref={docRef} className="rounded-3xl bg-white shadow-sm overflow-hidden print:shadow-none print:rounded-none" style={{ boxShadow: "0 4px 24px rgba(15,23,42,0.10)" }}>
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
              ₹{Number(quotation.finalPrice ?? quotation.customerPrice ?? 0).toLocaleString("en-IN")}
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

        {/* Action buttons */}
        <div className="mt-4 space-y-2.5 pb-8 print:hidden">
          {pdfError && (
            <p className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-700 text-center">{pdfError}</p>
          )}
          <button
            onClick={handlePreviewPdf}
            disabled={generatingPdf}
            className="w-full h-13 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2.5 active:scale-98 transition shadow-md disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #073354, #0a649d)" }}
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {generatingPdf ? "Preparing PDF…" : "Preview PDF"}
          </button>
          <Link
            href="/admin/quotations"
            className="w-full h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-500 flex items-center justify-center gap-2 active:scale-98 transition"
          >
            All Quotations
          </Link>

          {canGenerate && (
            <div className="pt-2">
              <div className="mb-2 border-t border-slate-200 pt-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer accepted on a call?</p>
              </div>

              {alreadyOnboarded || onboardedCustomer ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-black text-emerald-800">Customer onboarded</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    Added to the customer master with a 1-year AMC starting today.
                  </p>
                  <Link
                    href={`/admin/customers/${onboardedCustomer?.id || quotation.convertedCustomerId}`}
                    className="mt-3 flex h-10 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white active:scale-95 transition"
                  >
                    View Customer Profile
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBoqComingSoon((current) => !current)}
                    className="w-full h-12 rounded-2xl border-2 border-dashed border-[#0a649d]/30 bg-[#0a649d]/5 text-sm font-black text-[#0a649d] flex items-center justify-center gap-2.5 active:scale-98 transition"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    Generate BOQ
                  </button>

                  {showBoqComingSoon && (
                    <div className="mt-3 space-y-3">
                      <ModuleComingSoon
                        title="BOQ Generator"
                        primaryText="Coming soon"
                        reason="A detailed, item-by-item Bill of Quantities for confirmed orders is on its way. For now, this quotation's price above is what you share with the customer."
                      />

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sample preview - not real pricing</p>
                        <div className="mt-2 divide-y divide-slate-50">
                          {SAMPLE_BOQ_ITEMS.map((row) => (
                            <div key={row.item} className="flex items-center justify-between gap-2 py-2 text-[11px]">
                              <span className="font-bold text-slate-700">{row.item}</span>
                              <span className="text-slate-400">{row.qty} {row.unit}</span>
                              <span className="font-black text-slate-900">₹{(row.qty * row.rate).toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black text-slate-800">Ready to onboard this customer?</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          Adds them to the customer master and starts a 1-year AMC today.
                        </p>
                        {onboardError && (
                          <p className="mt-2 rounded-xl border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-700">{onboardError}</p>
                        )}
                        <button
                          type="button"
                          disabled={onboarding}
                          onClick={handleOnboardCustomer}
                          className="mt-3 h-11 w-full rounded-xl bg-[#0a649d] text-sm font-black text-white disabled:opacity-50 active:scale-98 transition"
                        >
                          {onboarding ? "Adding Customer…" : "Add Customer"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/80 print:hidden">
          <div className="flex items-center justify-between bg-[#0a649d] px-4 py-3 text-white">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/60">PDF Preview</p>
              <p className="text-sm font-black">{quotation.quotationNo}.pdf</p>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center active:bg-white/25 transition"
              aria-label="Close preview"
            >
              <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 bg-slate-200">
            {previewUrl && (
              <iframe src={previewUrl} title={`${quotation.quotationNo} preview`} className="h-full w-full border-0" />
            )}
          </div>

          <div className="space-y-2.5 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {shareStatus && (
              <p className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-xs font-bold text-emerald-700 text-center">{shareStatus}</p>
            )}
            <p className="text-center text-[11px] font-semibold text-slate-500">
              This is exactly what the customer will receive. Share it only when you&apos;re ready.
            </p>
            <button
              onClick={handleShareFilePdf}
              className="w-full h-13 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2.5 active:scale-98 transition shadow-md"
              style={{ background: "linear-gradient(135deg, #075E54, #128C7E)" }}
            >
              <WhatsAppIcon className="h-5 w-5" />
              Share to WhatsApp
            </button>
            <button
              onClick={handleDownloadPdf}
              className="w-full h-11 rounded-2xl border-2 border-slate-200 bg-white text-sm font-black text-slate-700 active:scale-98 transition"
            >
              Download PDF
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Quotation List Card ──────────────────────────────────────────────────────
function QuotationCard({ quotation, index, canGenerate, busy, onRefreshPrice, onViewQuotation, onShared }) {
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
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-500">
        <p>Width: <span className="text-slate-800">{quotation.wellWidth}</span></p>
        <p>Depth: <span className="text-slate-800">{quotation.wellDepth}</span></p>
        <p>Floors: <span className="text-slate-800">{quotation.noOfFloors}</span></p>
        <p>Passenger: <span className="text-slate-800">{quotation.noOfPassenger}</span></p>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 truncate">{quotation.doorType} · {quotation.cabinType}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-sm font-black text-slate-900">{quotation.finalPrice ? `₹${Number(quotation.finalPrice).toLocaleString("en-IN")}` : "—"}</p>
        <div className="flex flex-wrap gap-2">
          {shareEnabled && (
            <button
              onClick={onViewQuotation}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 active:scale-95 transition"
            >
              View Quotation
            </button>
          )}
          {shareEnabled && (
            <button
              onClick={() => shareQuotation(quotation, onShared)}
              className="h-9 rounded-xl px-3 text-xs font-bold text-white active:scale-95 transition"
              style={{ background: "linear-gradient(135deg, #075E54, #128C7E)" }}
            >
              WhatsApp
            </button>
          )}
          {canGenerate && quotation.status === "DRAFT" && (
            <button
              onClick={onRefreshPrice}
              disabled={busy}
              className="h-9 rounded-xl bg-[#0a649d] px-3 text-xs font-bold text-white active:scale-95 transition disabled:opacity-50"
            >
              {busy ? "Getting Price…" : "Get Price From Sheet"}
            </button>
          )}
          {canGenerate && ["BOQ_GENERATED", "CALCULATED", "SENT"].includes(quotation.status) && (
            <button
              onClick={onRefreshPrice}
              disabled={busy}
              className="h-9 rounded-xl border border-[#0a649d]/30 px-3 text-xs font-bold text-[#0a649d] active:scale-95 transition disabled:opacity-50"
            >
              {busy ? "Refreshing…" : "Refresh Price From Sheet"}
            </button>
          )}
        </div>
      </div>
    </div>
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

function buildQuotationMessage(quotation) {
  return `Hello ${quotation.customerName},

Your lift quotation from Amardip Lifts is ready.

Quotation No: ${quotation.quotationNo}
Date: ${new Date(quotation.createdAt).toLocaleDateString("en-IN")}

LIFT SPECIFICATION:
Wall Width: ${quotation.wellWidth}
Wall Depth: ${quotation.wellDepth}
No. of Floors: ${quotation.noOfFloors}
Passenger Capacity: ${quotation.noOfPassenger}
Door Type: ${quotation.doorType}
Cabin Type: ${quotation.cabinType}
Motor Type: ${quotation.motorType}
Head Room: ${quotation.headRoom}
Door Opening: ${quotation.doorOpening}

TOTAL QUOTED PRICE: ₹${Number(quotation.finalPrice ?? 0).toLocaleString("en-IN")}

Thank you for choosing Amardip Lifts.
For queries, please contact us.`;
}

function getWhatsappPhone(mobileNo) {
  const digits = String(mobileNo || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function shareQuotation(quotation, onShared) {
  const message = buildQuotationMessage(quotation);
  const phone = getWhatsappPhone(quotation.mobileNo);
  const waWeb = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  // Native share sheet (iOS/Android) lets user pick WhatsApp directly — no intermediate browser page
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      onShared?.("Shared.");
      return;
    } catch {
      // User cancelled or browser blocked — fall through
    }
  }
  // Open in new tab so the current app page stays open
  window.open(waWeb, "_blank");
  onShared?.("Opening WhatsApp…");
}
