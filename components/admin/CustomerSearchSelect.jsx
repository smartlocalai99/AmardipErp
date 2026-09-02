import { useState } from "react";

// Search-and-select a single customer by name, code, mobile, or city — the
// plain <select> this replaced only ever showed the first page of
// customers, so anyone past that page (e.g. newer EMC-coded sites) was
// impossible to find and schedule.
export default function CustomerSearchSelect({ customers = [], selectedId = "", onSelect, placeholder = "Search by name, code, mobile, or city..." }) {
  const [query, setQuery] = useState("");

  const selected = customers.find((c) => String(c.id) === String(selectedId));

  const term = query.trim().toLowerCase();
  const results = term
    ? customers
        .filter((c) => {
          const haystack = [c.customer_name, c.customer_code, c.mobile_no, c.city].filter(Boolean).join(" ").toLowerCase();
          return haystack.includes(term);
        })
        .slice(0, 8)
    : [];

  function pick(customer) {
    onSelect(customer);
    setQuery("");
  }

  return (
    <div>
      {selected && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-[#0a649d]">{selected.customer_name || selected.customerName}</p>
            <p className="truncate text-[10px] font-semibold text-[#0a649d]/70">{selected.customer_code} • {selected.city || ""}</p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Clear selected customer"
            className="shrink-0 text-[#0a649d]/60 hover:text-[#0a649d] text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {!selected && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                >
                  {c.customer_name}
                  <span className="text-slate-400"> — {c.customer_code} {c.city ? `• ${c.city}` : ""}</span>
                </button>
              ))}
            </div>
          )}
          {term && results.length === 0 && (
            <p className="mt-1.5 text-[10px] font-semibold text-slate-400">No matching customer.</p>
          )}
        </div>
      )}
    </div>
  );
}
