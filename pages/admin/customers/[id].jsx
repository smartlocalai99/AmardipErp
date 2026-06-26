import { getUserFromRequest } from "@/lib/auth";
import { query } from "@/lib/db";
import { DataListSkeleton } from "@/components/ui/SkeletonLoaders";
import { cachedGetJson } from "@/lib/cachedFetch";
import { clearSessionCache } from "@/lib/adminCache";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const SUMMARY_FIELDS = [
  { key: "mobile_no", label: "Mobile Number" },
  { key: "city", label: "City" },
  { key: "amc_warranty_due", label: "AMC/Warranty Due" },
  { key: "amc_starting_date", label: "AMC Start" },
  { key: "amc_ending_date", label: "AMC End" },
  { key: "no_of_floors", label: "Floors" },
  { key: "no_of_passenger", label: "Passenger Capacity" },
  { key: "hoc_date", label: "HOC Date" },
];

const TECH_FIELDS = [
  { key: "door_type", label: "Door Type" },
  { key: "cabin", label: "Cabin" },
  { key: "motor_make", label: "Motor Make" },
  { key: "controller_make", label: "Controller Make" },
  { key: "drive_make", label: "Drive Make" },
  { key: "ard_make", label: "ARD Make" },
  { key: "drive_model_no", label: "Drive Model" },
  { key: "motor_model_no", label: "Motor Model" },
  { key: "elevator_type", label: "Elevator Type" },
  { key: "door_make", label: "Door Make" },
];

const VISIT_COLUMNS = [
  { key: "service_date", label: "Service Date" },
  { key: "service_type", label: "Service Type" },
  { key: "technician_1", label: "Technician 1" },
  { key: "technician_2", label: "Technician 2" },
  { key: "ard_condition", label: "ARD" },
  { key: "motor_condition", label: "Motor" },
  { key: "gear_oil_condition", label: "Gear Oil" },
  { key: "brake_condition", label: "Brake" },
  { key: "rope_condition", label: "Rope" },
  { key: "rail_clips_condition", label: "Rail Clips" },
  { key: "limit_switch_condition", label: "Limit Switch" },
  { key: "gate_locks_condition", label: "Gate Locks" },
  { key: "rcr_condition", label: "RCR" },
  { key: "sensors_condition", label: "Sensors" },
  { key: "osg_condition", label: "OSG" },
  { key: "payment_amount", label: "Payment" },
  { key: "remarks", label: "Remarks" },
  { key: "source_sno", label: "Source S.No" },
];

const STATUS_OPTIONS = ["AMC", "EMC", "WARRANTY", "OUT OF WARRANTY", "PENDING", "ON GOING"];
const RENEWAL_TYPES = ["AMC", "EMC", "WARRANTY"];
const EDIT_FIELDS = [
  { key: "customer_name", label: "Customer name" },
  { key: "mobile_no", label: "Mobile number" },
  { key: "city", label: "City" },
  { key: "address", label: "Address", type: "textarea" },
  { key: "customer_status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { key: "amc_warranty_due", label: "AMC/Warranty due", type: "date" },
  { key: "amc_starting_date", label: "AMC start date", type: "date" },
  { key: "amc_ending_date", label: "AMC end date", type: "date" },
  { key: "no_of_passenger", label: "Passenger capacity" },
  { key: "no_of_floors", label: "Floors" },
  { key: "door_type", label: "Door type" },
  { key: "cabin", label: "Cabin" },
  { key: "motor_make", label: "Motor make" },
  { key: "controller_make", label: "Controller make" },
  { key: "drive_make", label: "Drive make" },
  { key: "ard_make", label: "ARD make" },
  { key: "drive_model_no", label: "Drive model" },
  { key: "motor_model_no", label: "Motor model" },
  { key: "elevator_type", label: "Elevator type" },
  { key: "door_make", label: "Door make" },
  { key: "location", label: "Location" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

function displayValue(value) {
  return value === null || value === undefined || value === "" ? "-" : value;
}

function CountSkeleton() {
  return (
    <span className="mt-2 block h-3 w-48 animate-pulse rounded-full bg-slate-200" />
  );
}

function dateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function getAmcState(customer) {
  const rawDate = customer?.amc_warranty_due || customer?.amc_ending_date;
  if (!rawDate) {
    return {
      label: "AMC/Warranty date missing",
      classes: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${String(rawDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: "AMC/Warranty date invalid",
      classes: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return {
      label: "AMC/Warranty expired",
      classes: "border-red-100 bg-red-50 text-red-700",
    };
  }

  if (diffDays <= 30) {
    return {
      label: "AMC/Warranty due soon",
      classes: "border-amber-100 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "AMC active",
    classes: "border-emerald-100 bg-emerald-50 text-emerald-700",
  };
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
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

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-slate-900">
        {displayValue(value)}
      </p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="break-words text-xs font-bold text-slate-700">
        {displayValue(value)}
      </span>
    </div>
  );
}

function ActionButton({ children, onClick, tone = "light" }) {
  const classes = tone === "blue"
    ? "bg-white text-[#0a649d]"
    : "bg-white/15 text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-xl px-3 text-xs font-black shadow-sm active:scale-95 ${classes}`}
    >
      {children}
    </button>
  );
}

function Sheet({ title, eyebrow, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative max-h-[88dvh] w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-3xl sm:rounded-[28px]">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0a649d]">
                {eyebrow}
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-900">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-black leading-none text-slate-500 active:scale-95"
            >
              x
            </button>
          </div>
        </div>
        <div className="max-h-[calc(88dvh-94px)] overflow-y-auto px-4 py-4">
          {children}
        </div>
      </section>
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <select
        value={value || ""}
        onChange={(event) => onChange(field.key, event.target.value)}
        className="amardip-field w-full text-sm"
      >
        <option value="">Select</option>
        {field.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={(event) => onChange(field.key, event.target.value)}
        rows={3}
        className="amardip-field min-h-24 w-full resize-y text-sm"
      />
    );
  }

  return (
    <input
      type={field.type || "text"}
      value={field.type === "date" ? dateInputValue(value) : value || ""}
      onChange={(event) => onChange(field.key, event.target.value)}
      className="amardip-field w-full text-sm"
    />
  );
}

function EditCustomerSheet({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const values = {};
    EDIT_FIELDS.forEach((field) => {
      values[field.key] = field.type === "date" ? dateInputValue(customer[field.key]) : customer[field.key] || "";
    });
    return values;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/elevator-customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update customer");
      }

      setMessage(`Saved ${data.changedFields?.length || 0} change(s).`);
      onSaved(data.customer);
    } catch (err) {
      setError(err.message || "Failed to update customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="Edit Customer" eyebrow={displayValue(customer.customer_code)} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{message}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          {EDIT_FIELDS.map((field) => (
            <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                {field.label}
              </span>
              <FieldInput field={field} value={form[field.key]} onChange={updateField} />
            </label>
          ))}
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-100 bg-white p-4">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700">
            Close
          </button>
          <button type="submit" disabled={saving} className="h-11 flex-1 rounded-xl bg-[#0a649d] text-xs font-black text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function RenewAmcSheet({ customer, onClose, onSaved }) {
  const today = formatInputDate(new Date());
  const oneYearEnd = formatInputDate(addDays(addMonths(new Date(), 12), -1));
  const [form, setForm] = useState({
    renewalType: "AMC",
    startDate: today,
    endDate: oneYearEnd,
    dueDate: oneYearEnd,
    status: "AMC",
    amount: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyQuick(type) {
    const start = new Date();
    const months = type === "6 Months AMC" ? 6 : 12;
    const end = formatInputDate(addDays(addMonths(start, months), -1));
    const startDate = formatInputDate(start);
    const status = type === "Warranty" ? "WARRANTY" : "AMC";
    setForm((current) => ({
      ...current,
      renewalType: type === "Warranty" ? "WARRANTY" : "AMC",
      startDate,
      endDate: end,
      dueDate: end,
      status,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/elevator-customers/${customer.id}/renew-amc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to renew AMC");
      }

      setMessage("AMC/Warranty renewed.");
      onSaved(data.customer);
    } catch (err) {
      setError(err.message || "Failed to renew AMC");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="Renew AMC" eyebrow={displayValue(customer.customer_code)} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{message}</div>}

        <div className="grid grid-cols-3 gap-2">
          {["1 Year AMC", "6 Months AMC", "Warranty"].map((label) => (
            <button key={label} type="button" onClick={() => applyQuick(label)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-black text-slate-700">
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Renewal type</span>
            <select value={form.renewalType} onChange={(event) => updateField("renewalType", event.target.value)} className="amardip-field w-full text-sm">
              {RENEWAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Status</span>
            <select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="amardip-field w-full text-sm">
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          {["startDate", "endDate", "dueDate"].map((key) => (
            <label key={key}>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                {key === "startDate" ? "Start date" : key === "endDate" ? "End date" : "Due date"}
              </span>
              <input type="date" value={form[key]} onChange={(event) => updateField(key, event.target.value)} className="amardip-field w-full text-sm" />
            </label>
          ))}
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Amount</span>
            <input value={form.amount} onChange={(event) => updateField("amount", event.target.value)} className="amardip-field w-full text-sm" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Notes</span>
            <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={3} className="amardip-field min-h-24 w-full resize-y text-sm" />
          </label>
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-slate-100 bg-white p-4">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700">
            Close
          </button>
          <button type="submit" disabled={saving} className="h-11 flex-1 rounded-xl bg-[#0a649d] text-xs font-black text-white disabled:opacity-50">
            {saving ? "Saving..." : "Renew"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function HistorySheet({ customer, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchLogs() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/elevator-customers/${customer.id}/audit-logs`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load change history");
        }
        if (active) setLogs(data.logs || []);
      } catch (err) {
        if (active) setError(err.message || "Failed to load change history");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      active = false;
    };
  }, [customer.id]);

  return (
    <Sheet title="Change History" eyebrow={displayValue(customer.customer_code)} onClose={onClose}>
      {loading && <div className="rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-500">Loading history...</div>}
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div>}
      {!loading && !error && logs.length === 0 && (
        <div className="rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-500">No changes recorded yet.</div>
      )}
      <div className="space-y-3">
        {logs.map((log) => (
          <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">{log.action}</p>
                <h3 className="mt-1 text-sm font-black text-slate-900">{log.actorUsername || "Admin"} ({log.actorRole || "-"})</h3>
              </div>
              <p className="text-xs font-bold text-slate-500">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
            </div>
            <div className="mt-3 space-y-2">
              {(log.changedFields || []).map((field) => (
                <div key={field} className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{field}</span>
                  <span className="break-words">{displayValue(log.oldValues?.[field])}</span>
                  <span className="px-2 text-slate-400">-&gt;</span>
                  <span className="break-words">{displayValue(log.newValues?.[field])}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Sheet>
  );
}

function Pager({ pagination, page, setPage }) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">
        Page <span className="text-slate-900">{pagination.page}</span> of{" "}
        <span className="text-slate-900">{pagination.totalPages}</span> -{" "}
        <span className="text-slate-900">{pagination.total}</span> visits
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

export async function getServerSideProps(context) {
  const user = await getUserFromRequest(context.req);

  if (!user) {
    return {
      redirect: {
        destination: "/Adminlogin",
        permanent: false,
      },
    };
  }

  if (user.role === "customer") {
    return {
      redirect: {
        destination: "/Customerdashboard",
        permanent: false,
      },
    };
  }

  if (user.role === "worker") {
    return {
      redirect: {
        destination: "/Techniciandashboard",
        permanent: false,
      },
    };
  }

  if (user.role === "storekeeper") {
    return {
      redirect: {
        destination: "/Storedashboard",
        permanent: false,
      },
    };
  }

  const customerResult = await query(
    `
    SELECT
      id,
      record_no,
      customer_code,
      customer_name,
      address,
      city,
      mobile_no,
      hoc_date,
      customer_status,
      amc_warranty_due,
      amc_starting_date,
      amc_ending_date,
      no_of_passenger,
      door_type,
      cabin,
      no_of_floors,
      motor_make,
      controller_make,
      drive_make,
      ard_make,
      drive_model_no,
      motor_model_no,
      elevator_type,
      door_make,
      location,
      remarks
    FROM elevator_service_customers
    WHERE id = $1
    LIMIT 1
    `,
    [context.params.id]
  );

  if (customerResult.rowCount === 0) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user,
      customer: JSON.parse(JSON.stringify(customerResult.rows[0])),
    },
  };
}

export default function CustomerDetailPage({ user, customer }) {
  const router = useRouter();
  const userCacheKey = user?.id || user?.username || user?.role || "anonymous";
  const [currentCustomer, setCurrentCustomer] = useState(customer);
  const [visits, setVisits] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    serviceType: "",
    fromDate: "",
    toDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSheet, setActiveSheet] = useState("");

  const amcState = useMemo(() => getAmcState(currentCustomer), [currentCustomer]);

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

    async function fetchVisits() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });

        if (search) params.set("search", search);
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });

        const data = await cachedGetJson(`/api/elevator-customers/${currentCustomer.id}/service-visits?${params.toString()}`, {
          cacheKey: `customer_${currentCustomer.id}_service_visits_${params.toString()}`,
          ttlMs: 5 * 60 * 1000,
          user: userCacheKey,
          fetchOptions: { signal: controller.signal },
          onNetworkStart: () => setLoading(true),
        });

        if (!data.success) {
          throw new Error(data.message || "Failed to load service history");
        }

        setVisits(data.visits || []);
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load service history");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchVisits();

    return () => controller.abort();
  }, [currentCustomer.id, page, pageSize, search, filters, userCacheKey]);

  function goBackToSource() {
    const returnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : "";

    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      router.replace(returnTo);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/admin/customers");
  }

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleCustomerSaved(updatedCustomer) {
    setCurrentCustomer(updatedCustomer);
    clearSessionCache();
    router.replace(router.asPath, undefined, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a]">
      <header className="sticky top-0 z-30 bg-[#0a649d] px-4 py-4 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            type="button"
            onClick={goBackToSource}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
              {displayValue(currentCustomer.customer_code)}
            </p>
            <h1 className="truncate text-lg font-black tracking-tight">
              {displayValue(currentCustomer.customer_name)}
            </h1>
            <p className="mt-1 text-xs font-semibold text-white/75">
              Logged in as {user?.name || "Admin"}
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <ActionButton onClick={() => setActiveSheet("edit")} tone="blue">Edit Customer</ActionButton>
            <ActionButton onClick={() => setActiveSheet("renew")}>Renew AMC</ActionButton>
            <ActionButton onClick={() => setActiveSheet("history")}>History</ActionButton>
            <StatusBadge status={currentCustomer.customer_status} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
          <ActionButton onClick={() => setActiveSheet("edit")} tone="blue">Edit</ActionButton>
          <ActionButton onClick={() => setActiveSheet("renew")}>Renew</ActionButton>
          <ActionButton onClick={() => setActiveSheet("history")}>History</ActionButton>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 sm:py-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
            Customer Profile
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-slate-900">
            {displayValue(currentCustomer.customer_name)}
          </h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
            {displayValue(currentCustomer.address)}
          </p>
          <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase ${amcState.classes}`}>
            {amcState.label}
          </div>
          {currentCustomer.location && (
            <p className="mt-1 text-xs font-bold text-slate-500">
              Location: {displayValue(currentCustomer.location)}
            </p>
          )}
          {currentCustomer.remarks && (
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-relaxed text-slate-600">
              {currentCustomer.remarks}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 px-1 text-xs font-black uppercase tracking-wider text-slate-400">
            Customer Summary
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SUMMARY_FIELDS.map((field) => (
              <InfoCard key={field.key} label={field.label} value={currentCustomer[field.key]} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-xs font-black uppercase tracking-wider text-slate-400">
            Lift Technical Details
          </h2>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 shadow-sm">
            {TECH_FIELDS.map((field) => (
              <DetailRow key={field.key} label={field.label} value={currentCustomer[field.key]} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                Service History
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-900">
                Visit Ledger
              </h2>
              {loading && !pagination ? (
                <CountSkeleton />
              ) : (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Showing {visibleFrom} - {visibleTo} of {pagination?.total || 0} service records
                </p>
              )}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-6">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search service history"
                className="amardip-search-field lg:col-span-2"
              />
              <input
                type="text"
                value={filters.serviceType}
                onChange={(event) => updateFilter("serviceType", event.target.value)}
                placeholder="Service type"
                className="amardip-field"
              />
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) => updateFilter("fromDate", event.target.value)}
                className="amardip-field text-sm"
              />
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) => updateFilter("toDate", event.target.value)}
                className="amardip-field text-sm"
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

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <DataListSkeleton columns={VISIT_COLUMNS.length} minWidth="2200px" />
          )}

          {!loading && !error && visits.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">
              No service visits found for this customer.
            </div>
          )}

          {!loading && !error && visits.length > 0 && (
            <>
              <section className="space-y-3 md:hidden">
                {visits.map((visit) => (
                  <article key={visit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#0a649d]">
                          {displayValue(visit.service_date)}
                        </p>
                        <h3 className="mt-1 text-base font-black leading-tight text-slate-900">
                          {displayValue(visit.service_type)}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {displayValue(visit.technician_1)}
                          {visit.technician_2 ? ` / ${visit.technician_2}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">
                        {formatMoney(visit.payment_amount)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Motor</span>
                        {displayValue(visit.motor_condition)}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Brake</span>
                        {displayValue(visit.brake_condition)}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Rope</span>
                        {displayValue(visit.rope_condition)}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Sensors</span>
                        {displayValue(visit.sensors_condition)}
                      </div>
                    </div>

                    <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-600">
                      {displayValue(visit.remarks)}
                    </p>
                  </article>
                ))}
              </section>

              <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[2200px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        {VISIT_COLUMNS.map((column) => (
                          <th key={column.key} className="whitespace-nowrap px-3 py-3 font-black">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {visits.map((visit) => (
                        <tr key={visit.id} className="hover:bg-slate-50">
                          {VISIT_COLUMNS.map((column) => (
                            <td key={column.key} className="max-w-[260px] whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                              {column.key === "payment_amount" ? (
                                formatMoney(visit.payment_amount)
                              ) : (
                                <span title={String(displayValue(visit[column.key]))}>
                                  {displayValue(visit[column.key])}
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
        </section>
      </main>

      {activeSheet === "edit" && (
        <EditCustomerSheet
          customer={currentCustomer}
          onClose={() => setActiveSheet("")}
          onSaved={handleCustomerSaved}
        />
      )}
      {activeSheet === "renew" && (
        <RenewAmcSheet
          customer={currentCustomer}
          onClose={() => setActiveSheet("")}
          onSaved={handleCustomerSaved}
        />
      )}
      {activeSheet === "history" && (
        <HistorySheet
          customer={currentCustomer}
          onClose={() => setActiveSheet("")}
        />
      )}
    </div>
  );
}
