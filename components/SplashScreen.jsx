export default function SplashScreen({ visible }) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/adlogo-pwa.png"
        alt="Amardip Lifts"
        className="amardip-splash-logo relative h-24 w-24 rounded-[26px] shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
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
