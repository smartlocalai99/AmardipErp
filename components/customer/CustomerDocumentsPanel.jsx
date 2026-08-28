import { useCallback, useEffect, useRef, useState } from "react";
import { filterHandoverDocuments } from "@/lib/customerHandoverDocument";
import { loadCustomerPdfResource } from "@/lib/customerDocumentResource";

export default function CustomerDocumentsPanel({ customerRecords = [] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resourceRef = useRef(null);
  const requestIdRef = useRef(0);
  const documents = filterHandoverDocuments(customerRecords, search);

  const disposeCurrent = useCallback(() => {
    resourceRef.current?.dispose();
    resourceRef.current = null;
    setResource(null);
  }, []);

  const closeViewer = useCallback(() => {
    requestIdRef.current += 1;
    disposeCurrent();
    setSelected(null);
    setLoading(false);
    setError("");
  }, [disposeCurrent]);

  const openDocument = useCallback(async (document) => {
    if (loading) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    disposeCurrent();
    setSelected(document);
    setLoading(true);
    setError("");

    try {
      const next = await loadCustomerPdfResource({
        customerId: document.customerId,
        downloadName: document.downloadName,
      });
      if (requestIdRef.current !== requestId) {
        next.dispose();
        return;
      }
      resourceRef.current = next;
      setResource(next);
    } catch (loadError) {
      if (requestIdRef.current === requestId) {
        setError(loadError.message || "Unable to open this document. Please try again.");
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [disposeCurrent, loading]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    resourceRef.current?.dispose();
  }, []);

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Documents</h1>
        <p className="mt-0.5 text-xs text-slate-500">View and download handing-over letters for your lifts.</p>
      </div>

      <input
        type="search"
        aria-label="Search documents"
        placeholder="Search documents..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-[#0a649d]"
      />

      <div className="space-y-2.5">
        {documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-sm font-extrabold text-slate-700">No handing-over documents available</p>
            <p className="mt-1 text-xs text-slate-500">A letter appears after your lift has a valid HOC date.</p>
          </div>
        ) : documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => openDocument(document)}
            disabled={loading && selected?.id === document.id}
            className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-extrabold text-slate-800">{document.name}</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {document.liftLabel} · HOC {document.date}
              </span>
            </span>
            <span className="shrink-0 pl-3 text-[10px] font-bold text-[#0a649d]">View →</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#0a649d] px-5 py-4 text-white">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">{selected.name}</h2>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/75">{selected.category}</p>
              </div>
              <button type="button" onClick={closeViewer} aria-label="Close document viewer" className="h-9 w-9 rounded-full bg-white/10">×</button>
            </div>

            <div className="min-h-[60vh] flex-1 bg-slate-100 p-3">
              {loading ? (
                <div className="flex h-full min-h-[60vh] items-center justify-center text-sm font-bold text-slate-500">Loading PDF…</div>
              ) : error ? (
                <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm font-bold text-red-600">{error}</p>
                  <button type="button" onClick={() => openDocument(selected)} className="rounded-xl bg-[#0a649d] px-4 py-2 text-xs font-bold text-white">Try again</button>
                </div>
              ) : resource ? (
                <iframe title={selected.name} src={resource.objectUrl} className="h-[65vh] w-full rounded-xl bg-white" />
              ) : null}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              {resource ? (
                <a
                  href={resource.objectUrl}
                  download={resource.downloadName}
                  className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#0a649d] text-xs font-black text-white"
                >
                  Download PDF
                </a>
              ) : (
                <button type="button" disabled className="h-11 w-full rounded-2xl bg-slate-200 text-xs font-black text-slate-400">Download PDF</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
