// icons.jsx — Library of swappable spec icons (Batavia-style).
// Each icon is a simple monochrome line-drawn SVG. Stroke uses currentColor
// so they recolor automatically.

const I = (children) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICON_LIBRARY = {
  // ── Power / electrical ────────────────────────────────────────────
  battery: { label: "Battery", svg: I(<>
    <rect x="3" y="9" width="23" height="14" rx="2" />
    <line x1="28.5" y1="13" x2="28.5" y2="19" />
    <path d="M15 12 L11 17 L16 17 L13 22" />
  </>) },
  voltage: { label: "Voltage", svg: I(
    <path d="M18 3 L7 18 L15 18 L13 29 L25 13 L17 13 Z" />
  ) },
  bolt: { label: "Power", svg: I(
    <path d="M18 3 L7 18 L15 18 L13 29 L25 13 L17 13 Z" />
  ) },
  motor: { label: "Motor", svg: I(<>
    <rect x="6" y="10" width="16" height="14" rx="1" />
    <rect x="22" y="13" width="4" height="8" />
    <line x1="9" y1="10" x2="9" y2="6" />
    <line x1="14" y1="10" x2="14" y2="6" />
    <line x1="19" y1="10" x2="19" y2="6" />
    <line x1="6" y1="24" x2="22" y2="24" />
    <line x1="4" y1="27" x2="24" y2="27" />
  </>) },
  brushless: { label: "Brushless", svg: I(<>
    <circle cx="16" cy="16" r="9" />
    <circle cx="16" cy="16" r="3" />
    <path d="M16 7 V11 M16 21 V25 M7 16 H11 M21 16 H25" />
  </>) },
  plug: { label: "Cordless", svg: I(<>
    <path d="M9 4 v6 M19 4 v6" />
    <path d="M6 10 L22 10 L22 16 a8 8 0 0 1 -16 0 Z" />
    <path d="M14 24 v4" />
  </>) },
  usbc: { label: "USB-C", svg: I(<>
    <rect x="6" y="10" width="20" height="12" rx="6" />
    <line x1="11" y1="14" x2="11" y2="18" />
    <line x1="21" y1="14" x2="21" y2="18" />
    <line x1="15" y1="13" x2="15" y2="19" />
    <line x1="17" y1="13" x2="17" y2="19" />
  </>) },

  // ── Drill / impact / saw ──────────────────────────────────────────
  torque: { label: "Torque", svg: I(<>
    <circle cx="11" cy="22" r="4" />
    <line x1="13.8" y1="19.2" x2="26" y2="7" />
    <line x1="22" y1="7" x2="26" y2="7" />
    <line x1="26" y1="7" x2="26" y2="11" />
  </>) },
  hammer: { label: "Hammer", svg: I(<>
    <path d="M6 12 L14 4 L22 12 L20 14 L17 11 L7 21 L4 18 Z" />
    <line x1="17" y1="14" x2="27" y2="24" />
    <line x1="14" y1="17" x2="24" y2="27" />
  </>) },
  chuck: { label: "Chuck", svg: I(<>
    <rect x="8" y="5" width="16" height="10" rx="1.5" />
    <path d="M9 15 L11 22 L21 22 L23 15" />
    <line x1="14" y1="22" x2="14" y2="27" />
    <line x1="18" y1="22" x2="18" y2="27" />
    <line x1="11" y1="27" x2="21" y2="27" />
  </>) },
  drill: { label: "Drill", svg: I(<>
    <path d="M6 8 L20 8 L20 18 L15 18 L15 24 L11 24 L11 18 L6 18 Z" />
    <line x1="20" y1="11" x2="28" y2="11" />
    <line x1="20" y1="15" x2="28" y2="15" />
    <line x1="11" y1="24" x2="11" y2="28" />
    <line x1="15" y1="24" x2="15" y2="28" />
  </>) },
  spindle_lock: { label: "Spindle lock", svg: I(<>
    <rect x="8" y="14" width="16" height="14" rx="2" />
    <path d="M11 14 V9 a5 5 0 0 1 10 0 V14" />
    <circle cx="16" cy="20" r="2" />
    <line x1="16" y1="22" x2="16" y2="25" />
  </>) },
  saw: { label: "Saw", svg: I(<>
    <path d="M3 14 L6 18 L9 14 L12 18 L15 14 L18 18 L21 14 L24 18 L27 14" />
    <path d="M3 14 L27 14 L27 22 L3 22 Z" />
    <line x1="22" y1="22" x2="22" y2="27" />
  </>) },
  saw_stroke: { label: "Saw stroke", svg: I(<>
    <line x1="16" y1="5" x2="16" y2="11" />
    <polyline points="13 8 16 5 19 8" />
    <line x1="16" y1="21" x2="16" y2="27" />
    <polyline points="13 24 16 27 19 24" />
    <rect x="11" y="12" width="10" height="8" />
  </>) },
  bevel: { label: "Bevel", svg: I(<>
    <polyline points="4 26 28 26" />
    <line x1="8" y1="26" x2="22" y2="6" />
    <path d="M11 26 a4 4 0 0 0 1.5 -3" />
  </>) },
  pendulum: { label: "Pendulum", svg: I(<>
    <line x1="16" y1="6" x2="16" y2="20" />
    <circle cx="16" cy="22" r="3" />
    <path d="M16 20 L10 14" /><circle cx="9" cy="13" r="1.4" />
    <path d="M16 20 L22 14" /><circle cx="23" cy="13" r="1.4" />
  </>) },
  nails: { label: "Nails", svg: I(<>
    <line x1="10" y1="4" x2="10" y2="22" />
    <polyline points="7 19 10 22 13 19" />
    <line x1="22" y1="4" x2="22" y2="14" />
    <polyline points="19 11 22 14 25 11" />
    <text x="2" y="29" fontSize="6" fill="currentColor" stroke="none">1″</text>
  </>) },
  stapler_len: { label: "Staple length", svg: I(<>
    <rect x="8" y="6" width="3" height="20" />
    <rect x="21" y="6" width="3" height="20" />
    <line x1="11" y1="16" x2="21" y2="16" />
    <polyline points="13 14 11 16 13 18" />
    <polyline points="19 14 21 16 19 18" />
  </>) },

  // ── Cutting / depth / dimensions ──────────────────────────────────
  cutting_depth: { label: "Cut depth", svg: I(<>
    <rect x="6" y="6" width="20" height="20" />
    <line x1="6" y1="14" x2="26" y2="14" />
    <line x1="6" y1="20" x2="26" y2="20" />
  </>) },
  ruler: { label: "Length", svg: I(<>
    <rect x="3" y="11" width="26" height="10" rx="1" />
    <line x1="8" y1="11" x2="8" y2="15" />
    <line x1="13" y1="11" x2="13" y2="17" />
    <line x1="18" y1="11" x2="18" y2="15" />
    <line x1="23" y1="11" x2="23" y2="17" />
  </>) },
  dimensions: { label: "Dimensions", svg: I(<>
    <line x1="4" y1="16" x2="28" y2="16" />
    <polyline points="7 13 4 16 7 19" />
    <polyline points="25 13 28 16 25 19" />
    <line x1="4" y1="10" x2="4" y2="22" />
    <line x1="28" y1="10" x2="28" y2="22" />
  </>) },
  sawing_capacity: { label: "Saw capacity", svg: I(<>
    <line x1="16" y1="4" x2="16" y2="22" />
    <polyline points="11 9 16 4 21 9" />
    <line x1="4" y1="26" x2="28" y2="26" />
  </>) },
  angle: { label: "Angle", svg: I(<>
    <polyline points="5 26 27 26" />
    <line x1="5" y1="26" x2="20" y2="9" />
    <path d="M11 26 a6 6 0 0 0 2 -4" />
  </>) },

  // ── Speed / rotation / fan ────────────────────────────────────────
  speed: { label: "Speed", svg: I(<>
    <path d="M4 22 A12 12 0 0 1 28 22" />
    <line x1="16" y1="22" x2="22" y2="11" />
    <circle cx="16" cy="22" r="1.5" fill="currentColor" />
  </>) },
  no_load: { label: "No-load speed", svg: I(<>
    <circle cx="16" cy="16" r="9" />
    <polyline points="16 9 16 16 21 19" />
    <path d="M22 7 L25 4 L25 8" />
  </>) },
  fan: { label: "Fan", svg: I(<>
    <circle cx="16" cy="16" r="2" />
    <path d="M16 14 C16 8 22 7 22 12 C22 16 16 18 16 14 Z" />
    <path d="M18 16 C24 16 25 22 20 22 C16 22 14 16 18 16 Z" />
    <path d="M16 18 C16 24 10 25 10 20 C10 16 16 14 16 18 Z" />
    <path d="M14 16 C8 16 7 10 12 10 C16 10 18 16 14 16 Z" />
  </>) },
  airflow: { label: "Airflow", svg: I(<>
    <path d="M4 10 Q10 6 16 10 T28 10" />
    <path d="M4 16 Q10 12 16 16 T28 16" />
    <path d="M4 22 Q10 18 16 22 T28 22" />
  </>) },
  airspeed: { label: "Air speed", svg: I(<>
    <circle cx="16" cy="16" r="11" />
    <line x1="16" y1="16" x2="22" y2="9" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    <line x1="16" y1="3" x2="16" y2="6" />
    <line x1="16" y1="26" x2="16" y2="29" />
  </>) },
  suction: { label: "Suction", svg: I(<>
    <path d="M4 22 C6 16 12 10 18 12 C22 13 25 16 26 22" />
    <ellipse cx="26" cy="22" rx="2.5" ry="3" />
  </>) },
  vacuum: { label: "Vacuum", svg: I(<>
    <circle cx="16" cy="16" r="10" />
    <rect x="14" y="3" width="4" height="6" rx="1" />
  </>) },

  // ── Containers / capacity ─────────────────────────────────────────
  dust_container: { label: "Dust container", svg: I(<>
    <rect x="6" y="9" width="20" height="18" rx="2" />
    <line x1="6" y1="13" x2="26" y2="13" />
    <line x1="13" y1="5" x2="19" y2="5" />
    <line x1="13" y1="5" x2="13" y2="9" />
    <line x1="19" y1="5" x2="19" y2="9" />
  </>) },
  magazine: { label: "Magazine", svg: I(<>
    <polyline points="4 12 4 4 12 4" />
    <polyline points="28 12 28 4 20 4" />
    <polyline points="4 20 4 28 12 28" />
    <polyline points="28 20 28 28 20 28" />
  </>) },
  weight: { label: "Weight", svg: I(<>
    <path d="M10 8 a3 3 0 1 1 6 0 a3 3 0 1 1 6 0" transform="translate(-1 0)" />
    <path d="M6 12 L26 12 L23 27 L9 27 Z" />
  </>) },

  // ── Light / temperature / display ─────────────────────────────────
  lightbulb: { label: "Light", svg: I(<>
    <path d="M11 19 a7 7 0 1 1 10 0 c-1 1 -1.5 2 -1.5 3 L12.5 22 c0 -1 -0.5 -2 -1.5 -3 Z" />
    <line x1="13" y1="25" x2="19" y2="25" />
    <line x1="14" y1="28" x2="18" y2="28" />
  </>) },
  led_light: { label: "LED light", svg: I(<>
    <path d="M11 19 a7 7 0 1 1 10 0 c-1 1 -1.5 2 -1.5 3 L12.5 22 c0 -1 -0.5 -2 -1.5 -3 Z" />
    <line x1="13" y1="25" x2="19" y2="25" />
    <line x1="16" y1="3" x2="16" y2="5" />
    <line x1="6" y1="13" x2="4" y2="13" />
    <line x1="26" y1="13" x2="28" y2="13" />
    <line x1="9" y1="6" x2="7" y2="4" />
    <line x1="23" y1="6" x2="25" y2="4" />
  </>) },
  thermometer: { label: "Temperature", svg: I(<>
    <path d="M14 4 a3 3 0 0 1 6 0 v17 a5 5 0 1 1 -6 0 Z" />
    <line x1="17" y1="10" x2="17" y2="22" />
  </>) },
  lcd: { label: "Digital display", svg: I(<>
    <rect x="4" y="9" width="24" height="14" rx="1" />
    <line x1="9" y1="14" x2="13" y2="14" />
    <line x1="11" y1="13" x2="11" y2="19" />
    <line x1="9" y1="19" x2="13" y2="19" />
    <line x1="17" y1="14" x2="21" y2="14" />
    <line x1="17" y1="14" x2="17" y2="19" />
    <line x1="17" y1="19" x2="21" y2="19" />
    <line x1="23" y1="14" x2="23" y2="19" />
  </>) },
  settings: { label: "Settings", svg: I(<>
    <line x1="4" y1="9" x2="28" y2="9" /><circle cx="11" cy="9" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="16" x2="28" y2="16" /><circle cx="20" cy="16" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="23" x2="28" y2="23" /><circle cx="14" cy="23" r="2" fill="currentColor" stroke="none" />
  </>) },

  // ── Safety / cable / filters ──────────────────────────────────────
  shield: { label: "Safety", svg: I(<>
    <path d="M16 3 L27 7 L27 17 C27 23 22 27 16 29 C10 27 5 23 5 17 L5 7 Z" />
    <path d="M11 16 L15 20 L21 12" />
  </>) },
  cable: { label: "Cable length", svg: I(<>
    <circle cx="6" cy="6" r="2" />
    <path d="M8 6 C16 6 8 16 16 16 C24 16 16 26 24 26" />
    <line x1="22" y1="24" x2="26" y2="26" />
    <line x1="26" y1="26" x2="24" y2="28" />
  </>) },
  hepa: { label: "HEPA filter", svg: I(<>
    <rect x="5" y="6" width="22" height="20" />
    <line x1="9" y1="6" x2="9" y2="26" />
    <line x1="13" y1="6" x2="13" y2="26" />
    <line x1="17" y1="6" x2="17" y2="26" />
    <line x1="21" y1="6" x2="21" y2="26" />
    <line x1="25" y1="6" x2="25" y2="26" />
  </>) },
  clock: { label: "Runtime", svg: I(<>
    <circle cx="16" cy="17" r="11" />
    <path d="M16 11 v6 L20 20" />
    <line x1="13" y1="3" x2="19" y2="3" />
  </>) },
  wrench: { label: "Wrench", svg: I(
    <path d="M22 4 a6 6 0 0 0 -6 9 L5 24 a2 2 0 0 0 3 3 L19 16 a6 6 0 0 0 9 -6 L24 14 L22 12 L20 10 Z" />
  ) },

  // ── Sanding / vibration ───────────────────────────────────────────
  vibration: { label: "Anti-vibration", svg: I(<>
    <polyline points="4 16 8 10 12 22 16 10 20 22 24 10 28 16" />
  </>) },
  sanding: { label: "Sanding pad", svg: I(<>
    <ellipse cx="16" cy="20" rx="11" ry="3" />
    <path d="M5 20 L8 9 L24 9 L27 20" />
  </>) },
  pad_size: { label: "Pad size", svg: I(<>
    <circle cx="16" cy="16" r="10" />
    <line x1="6" y1="16" x2="26" y2="16" />
  </>) },

  // ── Generic / misc ────────────────────────────────────────────────
  gear: { label: "Gear", svg: I(<>
    <circle cx="16" cy="16" r="4" />
    <path d="M16 4 v4 M16 24 v4 M4 16 h4 M24 16 h4 M7.5 7.5 l2.8 2.8 M21.7 21.7 l2.8 2.8 M7.5 24.5 l2.8 -2.8 M21.7 10.3 l2.8 -2.8" />
  </>) },
};

window.ICON_LIBRARY = ICON_LIBRARY;
