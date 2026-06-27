import { getUserFromRequest } from "@/lib/auth";
import { getQuotationById } from "@/lib/quotations";
import Image from "next/image";
import Link from "next/link";

export async function getServerSideProps({ req, params }) {
  const user = await getUserFromRequest(req);
  if (!user) return { redirect: { destination: "/Adminlogin", permanent: false } };
  try {
    const quotation = await getQuotationById({ id: params.id, actor: user });
    if (!quotation || quotation.status === "DRAFT") return { notFound: true };
    return { props: { quotation } };
  } catch {
    return { notFound: true };
  }
}

export default function PrintQuotation({ quotation }) {
  async function handleWhatsApp() {
    const message = buildMessage(quotation);
    const digits = String(quotation.mobileNo || "").replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits;
    const waWeb = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    // Native share sheet on iOS/Android opens WhatsApp directly with no intermediate page
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // User cancelled — fall through
      }
    }
    // New tab so this page stays open
    window.open(waWeb, "_blank");
  }

  const specs = [
    ["Wall Width", quotation.wellWidth],
    ["Wall Depth", quotation.wellDepth],
    ["No. of Floors", quotation.noOfFloors],
    ["Passenger Capacity", quotation.noOfPassenger],
    ["Door Type", quotation.doorType],
    ["Cabin Type", quotation.cabinType],
    ["Motor Type", quotation.motorType],
    ["Head Room", quotation.headRoom],
    ["Door Opening", quotation.doorOpening],
  ];

  return (
    <div className="min-h-screen bg-[#eef2f7] print:bg-white">
      {/* Mobile header */}
      <div className="sticky top-0 z-20 bg-[#0a649d] px-4 py-4 flex items-center gap-3 print:hidden">
        <Link href="/admin/quotations" className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Amardip Lifts</p>
          <p className="text-sm font-black text-white">{quotation.quotationNo}</p>
        </div>
      </div>

      <main className="p-4 max-w-2xl mx-auto">
        {/* BOQ Document */}
        <div className="rounded-3xl bg-white overflow-hidden print:shadow-none print:rounded-none" style={{ boxShadow: "0 4px 24px rgba(15,23,42,0.10)" }}>
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
                <p className="text-[11px] font-black text-white">
                  {new Date(quotation.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
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

          {/* Specifications */}
          <div className="px-6 py-5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[#0a649d] mb-3">Lift Specification</h2>
            <div className="divide-y divide-slate-50">
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
            <div className="h-14 w-14 relative opacity-60">
              <Image src="/adlogo.png" alt="Amardip" fill className="object-contain" sizes="56px" />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 space-y-2.5 pb-10 print:hidden">
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
            onClick={() => window.print()}
            className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white text-sm font-black text-slate-700 flex items-center justify-center gap-2.5 active:scale-98 transition"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Download PDF
          </button>
          <Link href="/admin/quotations" className="w-full h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-500 flex items-center justify-center gap-2">
            ← All Quotations
          </Link>
        </div>
      </main>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          body { background: white !important; margin: 0; }
        }
      `}</style>
    </div>
  );
}

function buildMessage(quotation) {
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

Thank you for choosing Amardip Lifts.`;
}
