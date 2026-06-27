import { getUserFromRequest } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
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
  serialNo: "Enter serial number",
  name: "Enter customer name",
  address: "Enter customer address",
  mobileNo: "Enter 10 digit mobile number",
  wellWidth: "Enter wall width",
  wellDepth: "Enter wall depth",
  noOfFloors: "Choose floors",
  noOfPassenger: "Choose passenger capacity",
  doorType: "Choose door type",
  cabinType: "Choose cabin type",
  motorType: "Choose motor type",
  headRoom: "Choose head room",
  doorOpening: "Choose door opening",
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
  const [generatedResult, setGeneratedResult] = useState(null);
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
    if (form.mobileNo && digits.length !== 10) nextErrors.mobileNo = "Enter a valid 10 digit mobile number.";
    setFormErrors(nextErrors);
    const firstInvalid = requiredFields.find((key) => nextErrors[key]) || "mobileNo";
    if (Object.keys(nextErrors).length > 0) {
      fieldRefs.current[firstInvalid]?.scrollIntoView({ behavior: "smooth", block: "center" });
      fieldRefs.current[firstInvalid]?.focus?.();
      return false;
    }
    return true;
  }

  async function createQuotation({ generate = false } = {}) {
    setError("");
    setNotice("");
    setGeneratedResult(null);
    if (!validateForm()) return;
    setSubmitting(generate ? "generate" : "save");
    try {
      const createRes = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) throw new Error(createData.message || "Failed to create quotation");

      if (generate) {
        const boqRes = await fetch(`/api/quotations/${createData.quotation.id}/generate-boq`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initialCosts),
        });
        const boqData = await boqRes.json();
        if (!boqRes.ok || !boqData.success) throw new Error(boqData.message || "Failed to generate BOQ");
        setGeneratedResult(boqData.quotation);
        setNotice("BOQ generated. Share the quotation to the customer on WhatsApp.");
      } else {
        setNotice("Draft quotation saved.");
        setShowCreate(false);
      }

      setForm(initialForm);
      setFormErrors({});
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
      setGeneratedResult(data.quotation);
      setNotice("BOQ generated. Share the quotation to the customer on WhatsApp.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting("");
    }
  }

  const frontOffice = user.role === "front_office";

  return (
    <div className="min-h-screen bg-[#eef2f7] text-slate-900">
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <div className="rounded-3xl bg-[#0a649d] p-5 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Amardip Lifts ERP</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">Quotations & BOQ</h1>
              <p className="text-xs text-white/75">
                {frontOffice ? "View generated quotations and share them with customers." : "Create drafts, generate BOQ, and share quotations on WhatsApp."}
              </p>
            </div>
            {canGenerate && (
              <button onClick={() => setShowCreate(true)} className="h-10 shrink-0 rounded-2xl bg-white px-4 text-xs font-black text-[#0a649d]">
                Create Quotation
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotation" className="h-11 rounded-2xl border border-slate-200 px-4 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-2xl border border-slate-200 px-4 text-sm">
            <option value="">All statuses</option>
            {["DRAFT", "BOQ_GENERATED", "CALCULATED", "SENT", "ACCEPTED", "REJECTED", "CONVERTED_TO_CUSTOMER"].map((item) => <option key={item}>{item}</option>)}
          </select>
          {user.role === "superadmin" && <Link className="flex h-11 items-center justify-center rounded-2xl border border-[#0a649d]/20 bg-white text-xs font-black text-[#0a649d]" href="/admin/boq-permissions">BOQ Permissions</Link>}
        </div>

        {notice && <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
        {error && <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        {generatedResult && <GeneratedResultCard quotation={generatedResult} onCopy={(message) => setNotice(message)} />}

        {loading ? <p className="rounded-3xl bg-white p-8 text-center text-xs font-bold text-slate-400">Loading quotations...</p> : quotations.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-base font-black text-slate-900">No quotations yet</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Create your first lift quotation and generate BOQ pricing.</p>
            {canGenerate && <button onClick={() => setShowCreate(true)} className="mt-4 h-10 rounded-2xl bg-[#0a649d] px-4 text-xs font-black text-white">Create Quotation</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {quotations.map((q) => (
              <QuotationCard key={q.id} quotation={q} canGenerate={canGenerate} onGenerate={() => setSelected(q)} onShared={setNotice} />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <Modal title="Create Quotation" onClose={() => !submitting && setShowCreate(false)}>
          <div className="pb-24">
            <p className="mb-4 text-sm font-black text-slate-900">Quotation Form</p>
            <QuotationSection title="Customer Details">
              <TextField fieldKey="serialNo" form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
              <TextField fieldKey="name" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
              <TextField fieldKey="address" form={form} errors={formErrors} registerField={registerField} onChange={updateForm} />
              <TextField fieldKey="mobileNo" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} inputMode="tel" />
            </QuotationSection>
            <QuotationSection title="Wall Details">
              <TextField fieldKey="wellWidth" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} helper="Example: 5 ft or 1500 mm" />
              <TextField fieldKey="wellDepth" required form={form} errors={formErrors} registerField={registerField} onChange={updateForm} helper="Example: 5 ft or 1500 mm" />
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
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={Boolean(submitting)} onClick={() => setShowCreate(false)} className="h-11 rounded-2xl border border-slate-200 text-xs font-black text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={Boolean(submitting)} onClick={() => createQuotation({ generate: false })} className="h-11 rounded-2xl bg-slate-900 text-xs font-black text-white disabled:opacity-50">{submitting === "save" ? "Saving..." : "Save Draft"}</button>
              <button type="button" disabled={Boolean(submitting)} onClick={() => createQuotation({ generate: true })} className="h-11 rounded-2xl bg-[#0a649d] text-xs font-black text-white disabled:opacity-50">{submitting === "generate" ? "Generating BOQ..." : "Generate BOQ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {selected && (
        <Modal title={`Generate BOQ - ${selected.quotationNo}`} onClose={() => !submitting && setSelected(null)}>
          <div className="space-y-3 pb-3">
            {Object.keys(initialCosts).map((key) => (
              <label key={key} className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">{key}</span>
                <input type="number" value={costs[key]} onChange={(e) => setCosts({ ...costs, [key]: e.target.value })} placeholder={key} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            ))}
            <button disabled={Boolean(submitting)} onClick={() => generateBoq(selected.id)} className="h-11 w-full rounded-xl bg-[#0a649d] text-xs font-black text-white disabled:opacity-50">
              {submitting === "cost" ? "Generating BOQ..." : "Generate BOQ"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuotationCard({ quotation, canGenerate, onGenerate, onShared }) {
  const shareEnabled = quotation.status !== "DRAFT";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{quotation.quotationNo}</p>
          <p className="text-xs font-bold text-slate-700">{quotation.customerName}</p>
          <p className="text-[10px] text-slate-400">{quotation.mobileNo}</p>
        </div>
        <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">{quotation.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">
        <p>Wall Width: <span className="text-slate-800">{quotation.wellWidth}</span></p>
        <p>Wall Depth: <span className="text-slate-800">{quotation.wellDepth}</span></p>
        <p>Floors: <span className="text-slate-800">{quotation.noOfFloors}</span></p>
        <p>Passenger: <span className="text-slate-800">{quotation.noOfPassenger}</span></p>
      </div>
      <p className="mt-2 text-xs text-slate-500">{quotation.doorType} / {quotation.cabinType}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-sm font-black text-slate-900">₹{quotation.finalPrice ?? "-"}</p>
        <div className="flex flex-wrap gap-2">
          {shareEnabled && <Link href={`/admin/quotations/${quotation.id}/print`} className="flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">View</Link>}
          {shareEnabled && <button onClick={() => shareQuotation(quotation, onShared)} className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white">Share WhatsApp</button>}
          {canGenerate && quotation.status === "DRAFT" && <button onClick={onGenerate} className="h-9 rounded-xl bg-[#0a649d] px-3 text-xs font-bold text-white">Generate BOQ</button>}
        </div>
      </div>
    </div>
  );
}

function GeneratedResultCard({ quotation, onCopy }) {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Status: BOQ Generated</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">{quotation.quotationNo}</h2>
        </div>
        <p className="rounded-2xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">₹{quotation.finalPrice ?? "-"}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500">
        <p>Customer Name: <span className="text-slate-800">{quotation.customerName}</span></p>
        <p>Mobile No: <span className="text-slate-800">{quotation.mobileNo}</span></p>
        <p>Wall Width: <span className="text-slate-800">{quotation.wellWidth}</span></p>
        <p>Wall Depth: <span className="text-slate-800">{quotation.wellDepth}</span></p>
        <p>Floors: <span className="text-slate-800">{quotation.noOfFloors}</span></p>
        <p>Passenger: <span className="text-slate-800">{quotation.noOfPassenger}</span></p>
        <p>Door Type: <span className="text-slate-800">{quotation.doorType}</span></p>
        <p>Cabin Type: <span className="text-slate-800">{quotation.cabinType}</span></p>
        <p>Motor Type: <span className="text-slate-800">{quotation.motorType}</span></p>
        <p>Final Price: <span className="text-slate-800">₹{quotation.finalPrice ?? "-"}</span></p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => shareQuotation(quotation, onCopy)} className="h-10 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white">Share to WhatsApp</button>
        <button onClick={() => copyQuotationMessage(quotation, onCopy)} className="h-10 rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-700">Copy Message</button>
        <Link href={`/admin/quotations/${quotation.id}/print`} className="flex h-10 items-center rounded-2xl border border-slate-200 px-4 text-xs font-black text-slate-700">View / Print</Link>
      </div>
    </div>
  );
}

function QuotationSection({ title, children }) {
  return (
    <section className="mb-5 space-y-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-[#0a649d]">{title}</h3>
      {children}
    </section>
  );
}

function TextField({ fieldKey, required = false, helper = "", inputMode, form, errors, registerField, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {fieldLabels[fieldKey]} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        ref={(node) => registerField(fieldKey, node)}
        value={form[fieldKey]}
        inputMode={inputMode}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={placeholders[fieldKey]}
        className={`h-12 w-full rounded-2xl border px-3 text-sm outline-none focus:border-[#0a649d] ${errors[fieldKey] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
      />
      {helper && <span className="mt-1 block text-[10px] font-semibold text-slate-400">{helper}</span>}
      {errors[fieldKey] && <span className="mt-1 block text-[10px] font-bold text-red-600">{errors[fieldKey]}</span>}
    </label>
  );
}

function SelectField({ fieldKey, required = false, form, errors, registerField, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {fieldLabels[fieldKey]} {required && <span className="text-red-500">*</span>}
      </span>
      <select
        ref={(node) => registerField(fieldKey, node)}
        value={form[fieldKey]}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        className={`h-12 w-full rounded-2xl border px-3 text-sm outline-none focus:border-[#0a649d] ${errors[fieldKey] ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"} ${form[fieldKey] ? "text-slate-900" : "text-slate-400"}`}
      >
        <option value="">{placeholders[fieldKey]}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {errors[fieldKey] && <span className="mt-1 block text-[10px] font-bold text-red-600">{errors[fieldKey]}</span>}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-4">
          <h2 className="text-sm font-black">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 text-sm font-black">x</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function buildQuotationMessage(quotation) {
  return `Hello ${quotation.customerName},

Your lift quotation from Amardip Lifts is ready.

Quotation No: ${quotation.quotationNo}
Wall Width: ${quotation.wellWidth}
Wall Depth: ${quotation.wellDepth}
Floors: ${quotation.noOfFloors}
Passenger: ${quotation.noOfPassenger}
Door Type: ${quotation.doorType}
Cabin Type: ${quotation.cabinType}
Motor Type: ${quotation.motorType}
Final Price: ₹${quotation.finalPrice ?? "-"}

Thank you,
Amardip Lifts`;
}

function getWhatsappPhone(mobileNo) {
  const digits = String(mobileNo || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function copyQuotationMessage(quotation, onCopy) {
  const message = buildQuotationMessage(quotation);
  await navigator.clipboard?.writeText(message);
  onCopy?.("Quotation message copied.");
}

async function shareQuotation(quotation, onShared) {
  const message = buildQuotationMessage(quotation);
  const phone = getWhatsappPhone(quotation.mobileNo);
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      onShared?.("Quotation shared.");
      return;
    } catch {
      // User cancelled native share; continue to WhatsApp fallback.
    }
  }
  window.location.assign(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
}
