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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/adlogo-pwa.png"
        alt="Amardip Lifts"
        className="amardip-splash-logo relative h-24 w-24 rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
      />

      <style jsx>{`
        .amardip-splash-logo {
          animation: amardip-splash-in 0.5s ease-out both;
        }
        @keyframes amardip-splash-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .amardip-splash-logo { animation: none; }
        }
      `}</style>
    </div>
  );
}
