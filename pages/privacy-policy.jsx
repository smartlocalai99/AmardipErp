import Head from "next/head";

const SECTION_TITLE = "text-lg font-bold text-slate-900 mt-8 mb-2";
const PARA = "text-sm text-slate-600 leading-relaxed mb-3";

export default function PrivacyPolicy() {
    return (
        <>
            <Head>
                <title>Privacy Policy — Amardip Elevators</title>
                <meta name="robots" content="index, follow" />
            </Head>
            <main className="min-h-screen bg-slate-50 px-5 py-10 sm:py-16">
                <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 sm:p-10 shadow-sm border border-slate-100">
                    <h1 className="text-2xl font-black text-slate-900">Privacy Policy</h1>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Amardip Elevators — Customer App</p>
                    <p className="text-xs text-slate-400 mt-1">Last updated: September 2026</p>

                    <p className={`${PARA} mt-6`}>
                        Amardip Elevators (&quot;we&quot;, &quot;us&quot;) provides this app so our elevator/lift
                        service customers can track service visits, raise complaints, and stay in touch with
                        their assigned technician. This page explains what information we collect through the
                        app and how we use it.
                    </p>

                    <h2 className={SECTION_TITLE}>Information we collect</h2>
                    <p className={PARA}>
                        <strong>Account and contact details</strong> — your name, mobile number, and site address,
                        used to create your customer login and identify your elevator installation.
                    </p>
                    <p className={PARA}>
                        <strong>Service and complaint records</strong> — service history for your elevator,
                        complaints/tickets you raise, their status, and any photos you choose to attach to a
                        complaint, so our team and technicians can act on them.
                    </p>
                    <p className={PARA}>
                        <strong>Technician job data</strong> — when a technician completes a visit at your site,
                        we store their check-in location, work notes, checklist results, and your representative&apos;s
                        signature, so the completed job report is available to you inside the app.
                    </p>
                    <p className={PARA}>
                        <strong>Push notification token</strong> — if you allow notifications, we store a device
                        token so we can notify you about ticket status changes and technician assignment. You can
                        withdraw this at any time from your device&apos;s notification settings.
                    </p>
                    <p className={PARA}>
                        <strong>Login session</strong> — a secure, encrypted session cookie that keeps you signed
                        in. We do not use this for advertising or tracking across other apps or websites.
                    </p>

                    <h2 className={SECTION_TITLE}>What we don&apos;t do</h2>
                    <p className={PARA}>
                        We do not sell your data, use it for advertising, or share it with third parties except
                        the technicians and staff directly involved in servicing your elevator. We do not access
                        your device&apos;s location, camera, or contacts unless you actively choose to attach a
                        photo to a complaint.
                    </p>

                    <h2 className={SECTION_TITLE}>Data retention</h2>
                    <p className={PARA}>
                        We retain your account and service records for as long as your elevator maintenance
                        contract is active, and afterward as required for warranty and service-history purposes.
                    </p>

                    <h2 className={SECTION_TITLE}>Your choices</h2>
                    <p className={PARA}>
                        You can ask us to review, correct, or delete your account information at any time by
                        contacting us using the details below.
                    </p>

                    <h2 className={SECTION_TITLE}>Contact us</h2>
                    <p className={PARA}>
                        Amardip Elevators<br />
                        Email: amardipelevators@gmail.com
                    </p>
                </div>
            </main>
        </>
    );
}
