import { getUserFromRequest } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

const initialCosts = {
  commonMaterial: 0,
  doorMaterial: 0,
  cabinMaterial: 0,
  motorMaterial: 0,
  ropeCost: 0,
  railCost: 0,
  additionalLfCost: 0,
  labourTransport: 75000,
  taxPercent: 18,
  marginPercent: 15,
  discountAmount: 0,
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
  // boqView holds the full quotation object to show in the BOQ full-screen card
  const [boqView, setBoqView] = useState(null);
  const [selected, setSelected] = useState(null);
  const [costs, setCosts] = useState(initialCosts);
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

  async function createAndGenerateBoq() {
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

      const boqRes = await fetch(`/api/quotations/${createData.quotation.id}/generate-boq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initialCosts),
      });
      const boqData = await boqRes.json();
      if (!boqRes.ok || !boqData.success) throw new Error(boqData.message || "Failed to generate BOQ");

      setForm(initialForm);
      setFormErrors({});
      setShowCreate(false);
      setBoqView(boqData.quotation);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting("");
    }
  }

  async function generateBoq(id) {
    setError("");
    setSubmitting("cost");
    try {
      const res = await fetch(`/api/quotations/${id}/generate-boq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(costs),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to generate BOQ");
      setSelected(null);
      setBoqView(data.quotation);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting("");
    }
  }

  const frontOffice = user.role === "front_office";

  // Full-screen BOQ view
  if (boqView) {
    return <BoqFullCard quotation={boqView} onBack={() => setBoqView(null)} />;
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
            <p className="mt-1 text-xs font-bold text-slate-400">Create your first lift quotation and generate BOQ pricing.</p>
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
                onGenerate={() => setSelected(q)}
                onViewBoq={() => setBoqView(q)}
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
                onClick={createAndGenerateBoq}
                className="h-12 rounded-2xl bg-[#0a649d] text-sm font-black text-white disabled:opacity-50 active:scale-98 transition shadow-md"
                style={{ background: submitting ? "#6b7280" : "linear-gradient(135deg, #073354, #0a649d)" }}
              >
                {submitting === "generate" ? "Generating…" : "Generate BOQ"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Generate BOQ (costs) modal for existing DRAFT */}
      {selected && (
        <Modal title={`Generate BOQ – ${selected.quotationNo}`} onClose={() => !submitting && setSelected(null)}>
          <div className="space-y-3 pb-3">
            {Object.keys(initialCosts).map((key) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, " $1")}</span>
                <input
                  type="number"
                  value={costs[key]}
                  onChange={(e) => setCosts({ ...costs, [key]: e.target.value })}
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#0a649d] transition bg-white"
                />
              </label>
            ))}
            <button
              disabled={Boolean(submitting)}
              onClick={() => generateBoq(selected.id)}
              className="h-12 w-full rounded-xl bg-[#0a649d] text-sm font-black text-white disabled:opacity-50 active:scale-98 transition"
            >
              {submitting === "cost" ? "Generating BOQ…" : "Generate BOQ"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Full-screen BOQ Card ──────────────────────────────────────────────────────
function BoqFullCard({ quotation, onBack }) {
  const [shareStatus, setShareStatus] = useState("");

  function handlePrint() {
    window.print();
  }

  async function handleWhatsApp() {
    const message = buildQuotationMessage(quotation);
    const phone = getWhatsappPhone(quotation.mobileNo);
    const waWeb = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    setShareStatus("Opening WhatsApp…");
    setTimeout(() => setShareStatus(""), 3000);
    // navigator.share opens the native OS share sheet — user taps WhatsApp and it opens directly
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Cancelled or not supported — fall through to open in new tab
      }
    }
    // Open in a new tab so the current app page stays intact
    window.open(waWeb, "_blank");
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
        {/* BOQ Document Card */}
        <div className="rounded-3xl bg-white shadow-sm overflow-hidden print:shadow-none print:rounded-none" style={{ boxShadow: "0 4px 24px rgba(15,23,42,0.10)" }}>
          {/* Company header */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100" style={{ background: "linear-gradient(135deg, #04182b 0%, #073354 60%, #0a649d 100%)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-white border-2 border-white/30 shadow-lg shrink-0">
                <Image src="/adlogo.png" alt="Amardip" fill className="object-contain p-1" sizes="56px" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-black text-white leading-tight">Amardip Lifts</h1>
                <p className="text-[10px] text-white/60 font-bold mt-0.5">Amardip Elevators</p>
                <p className="text-[9px] text-white/40 mt-1 font-semibold tracking-wide">BILL OF QUANTITIES</p>
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
          {shareStatus && (
            <p className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-bold text-emerald-700 text-center">{shareStatus}</p>
          )}
          <button
            onClick={handleWhatsApp}
            className="w-full h-13 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2.5 active:scale-98 transition shadow-md"
            style={{ background: "linear-gradient(135deg, #075E54, #128C7E)" }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Share on WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white text-sm font-black text-slate-700 flex items-center justify-center gap-2.5 active:scale-98 transition"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Download
          </button>
          <Link
            href="/admin/quotations"
            className="w-full h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-500 flex items-center justify-center gap-2 active:scale-98 transition"
          >
            All Quotations
          </Link>
        </div>
      </main>

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
function QuotationCard({ quotation, index, canGenerate, onGenerate, onViewBoq, onShared }) {
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
              onClick={onViewBoq}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 active:scale-95 transition"
            >
              View BOQ
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
              onClick={onGenerate}
              className="h-9 rounded-xl bg-[#0a649d] px-3 text-xs font-bold text-white active:scale-95 transition"
            >
              Generate BOQ
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
