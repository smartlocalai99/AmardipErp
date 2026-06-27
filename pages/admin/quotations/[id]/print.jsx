import { getUserFromRequest } from "@/lib/auth";
import { getQuotationById } from "@/lib/quotations";

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
  return (
    <main className="min-h-screen bg-white p-6 text-slate-900 print:p-0">
      <section className="mx-auto max-w-3xl space-y-6 border border-slate-200 p-8 print:border-0">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black">Amardip Lifts / Amardip Elevators</h1>
            <p className="text-sm text-slate-500">Quotation</p>
          </div>
          <button onClick={() => window.print()} className="rounded-xl bg-[#0a649d] px-4 py-2 text-xs font-bold text-white print:hidden">Print</button>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p><strong>Quotation No:</strong> {quotation.quotationNo}</p>
          <p><strong>Date:</strong> {new Date(quotation.createdAt).toLocaleDateString("en-IN")}</p>
          <p><strong>Customer:</strong> {quotation.customerName}</p>
          <p><strong>Mobile:</strong> {quotation.mobileNo}</p>
          <p className="sm:col-span-2"><strong>Address:</strong> {quotation.address || "-"}</p>
        </div>
        <div>
          <h2 className="mb-3 text-base font-black">Lift Specification</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Well Width: {quotation.wellWidth}</p>
            <p>Well Depth: {quotation.wellDepth}</p>
            <p>Floors: {quotation.noOfFloors}</p>
            <p>Passenger: {quotation.noOfPassenger}</p>
            <p>Door Type: {quotation.doorType}</p>
            <p>Cabin Type: {quotation.cabinType}</p>
            <p>Motor Type: {quotation.motorType}</p>
            <p>Head Room: {quotation.headRoom}</p>
            <p>Door Opening: {quotation.doorOpening}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <h2 className="text-base font-black">Price Summary</h2>
          <p className="mt-2 text-2xl font-black text-[#0a649d]">Rs. {quotation.finalPrice ?? quotation.customerPrice ?? "-"}</p>
        </div>
        <div className="text-sm text-slate-500">
          <h2 className="font-black text-slate-900">Terms and Conditions</h2>
          <p className="mt-2">Terms and conditions placeholder. Final commercial terms will be updated by Amardip Lifts / Amardip Elevators.</p>
        </div>
        <div className="pt-10 text-right text-sm font-bold">
          <p>Authorized Signature</p>
          <p className="mt-8">Amardip Lifts / Amardip Elevators</p>
        </div>
      </section>
    </main>
  );
}
