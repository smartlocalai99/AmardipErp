import Head from "next/head";

const SECTION_TITLE = "text-lg font-bold text-slate-900 mt-8 mb-2";
const PARA = "text-sm text-slate-600 leading-relaxed mb-3";

export default function DeleteAccount() {
    return (
        <>
            <Head>
                <title>Delete Your Account — Amardip Elevators</title>
                <meta name="robots" content="index, follow" />
            </Head>
            <main className="min-h-screen bg-slate-50 px-5 py-10 sm:py-16">
                <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 sm:p-10 shadow-sm border border-slate-100">
                    <h1 className="text-2xl font-black text-slate-900">Delete Your Account</h1>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Amardip Elevators — Customer App</p>

                    <p className={`${PARA} mt-6`}>
                        You can request deletion of your Amardip Elevators customer account and the
                        personal data associated with it at any time.
                    </p>

                    <h2 className={SECTION_TITLE}>How to request deletion</h2>
                    <p className={PARA}>
                        Send an email to <strong>amardipelevators@gmail.com</strong> from the mobile
                        number or email registered on your account, with the subject line
                        &quot;Delete my account&quot;. Include your registered mobile number so we can
                        locate your account.
                    </p>
                    <p className={PARA}>
                        We will confirm your identity and process the request within 7 business days.
                    </p>

                    <h2 className={SECTION_TITLE}>What gets deleted</h2>
                    <p className={PARA}>
                        Your login credentials, name, phone number, and address on file are deleted
                        from our active systems. Any push notification token tied to your account is
                        removed immediately.
                    </p>

                    <h2 className={SECTION_TITLE}>What we keep, and why</h2>
                    <p className={PARA}>
                        Elevator service and maintenance records (visit history, AMC/warranty
                        documents) are retained even after account deletion, since they relate to the
                        physical equipment installed at your site and are required for warranty,
                        safety, and maintenance-history purposes for as long as that equipment remains
                        in service. These records are no longer linked to a login you can access once
                        your account is deleted.
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
