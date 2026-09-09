// Matches the login pages' hero treatment (LOGIN_THEME.primaryDeep) so
// opening the app and reaching a login screen feels like one continuous
// moment, not two different apps stitched together.
const SPLASH_GRADIENT = "linear-gradient(145deg, #07111f 0%, #062f4f 48%, #04070d 100%)";

export default function SplashScreen({ visible }) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ background: SPLASH_GRADIENT }}
    >
      <div className="absolute -left-24 -top-20 h-[260px] w-[260px] rounded-full bg-white/[0.04]" />
      <div className="absolute -right-28 top-1/3 h-[260px] w-[260px] rounded-full border-[48px] border-white/[0.04]" />
      <div className="absolute -bottom-24 -left-16 h-[260px] w-[260px] rounded-full bg-black/25" />

      <div className="relative flex flex-col items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/adlogo-pwa.png" alt="Amardip Lifts" className="h-24 w-24 rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.35)]" />

        {/* A car traveling a shaft — the one piece of motion here is the
            client's own subject matter, not a generic spinner. */}
        <div className="relative h-10 w-1 rounded-full bg-white/10">
          <span className="amardip-splash-car absolute left-1/2 h-2 w-3 -translate-x-1/2 rounded-[2px] bg-[#59e0ff]" />
        </div>
      </div>

      <style jsx>{`
        .amardip-splash-car {
          animation: amardip-splash-travel 1.1s ease-in-out infinite;
        }
        @keyframes amardip-splash-travel {
          0%, 100% { top: 0; opacity: 0.55; }
          50% { top: calc(100% - 0.5rem); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .amardip-splash-car { animation: none; top: 50%; }
        }
      `}</style>
    </div>
  );
}
