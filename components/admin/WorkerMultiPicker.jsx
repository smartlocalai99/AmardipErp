import { useState } from "react";

// Search-and-select multiple workers by name — used wherever more than one
// technician can be assigned to a job (breakdown tickets, service visits).
export default function WorkerMultiPicker({ workers = [], selectedIds = [], onChange, disabled = false, placeholder = "Type a worker's name..." }) {
  const [query, setQuery] = useState("");

  const selectedWorkers = selectedIds
    .map((id) => workers.find((w) => Number(w.id) === Number(id)))
    .filter(Boolean);

  const term = query.trim().toLowerCase();
  const results = term
    ? workers.filter((w) => !selectedIds.includes(w.id) && w.name.toLowerCase().includes(term)).slice(0, 8)
    : [];

  function addWorker(id) {
    onChange([...selectedIds, id]);
    setQuery("");
  }

  function removeWorker(id) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  return (
    <div>
      {selectedWorkers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedWorkers.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-[#0a649d]">
              {w.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeWorker(w.id)}
                  aria-label={`Remove ${w.name}`}
                  className="text-[#0a649d]/60 hover:text-[#0a649d]"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-10.5 w-full px-3 rounded-xl border border-slate-200 text-base bg-white outline-none focus:border-[#0a649d] transition"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {results.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => addWorker(w.id)}
                  className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                >
                  {w.name}{w.role ? <span className="text-slate-400"> ({w.role})</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
