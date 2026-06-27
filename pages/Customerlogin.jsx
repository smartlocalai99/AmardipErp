import { useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { getUserFromRequest } from "@/lib/auth";

const LOGIN_THEME = {
  primary: "#0a649d",
  primaryDark: "#06466f",
  primaryDeep: "#062f4f",
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

    return {
      redirect: {
        destination: "/Admindashboard",
        permanent: false,
      },
    };
  }

  return { props: {} };
}

function AmardipLogo() {
  return (
    <div className="relative h-[190px] w-[280px] rounded-[26px] ">
      <Image
        src="/logo.png"
        alt="Amardip Elevators Logo"
        fill
        priority
        className="object-contain object-center p-3"
      />
    </div>
  );
}

function UserIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.75 20.25c.9-3.45 3.55-5.4 7.25-5.4s6.35 1.95 7.25 5.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7.25 10.75h9.5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-5a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 10.75V8.4a3.25 3.25 0 0 1 6.5 0v2.35"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14.1v1.55"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({ visible, className = "h-5 w-5" }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path
          d="M2.75 12s3.25-5.75 9.25-5.75S21.25 12 21.25 12 18 17.75 12 17.75 2.75 12 2.75 12Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 14.75A2.75 2.75 0 1 0 12 9.25a2.75 2.75 0 0 0 0 5.5Z"
          stroke="currentColor"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3.25 3.25 20.75 20.75"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M9.85 9.85a3 3 0 0 0 4.3 4.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M7.2 7.85C4.25 9.45 2.75 12 2.75 12s3.25 5.75 9.25 5.75c1.35 0 2.57-.3 3.65-.78"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.35 15.35C20.62 13.95 21.25 12 21.25 12S18 6.25 12 6.25c-.74 0-1.44.08-2.1.24"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FieldShell({ children }) {
  return (
    <div className="flex h-[58px] items-center rounded-[18px] border border-[#e5e7eb] bg-white px-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition-all duration-300 focus-within:border-[#0a649d] focus-within:shadow-[0_12px_30px_rgba(10,100,157,0.15)]">
      {children}
    </div>
  );
}

export default function Customerlogin() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to sign in");
      }

      if (data.user?.role === "customer") {
        await router.replace("/Customerdashboard");
        return;
      }

      if (data.user?.role === "worker") {
        await router.replace("/Techniciandashboard");
        return;
      }

      if (data.user?.role === "storekeeper") {
        await router.replace("/Storedashboard");
        return;
      }

      await router.replace("/Admindashboard");
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(89,224,255,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(10,100,157,0.18), transparent 32%), #f4f7fb",
      }}
    >
      <div className="flex min-h-screen items-center justify-center px-0 py-0 sm:px-6 sm:py-8">
        <div className="relative min-h-screen w-full overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:min-h-0 sm:max-w-[390px] sm:rounded-[34px]">
          <section
            className="relative flex h-[340px] items-center justify-center overflow-hidden"
            style={{
              background: `linear-gradient(145deg, #07111f 0%, ${LOGIN_THEME.primaryDeep} 48%, #04070d 100%)`,
            }}
          >
            <div className="absolute -left-24 -top-20 h-[260px] w-[260px] rounded-full bg-white/[0.04]" />
            <div className="absolute -right-28 top-8 h-[260px] w-[260px] rounded-full border-[48px] border-white/[0.04]" />
            <div className="absolute -bottom-24 -left-16 h-[260px] w-[260px] rounded-full bg-black/25" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.045)_45%,transparent_70%)]" />

            <div className="relative z-10 flex items-center justify-center">
              <AmardipLogo />
            </div>
          </section>

          <section className="relative -mt-[18px] rounded-t-[32px] bg-white px-5 pb-9 pt-10 shadow-[0_-10px_35px_rgba(15,23,42,0.06)]">
            <h1 className="text-center text-[20px] font-semibold text-[#111827]">
              Customer Login
            </h1>

            <form onSubmit={handleLogin} className="mt-8">
              <div className="space-y-5">
                <FieldShell>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#111827]">
                    <UserIcon />
                  </div>

                  <div className="mx-3 h-8 w-px bg-[#e5e7eb]" />

                  <div className="min-w-0 flex-1">
                    <label className="block text-[11px] font-medium leading-none text-[#9ca3af]">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Enter username"
                      autoComplete="username"
                      required
                      className="mt-1 w-full bg-transparent text-[14px] font-medium text-[#111827] outline-none placeholder:text-[#c4c9d2]"
                    />
                  </div>
                </FieldShell>

                <FieldShell>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#111827]">
                    <LockIcon />
                  </div>

                  <div className="mx-3 h-8 w-px bg-[#e5e7eb]" />

                  <div className="min-w-0 flex-1">
                    <label className="block text-[11px] font-medium leading-none text-[#9ca3af]">
                      Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      required
                      className="mt-1 w-full bg-transparent text-[14px] font-medium text-[#111827] outline-none placeholder:text-[#c4c9d2]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#111827] transition hover:bg-[#f1f5f9]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon visible={showPassword} />
                  </button>
                </FieldShell>
              </div>

              {error && (
                <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-7 h-[52px] w-full rounded-[16px] text-[15px] font-semibold text-white shadow-[0_14px_28px_rgba(10,100,157,0.28)] transition duration-300 hover:translate-y-[-1px] hover:shadow-[0_18px_34px_rgba(10,100,157,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-65"
                style={{
                  background: `linear-gradient(135deg, ${LOGIN_THEME.primary}, ${LOGIN_THEME.primaryDark})`,
                }}
              >
                {loading ? "Please wait..." : "Continue"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
