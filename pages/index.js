import { getUserFromRequest } from "@/lib/auth";
import Link from "next/link";

const BRAND_THEME = {
    primary: "#0a649d",
    primarySoft: "#f0f7fc",
    accent: "#59e0ff",
    accentSoft: "#e6f9ff",
    ink: "#0f172a",
    muted: "#64748b",
};

export async function getServerSideProps(context) {
    const user = await getUserFromRequest(context.req);

    if (user) {
        if (user.role === "customer") {
            return {
                redirect: {
                    destination: "/Customerdashboard",
                    permanent: false,
                },
            };
        } else if (user.role === "worker") {
            return {
                redirect: {
                    destination: "/Techniciandashboard",
                    permanent: false,
                },
            };
        } else if (user.role === "storekeeper") {
            return {
                redirect: {
                    destination: "/Storedashboard",
                    permanent: false,
                },
            };
        } else {
            return {
                redirect: {
                    destination: "/Admindashboard",
                    permanent: false,
                },
            };
        }
    }

    return { props: {} };
}

function ElevatorsIcon({ className = "h-12 w-12 text-[#59e0ff]" }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20V4m6 16V4M9 12h6M4 12h16" />
        </svg>
    );
}

export default function IndexPage() {
    return (
        <main className="min-h-screen bg-slate-900 flex items-center justify-center font-sans antialiased relative overflow-hidden px-4">
            {/* Ambient Background Blur Graphics */}
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#0a649d]/20 blur-3xl"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#59e0ff]/15 blur-3xl"></div>

            {/* Selector Card Container */}
            <div className="w-full max-w-5xl bg-white/95 rounded-4xl border border-white/80 p-8 sm:p-12 shadow-[0_30px_90px_rgba(10,100,157,0.22)] backdrop-blur text-center space-y-8 z-10">
                
                {/* Branding Logo Area */}
                <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 bg-[#0a649d]/10 rounded-2xl flex items-center justify-center border border-[#0a649d]/20">
                        <ElevatorsIcon className="h-10 w-10 text-[#0a649d]" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Amardip Elevators</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Smart Elevator Solutions</p>
                    </div>
                </div>

                <hr className="border-slate-100" />

                <div className="space-y-4">
                    <p className="text-sm font-semibold text-[#64748b]">Select your workspace portal to continue</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Option 1: Customer Portal */}
                        <Link href="/Customerlogin" className="no-underline group">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-[#0a649d] hover:shadow-md transition duration-300 text-left flex flex-col justify-between h-44 cursor-pointer">
                                <div>
                                    <div className="h-9 w-9 rounded-xl bg-sky-50 text-[#0a649d] flex items-center justify-center group-hover:bg-[#0a649d] group-hover:text-white transition duration-300">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <h3 className="text-sm font-extrabold text-slate-800 mt-4 leading-none">Customer Portal</h3>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Smart Lift AI Client App</p>
                                </div>
                                <span className="text-xs font-bold text-[#0a649d] group-hover:underline flex items-center gap-1 mt-4">
                                    Access Portal &rarr;
                                </span>
                            </div>
                        </Link>

                        {/* Option 2: Technician Portal */}
                        <Link href="/Technicianlogin" className="no-underline group">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-[#0a649d] hover:shadow-md transition duration-300 text-left flex flex-col justify-between h-44 cursor-pointer">
                                <div>
                                    <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-[#0a649d] group-hover:text-white transition duration-300">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
                                    </div>
                                    <h3 className="text-sm font-extrabold text-slate-800 mt-4 leading-none">Technician Portal</h3>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Smart Lift AI Field App</p>
                                </div>
                                <span className="text-xs font-bold text-[#0a649d] group-hover:underline flex items-center gap-1 mt-4">
                                    Access Portal &rarr;
                                </span>
                            </div>
                        </Link>

                        {/* Option 3: Staff Portal */}
                        <Link href="/Adminlogin" className="no-underline group">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-[#0a649d] hover:shadow-md transition duration-300 text-left flex flex-col justify-between h-44 cursor-pointer">
                                <div>
                                    <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center group-hover:bg-[#0a649d] group-hover:text-white transition duration-300">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    </div>
                                    <h3 className="text-sm font-extrabold text-slate-800 mt-4 leading-none">Staff Portal</h3>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Admin AMC & ERP</p>
                                </div>
                                <span className="text-xs font-bold text-[#0a649d] group-hover:underline flex items-center gap-1 mt-4">
                                    Access Portal &rarr;
                                </span>
                            </div>
                        </Link>

                        {/* Option 4: Store Portal */}
                        <Link href="/Storelogin" className="no-underline group">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-[#0a649d] hover:shadow-md transition duration-300 text-left flex flex-col justify-between h-44 cursor-pointer">
                                <div>
                                    <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-[#0a649d] group-hover:text-white transition duration-300">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    </div>
                                    <h3 className="text-sm font-extrabold text-slate-800 mt-4 leading-none">Store Portal</h3>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-1">Smart Lift AI Store App</p>
                                </div>
                                <span className="text-xs font-bold text-[#0a649d] group-hover:underline flex items-center gap-1 mt-4">
                                    Access Portal &rarr;
                                </span>
                            </div>
                        </Link>
                    </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                    &copy; 2026 Amardip Elevators. All rights reserved.
                </div>

            </div>
        </main>
    );
}