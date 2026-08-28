import { useEffect, useRef, useState } from "react";

// A native <iframe src={pdfUrl}> hands rendering to the browser's own PDF
// viewer, whose default zoom is often wider than the container — forcing
// horizontal scroll with no reliable cross-browser way to fix it (the
// #view=FitH PDF Open Parameter is honored inconsistently across mobile
// browsers/WebViews). Rendering with pdf.js onto a canvas sized to exactly
// the container's width sidesteps that entirely: there is no native viewer
// zoom to fight, so it can never be wider than its container.
let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/build/pdf.mjs").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export default function PdfCanvasViewer({ url, className = "" }) {
  // wrapperRef stays visible at all times so its width is always a real,
  // laid-out number — canvases are measured against it, never against the
  // mount point below, which is emptied out between renders.
  const wrapperRef = useRef(null);
  const mountRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const activeTasks = [];

    async function renderAllPages() {
      setError("");
      setLoading(true);
      try {
        const pdfjsLib = await loadPdfjs();
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        const wrapper = wrapperRef.current;
        const mount = mountRef.current;
        if (!wrapper || !mount) return;
        const containerWidth = wrapper.clientWidth;
        if (!containerWidth) throw new Error("PDF viewer has no width to render into.");
        mount.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;

          const unscaledViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / unscaledViewport.width;
          const viewport = page.getViewport({ scale });

          // Render at device pixel ratio so text stays crisp on retina
          // screens, while the CSS size stays pinned to the container width.
          const dpr = window.devicePixelRatio || 1;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
          canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          if (pageNum > 1) canvas.style.marginTop = "10px";
          mount.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);
          const task = page.render({ canvasContext: ctx, viewport });
          activeTasks.push(task);
          await task.promise;
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not display the PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderAllPages();
    return () => {
      cancelled = true;
      activeTasks.forEach((task) => task.cancel?.());
    };
  }, [url]);

  return (
    <div ref={wrapperRef} className={`relative overflow-y-auto overflow-x-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-500">
          Loading PDF…
        </div>
      )}
      {error && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs font-bold text-red-600">
          {error}
        </p>
      )}
      <div ref={mountRef} className="w-full" />
    </div>
  );
}
