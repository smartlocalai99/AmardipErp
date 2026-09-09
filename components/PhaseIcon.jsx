// Six line-art icons, one per installation phase, each a helmeted worker
// performing that phase's action. Styles load globally via
// styles/phase-icons.css (imported in pages/_app.js) rather than here,
// since per-component CSS imports outside _app.js aren't supported by
// Next's Pages Router. Only the `active` state ever animates — locked and
// done stay still, deliberately, per the source design (six looping icons
// on one screen would defeat the point of the motion).
function SiteAndTemplate() {
  return (
    <>
      <rect x="50" y="10" width="40" height="53" rx="2" strokeDasharray="4 4" />
      <path d="M50 18h40" />
      <g className="pi-swing">
        <path d="M70 18v26" />
        <path d="M66 44h8l-4 7z" />
      </g>
      <path d="M18 31a8 8 0 0 1 16 0" />
      <path d="M17 31h18" />
      <circle cx="26" cy="34" r="4.5" />
      <path d="M26 38.5v13" />
      <path d="M26 51.5l-6 12M26 51.5l6 12" />
      <path d="M26 40l11-3" />
    </>
  );
}
function BracketsAndRails() {
  return (
    <>
      <path d="M64 10v53M80 10v53" />
      <path d="M52 24h12M52 44h12" />
      <rect x="60" y="20" width="8" height="8" rx="1" />
      <rect x="60" y="40" width="8" height="8" rx="1" />
      <path d="M18 31a8 8 0 0 1 16 0" />
      <path d="M17 31h18" />
      <circle cx="26" cy="34" r="4.5" />
      <path d="M26 38.5v13" />
      <path d="M26 51.5l-6 12M26 51.5l6 12" />
      <g className="pi-bolt">
        <path d="M26 40l16-5" />
        <path d="M42 35l6 4" />
      </g>
    </>
  );
}
function ShaftMotorRoping() {
  return (
    <>
      <g className="pi-spin">
        <circle cx="70" cy="24" r="13" />
        <circle cx="70" cy="24" r="4" />
        <path d="M70 11v5M70 32v5M57 24h5M78 24h5" />
      </g>
      <path className="pi-flow" d="M60 31v25M80 31v25" />
      <rect x="56" y="56" width="28" height="8" rx="2" />
      <path d="M18 31a8 8 0 0 1 16 0" />
      <path d="M17 31h18" />
      <circle cx="26" cy="34" r="4.5" />
      <path d="M26 38.5v13" />
      <path d="M26 51.5l-6 12M26 51.5l6 12" />
      <path d="M26 40l12 3" />
    </>
  );
}
function DoorsPlatformCabin() {
  return (
    <>
      <rect x="44" y="10" width="46" height="53" rx="2" />
      <rect className="pi-door-l" x="48" y="16" width="19" height="41" rx="1" />
      <rect className="pi-door-r" x="67" y="16" width="19" height="41" rx="1" />
      <path d="M18 31a8 8 0 0 1 16 0" />
      <path d="M17 31h18" />
      <circle cx="26" cy="34" r="4.5" />
      <path d="M26 38.5v13" />
      <path d="M26 51.5l-6 12M26 51.5l6 12" />
      <g className="pi-reach">
        <path d="M26 40l12-2" />
      </g>
    </>
  );
}
function WiringAndControls() {
  return (
    <>
      <rect x="52" y="10" width="38" height="34" rx="2" />
      <circle className="pi-lamp-1" cx="60" cy="19" r="2.5" />
      <circle className="pi-lamp-2" cx="60" cy="27" r="2.5" />
      <circle className="pi-lamp-3" cx="60" cy="35" r="2.5" />
      <path d="M68 19h16M68 27h16M68 35h16" />
      <path d="M71 44c0 10-10 7-10 19" />
      <path d="M18 31a8 8 0 0 1 16 0" />
      <path d="M17 31h18" />
      <circle cx="26" cy="34" r="4.5" />
      <path d="M26 38.5v13" />
      <path d="M26 51.5l-6 12M26 51.5l6 12" />
      <g className="pi-reach">
        <path d="M26 40l13-7" />
      </g>
    </>
  );
}
function FinalCommissioning() {
  return (
    <>
      <rect x="40" y="10" width="28" height="42" rx="2" />
      <path d="M54 10v42" />
      <circle cx="78" cy="54" r="11" />
      <path className="pi-tick" d="M73 54l3.5 3.5L84 49" />
      <path d="M18 31a8 8 0 0 1 16 0" />
      <path d="M17 31h18" />
      <circle cx="26" cy="34" r="4.5" />
      <path d="M26 38.5v13" />
      <path d="M26 51.5l-6 12M26 51.5l6 12" />
      <path d="M26 40l8 3" />
      <rect x="32" y="39" width="9" height="12" rx="1" />
    </>
  );
}

export const PHASES = {
  site: { Art: SiteAndTemplate, label: "Site and template" },
  rails: { Art: BracketsAndRails, label: "Brackets and rails" },
  roping: { Art: ShaftMotorRoping, label: "Shaft, motor, roping" },
  cabin: { Art: DoorsPlatformCabin, label: "Doors, platform, cabin" },
  wiring: { Art: WiringAndControls, label: "Wiring and controls" },
  commissioning: { Art: FinalCommissioning, label: "Final commissioning" },
};

export default function PhaseIcon({ phase, state = "locked", size = 96, title }) {
  const entry = PHASES[phase];
  if (!entry) return null;
  const { Art, label } = entry;
  const accessibleName = title ?? label;

  return (
    <span className={`pi pi--${state}`} style={{ width: size }}>
      <svg
        viewBox="0 0 96 80"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label={accessibleName}
      >
        <title>{accessibleName}</title>
        <Art />
      </svg>
    </span>
  );
}
