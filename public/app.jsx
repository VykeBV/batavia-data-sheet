// app.jsx — Editable product datasheet template.

const { useState, useEffect, useRef, useCallback } = React;

// ─── Defaults (editable via Tweaks; persisted to file on change) ──────────────
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "title": "BRUSHLESS COMBI DRILL",
  "subtitle": "18V Maxxpack Collection",
  "accent": "#FF8C00",
  "ratio": "10:10",
  "bleed": false,
  "specs": [
    {"icon": "voltage_18v_li_ion",   "text": "18 Volt Li-Ion"},
    {"icon": "torque_40nm",          "text": "75 Nm"},
    {"icon": "no_load_speed",        "text": "30.000 bpm"},
    {"icon": "powerful_motor_1020w", "text": "Brushless Motor"},
    {"icon": "keyless_chuck_13mm",   "text": "13 mm Keyless"}
  ],
  "qrUrl": "https://example.com/product",
  "qrLabel": "SCAN ME",
  "showTriangle": true,
  "showQr": true,
  "customIcons": []
}/*EDITMODE-END*/;

// ─── Editable text — click to edit inline ─────────────────────────────────────
function Editable({ value, onChange, className, style, multiline, placeholder }) {
  const ref = useRef(null);
  const onBlur = () => {
    const next = ref.current.innerText.trim();
    if (next !== value) onChange(next);
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      ref.current.blur();
    }
    if (e.key === "Escape") {
      ref.current.innerText = value;
      ref.current.blur();
    }
  };
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={`editable ${className || ""}`}
      style={style}
      data-placeholder={placeholder}
    >
      {value}
    </span>
  );
}

// ─── QR code (uses qrcode-generator loaded via CDN) ───────────────────────────
function QrCode({ url, size = 132, accent }) {
  const [matrix, setMatrix] = useState(null);

  useEffect(() => {
    if (!window.qrcode) return;
    try {
      // 'H' error correction (~30%) lets the centered logo overlay scan reliably.
      const qr = window.qrcode(0, "H");
      qr.addData(url || " ");
      qr.make();
      const n = qr.getModuleCount();
      const m = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
        m.push(row);
      }
      setMatrix(m);
    } catch (e) {
      console.warn("QR generation failed:", e);
      setMatrix(null);
    }
  }, [url]);

  if (!matrix) {
    return <div style={{ width: size, height: size, background: "#eee" }} />;
  }
  const n = matrix.length;
  // Carve a wider-than-tall clear area in the center for the Batavia mark
  const center = (n - 1) / 2;
  const clearW = Math.ceil(n * 0.18);   // half-width
  const clearH = Math.ceil(n * 0.085);  // half-height
  const isCleared = (r, c) =>
    Math.abs(r - center) <= clearH && Math.abs(c - center) <= clearW;

  // Batavia mark: two triangles from the corporate logo (V-pair).
  // Source viewBox: x 240.1..382.4, y 30.4..91.4 → normalize to local coords.
  const markVB = { x: 240.1, y: 30.4, w: 142.3, h: 61 };
  const markBoxW = clearW * 2;       // module units the mark fits in
  const markBoxH = clearH * 2;
  // Scale so the mark fits inside the cleared box, preserving aspect.
  const markScale = Math.min(markBoxW / markVB.w, markBoxH / markVB.h) * 0.78;
  const markW = markVB.w * markScale;
  const markH = markVB.h * markScale;
  const markX = center + 0.5 - markW / 2;
  const markY = center + 0.5 - markH / 2;
  // Translate each polygon's points into the local (mark) coord space.
  const xfPoints = (raw) =>
    raw.trim().split(/\s+/).map(pt => {
      const [px, py] = pt.split(",").map(Number);
      const lx = markX + (px - markVB.x) * markScale;
      const ly = markY + (py - markVB.y) * markScale;
      return `${lx.toFixed(3)},${ly.toFixed(3)}`;
    }).join(" ");

  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges">
      {matrix.map((row, r) =>
        row.map((d, c) =>
          d && !isCleared(r, c)
            ? <rect key={`${r}-${c}`} x={c} y={r} width="1.02" height="1.02" fill="#111" />
            : null
        )
      )}
      {/* White plate behind the centered logo */}
      <rect
        x={center - clearW + 0.5}
        y={center - clearH + 0.5}
        width={clearW * 2}
        height={clearH * 2}
        fill="#fff"
      />
      {/* Batavia mark — V (black) + slanted parallelogram (accent / orange) */}
      <polygon
        points={xfPoints("240.1,91.4 273.9,30.4 284,30.4 317.8,91.4")}
        fill="#111"
      />
      <polygon
        data-accent="1"
        points={xfPoints("304.7,30.4 382.4,30.4 348.6,91.4 338.5,91.4")}
        fill={accent || "#FF8C00"}
      />
    </svg>
  );
}

// ─── Icon picker popover ──────────────────────────────────────────────────────
const ICON_PROMPT =
  "Create a simple monochrome line-drawn SVG icon at 32×32 viewBox, " +
  "single-weight stroke (~2px) with stroke=\"currentColor\" and fill=\"none\", " +
  "rounded line-caps and joins, no shading or decoration, " +
  "centered with ~3px padding. " +
  "KEEP THE FILE SMALL: use minimum decimal precision (1 place max), " +
  "merge paths where possible, omit unnecessary attributes like xmlns:xlink, " +
  "id, class, data-*, style, inkscape:* / sodipodi:* / Adobe metadata, " +
  "and avoid filters, gradients, masks, or embedded fonts. " +
  "Aim for under 1 KB. Return ONLY the inline <svg>…</svg> markup. " +
  "Icon should represent: <YOUR CONCEPT>.";

function IconPicker({ value, onChange, anchor, onClose, customIcons, setCustomIcons }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const rect = anchor?.getBoundingClientRect();
  const PW = 320, PH = 380;
  const style = rect ? {
    position: "fixed",
    top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - PH - 8)),
    left: Math.max(8, Math.min(rect.left, window.innerWidth - PW - 8)),
  } : {};

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(ICON_PROMPT); }
    catch { /* clipboard API may be blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/svg/i.test(file.type) && !/\.svg$/i.test(file.name)) {
      alert("Please upload an SVG file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let svg = String(reader.result || "").trim();
      svg = svg.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/g, "").trim();
      svg = svg
        .replace(/\bfill="(?!none\b)[^"]*"/gi, 'fill="currentColor"')
        .replace(/\bstroke="(?!none\b)[^"]*"/gi, 'stroke="currentColor"');
      const key = "custom_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const label = file.name.replace(/\.svg$/i, "").slice(0, 16) || "Custom";
      const next = [...(customIcons || []), { key, label, svg }];
      setCustomIcons(next);
      onChange(key);
      onClose();
    };
    reader.readAsText(file);
  };

  const removeCustom = (key, e) => {
    e.stopPropagation();
    setCustomIcons((customIcons || []).filter(ic => ic.key !== key));
    if (value === key) onChange("gear");
  };

  // Portal to document.body so the .stage CSS transform doesn't change our
  // fixed-position containing block.
  return ReactDOM.createPortal(
    <div ref={ref} className="icon-picker" style={style}>
      <div className="icon-picker-hd">Choose icon</div>

      <div className="icon-picker-grid">
        {Object.entries(window.ICON_LIBRARY).map(([key, { label, svg }]) => (
          <button
            key={key}
            className={`icon-tile ${key === value ? "is-active" : ""}`}
            title={label}
            onClick={() => { onChange(key); onClose(); }}
          >
            <span className="icon-tile-svg" dangerouslySetInnerHTML={{ __html: svg }} />
            <span className="icon-tile-label">{label}</span>
          </button>
        ))}
        {(customIcons || []).map(({ key, label, svg }) => (
          <button
            key={key}
            className={`icon-tile is-custom ${key === value ? "is-active" : ""}`}
            title={label}
            onClick={() => { onChange(key); onClose(); }}
          >
            <span
              className="icon-tile-svg"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <span className="icon-tile-label">{label}</span>
            <span
              className="icon-tile-remove"
              title="Remove this icon"
              onClick={(e) => removeCustom(key, e)}
            >×</span>
          </button>
        ))}
        <button
          className="icon-tile icon-tile-add"
          title="Upload an SVG"
          onClick={() => fileRef.current?.click()}
        >
          <span className="icon-tile-svg">
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="16" y1="6" x2="16" y2="26" />
              <line x1="6" y1="16" x2="26" y2="16" />
            </svg>
          </span>
          <span className="icon-tile-label">Upload</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: "none" }}
          onChange={onPickFile}
        />
      </div>

      <div className="icon-picker-tip">
        <div className="icon-picker-tip-hd">
          <span>Generating your own icons?</span>
          <button className="icon-picker-copy" onClick={copyPrompt}>
            {copied ? "Copied ✓" : "Copy prompt"}
          </button>
        </div>
        <div className="icon-picker-tip-body">
          Use this prompt with Claude or another AI to get an icon that matches
          the Batavia style — then upload the resulting <code>.svg</code>.
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Spec row ─────────────────────────────────────────────────────────────────
function SpecRow({ spec, onChange, customIcons, setCustomIcons }) {
  const [picking, setPicking] = useState(false);
  const btnRef = useRef(null);
  const builtin = window.ICON_LIBRARY[spec.icon];
  const custom = builtin ? null : (customIcons || []).find(ic => ic.key === spec.icon);
  // Fallback: first icon in the library if neither builtin nor custom matches.
  const fallback = window.ICON_LIBRARY[Object.keys(window.ICON_LIBRARY)[0]];
  const svgHtml = (builtin || custom || fallback).svg;
  return (
    <div className="spec-row">
      <button
        ref={btnRef}
        className="spec-icon"
        onClick={() => setPicking(true)}
        title="Click to change icon"
      >
        <span
          style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </button>
      <Editable
        className="spec-text"
        value={spec.text}
        onChange={(text) => onChange({ ...spec, text })}
        placeholder="Specification"
      />
      {picking && (
        <IconPicker
          value={spec.icon}
          anchor={btnRef.current}
          onChange={(icon) => onChange({ ...spec, icon })}
          onClose={() => setPicking(false)}
          customIcons={customIcons}
          setCustomIcons={setCustomIcons}
        />
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
// ── Roboto font data for jsPDF embedding ──────────────────────────
//    jsPDF only ships Helvetica/Times/Courier. To get real Roboto in
//    the exported PDF (not a Helvetica substitution), we fetch the
//    static TTFs as base64 once, then attach them to every jsPDF
//    instance via addFileToVFS + addFont before drawing text.
let __robotoFontCache = null;
const __loadRobotoForPdf = async () => {
  if (__robotoFontCache) return __robotoFontCache;
  const fetchB64 = async (path) => {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error("Failed to load " + path + ": " + resp.status);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const [reg, black] = await Promise.all([
    fetchB64("fonts/Roboto-Regular.ttf"),
    fetchB64("fonts/Roboto-Black.ttf"),
  ]);
  __robotoFontCache = { reg, black };
  return __robotoFontCache;
};
const __registerRoboto = (pdf, fonts) => {
  pdf.addFileToVFS("Roboto-Regular.ttf", fonts.reg);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.addFileToVFS("Roboto-Black.ttf", fonts.black);
  pdf.addFont("Roboto-Black.ttf", "Roboto", "black");
};

// localStorage key. State shape: { pages: [...], activeIndex }.
// Pre-multi-page builds stored a single page object directly; we migrate on
// first load so existing in-browser work isn't lost.
const STORAGE_KEY = "batavia-datasheet-state-v1";
const loadInitialAppState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length) {
        return {
          pages: parsed.pages,
          activeIndex: Math.max(0, Math.min(parsed.activeIndex || 0, parsed.pages.length - 1)),
        };
      }
      // Old format: a single page object stored at the root.
      if (parsed && typeof parsed === "object" && parsed.title !== undefined) {
        return { pages: [{ ...DEFAULTS, ...parsed }], activeIndex: 0 };
      }
    }
  } catch (e) { /* ignore — fall through to defaults */ }
  return { pages: [{ ...DEFAULTS }], activeIndex: 0 };
};

function App() {
  // ── Multi-page state ────────────────────────────────────────────────
  //    pages[] holds the per-page tweak state; t is the active page.
  //    setTweak writes into the active page (existing call-sites unchanged).
  const [appState, setAppState] = useState(loadInitialAppState);
  const pages = appState.pages;
  const activeIndex = appState.activeIndex;
  const t = pages[activeIndex];

  const setTweak = useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === "object" && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setAppState(prev => {
      const newPages = prev.pages.slice();
      newPages[prev.activeIndex] = { ...newPages[prev.activeIndex], ...edits };
      return { ...prev, pages: newPages };
    });
    // Host-protocol echo (same as the original useTweaks).
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*"); } catch (e) {}
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }));
  }, []);

  const selectPage = useCallback((idx) => {
    setAppState(prev => ({ ...prev, activeIndex: idx }));
  }, []);

  const addPage = useCallback((opts = {}) => {
    setAppState(prev => {
      const source = opts.duplicate ? prev.pages[prev.activeIndex] : DEFAULTS;
      const newPage = JSON.parse(JSON.stringify(source));
      if (opts.duplicate) {
        newPage.title = `${(newPage.title || "Untitled").replace(/ \(Copy.*\)$/, "")} (Copy)`;
      } else {
        newPage.title = `PAGE ${prev.pages.length + 1}`;
      }
      return { pages: [...prev.pages, newPage], activeIndex: prev.pages.length };
    });
  }, []);

  const deletePage = useCallback((idx) => {
    setAppState(prev => {
      if (prev.pages.length <= 1) return prev;
      const newPages = prev.pages.filter((_, i) => i !== idx);
      let newIdx = prev.activeIndex;
      if (idx < newIdx) newIdx -= 1;
      else if (idx === newIdx) newIdx = Math.min(newIdx, newPages.length - 1);
      return { pages: newPages, activeIndex: newIdx };
    });
  }, []);

  // Autosave the full multi-page state on any change.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); } catch (e) { /* quota */ }
  }, [appState]);

  const isWide = t.ratio === "20:10";
  // 10×10 square fits ~5 specs in a single column; 20×10 wide fits up to 12
  // in a 3-row grid that flows into multiple columns.
  const MAX_SPECS = isWide ? 12 : 5;

  const setSpec = (idx, next) => {
    const specs = t.specs.slice();
    specs[idx] = next;
    setTweak("specs", specs);
  };

  const addSpec = () => {
    if (t.specs.length >= MAX_SPECS) return;
    // First key in the library is the default icon for new rows.
    const firstIcon = Object.keys(window.ICON_LIBRARY)[0] || "voltage_18v_li_ion";
    setTweak("specs", [...t.specs, { icon: firstIcon, text: "New spec" }]);
  };
  const removeSpec = (idx) => {
    if (t.specs.length <= 1) return;
    setTweak("specs", t.specs.filter((_, i) => i !== idx));
  };

  // ── CSV helpers ────────────────────────────────────────────────────
  // Single row = one datasheet. Columns:
  //   title, subtitle, ratio, accent, qrUrl, qrLabel, showTriangle, showQr,
  //   spec1_icon, spec1_text, spec2_icon, spec2_text, ... up to spec12_*
  const MAX_SPECS_CSV = 12;
  const stateToRow = (state) => {
    const row = {
      title: state.title || "",
      subtitle: state.subtitle || "",
      ratio: state.ratio || "10:10",
      accent: state.accent || "#FF8C00",
      qrUrl: state.qrUrl || "",
      qrLabel: state.qrLabel || "",
      showTriangle: state.showTriangle ? "1" : "0",
      showQr: state.showQr ? "1" : "0",
      bleed: state.bleed ? "1" : "0",
    };
    for (let i = 0; i < MAX_SPECS_CSV; i++) {
      const s = (state.specs || [])[i];
      row[`spec${i + 1}_icon`] = s ? s.icon : "";
      row[`spec${i + 1}_text`] = s ? s.text : "";
    }
    return row;
  };
  const rowToPartialState = (row) => {
    const specs = [];
    for (let i = 0; i < MAX_SPECS_CSV; i++) {
      const icon = (row[`spec${i + 1}_icon`] || "").trim();
      const text = (row[`spec${i + 1}_text`] || "").trim();
      if (icon || text) specs.push({ icon: icon || "gear", text });
    }
    const out = {};
    if (row.title != null) out.title = row.title;
    if (row.subtitle != null) out.subtitle = row.subtitle;
    if (row.ratio) out.ratio = row.ratio;
    if (row.accent) out.accent = row.accent;
    if (row.qrUrl != null) out.qrUrl = row.qrUrl;
    if (row.qrLabel != null) out.qrLabel = row.qrLabel;
    if (row.showTriangle != null) out.showTriangle = /^(1|true|yes)$/i.test(row.showTriangle);
    if (row.showQr != null) out.showQr = /^(1|true|yes)$/i.test(row.showQr);
    if (row.bleed != null) out.bleed = /^(1|true|yes)$/i.test(row.bleed);
    if (specs.length) out.specs = specs;
    return out;
  };
  const csvEscape = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const stateToCsv = (state) => {
    const row = stateToRow(state);
    const headers = Object.keys(row);
    return headers.join(",") + "\n" + headers.map(h => csvEscape(row[h])).join(",");
  };
  // Robust CSV row parser (handles quoted commas, escaped quotes, CRLF)
  const parseCsv = (text) => {
    const rows = [];
    let cur = "", row = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = false; }
        } else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { row.push(cur); cur = ""; }
        else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++;
          row.push(cur); rows.push(row); row = []; cur = "";
        } else cur += ch;
      }
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(c => (c || "").trim() !== ""))
      .map(r => {
        const o = {};
        headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
        return o;
      });
  };

  const exportCsv = useCallback(() => {
    const csv = stateToCsv(t);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (t.title || "datasheet").replace(/[^a-z0-9 \-_]/gi, "").trim() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }, [t]);

  const csvInputRef = useRef(null);

  // Import CSV — each row becomes a new page appended to the deck.
  // (Old single-row "replace current page" + the auto-export "Batch → PDF"
  // flows are merged into this one: load pages, let the user review and
  // edit, then click Export all when ready.)
  const importCsv = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        if (!rows.length) { alert("CSV had no data rows."); return; }
        const newPages = rows.map(row => ({ ...DEFAULTS, ...rowToPartialState(row) }));
        setAppState(prev => ({
          pages: [...prev.pages, ...newPages],
          activeIndex: prev.pages.length,  // jump to the first imported page
        }));
      } catch (e) {
        alert("Could not load CSV: " + e.message);
      }
    };
    reader.readAsText(file);
  }, []);

  const resetState = useCallback(() => {
    if (!window.confirm("Reset this page to the default datasheet?")) return;
    setTweak(DEFAULTS);
  }, [setTweak]);

  // ── Capture the .datasheet DOM into an existing jsPDF page ──────
  //    Reusable for single export, batch export, and any callers.
  //    Strategy: hide every coloured element from the bitmap, capture only
  //    paper + spec icon strokes; then overlay all text + QR + triangle as
  //    true CMYK vectors (orange = 0/45/100/0, black = 0/0/0/100).
  const captureCardIntoPdf = useCallback(async (pdf, state) => {
    const card = document.querySelector(".datasheet");
    if (!card) return false;
    // Embed Roboto into this PDF instance (cached after first load).
    try {
      const fonts = await __loadRobotoForPdf();
      __registerRoboto(pdf, fonts);
    } catch (e) {
      console.warn("Roboto font load failed; PDF will fall back to Helvetica", e);
    }
    const [w, h] = state.ratio.split(":").map(Number);
    // Bleed in cm (3 mm = 0.3 cm) added to each side of the trim box.
    const bleedCm = state.bleed ? 0.3 : 0;
    const pageW = w + 2 * bleedCm;
    const pageH = h + 2 * bleedCm;

    // ─── Elements ───────────────────────────────────────────────────
    const triangleEl   = card.querySelector(".ds-triangle");
    const titleEl      = card.querySelector(".ds-title");
    const subtitleEl   = card.querySelector(".ds-subtitle");
    const specTextEls  = [...card.querySelectorAll(".spec-text")];
    const specIconBtns = [...card.querySelectorAll(".spec-icon")];
    const qrSvg        = card.querySelector(".qr-frame svg");
    const qrLabelEl    = card.querySelector(".qr-label");
    const brackets     = [...card.querySelectorAll(".qr-bracket")];
    const cutLineEl    = card.querySelector(".cut-line");

    // ─── Measurements (BEFORE hiding anything) ──────────────────────
    // cardRect already includes the bleed-inclusive size; pageW/H map to it.
    const cardRect = card.getBoundingClientRect();
    const pxToCmX = pageW / cardRect.width;
    const pxToCmY = pageH / cardRect.height;
    const posOf = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: (r.left - cardRect.left) * pxToCmX,
        y: (r.top  - cardRect.top)  * pxToCmY,
        w: r.width  * pxToCmX,
        h: r.height * pxToCmY,
      };
    };
    const fontInfo = (el) => {
      const cs = getComputedStyle(el);
      const fontPx = parseFloat(cs.fontSize);
      return {
        cm: fontPx * pxToCmY,
        weight: parseInt(cs.fontWeight, 10) || 400,
        family: cs.fontFamily,
      };
    };
    const titleInfo     = titleEl ? { ...posOf(titleEl), font: fontInfo(titleEl), text: titleEl.innerText } : null;
    const subtitleInfo  = subtitleEl ? { ...posOf(subtitleEl), font: fontInfo(subtitleEl), text: subtitleEl.innerText } : null;
    const specTextInfos = specTextEls.map((el) => ({ ...posOf(el), font: fontInfo(el), text: el.innerText }));
    const specIconInfos = specIconBtns.map((btn) => {
      const svg = btn.querySelector("span > svg, svg");
      return svg ? { svg, ...posOf(btn) } : null;
    });
    const qrLabelInfo   = qrLabelEl ? { ...posOf(qrLabelEl), font: fontInfo(qrLabelEl), text: qrLabelEl.innerText } : null;
    const bracketsInfo  = brackets.map(posOf);
    const qrSvgInfo     = qrSvg ? { ...posOf(qrSvg), viewBox: qrSvg.getAttribute("viewBox") } : null;
    const qrChildren    = qrSvg ? [...qrSvg.children].map((el) => ({
      tag: el.tagName.toLowerCase(),
      fill: el.getAttribute("fill") || "",
      isAccent: el.getAttribute("data-accent") === "1",
      attrs: {
        x: el.getAttribute("x"), y: el.getAttribute("y"),
        width: el.getAttribute("width"), height: el.getAttribute("height"),
        points: el.getAttribute("points"),
      },
    })) : [];

    // ─── Hide everything we'll redraw as vector ─────────────────────
    // (Spec icons are kept visible — the new Batavia icon set uses filled
    // paths, and the SVG-to-jsPDF renderer only strokes, so we let
    // html2canvas capture them as bitmap instead of stroking outlines.)
    // The cut-line marker is on-screen guidance only; it must not print.
    const visEls = [
      triangleEl, titleEl, subtitleEl, ...specTextEls,
      qrSvg, qrLabelEl, ...brackets, cutLineEl,
    ].filter(Boolean);
    const prevVisMap = new Map();
    visEls.forEach((el) => {
      prevVisMap.set(el, el.style.visibility);
      el.style.visibility = "hidden";
    });

    try {
      // ─── 1. Capture bitmap (just paper, white) ────────────────────
      const canvas = await window.html2canvas(card, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH, undefined, "FAST");

      // CMYK setters (jsPDF expects 0–1)
      const isBlackAccent = state.accent === "#000000";
      const setOrangeFill = () => isBlackAccent
        ? pdf.setFillColor(0, 0, 0, 1)
        : pdf.setFillColor(0, 0.45, 1.0, 0);
      const setOrangeText = () => isBlackAccent
        ? pdf.setTextColor(0, 0, 0, 1)
        : pdf.setTextColor(0, 0.45, 1.0, 0);
      const setBlackFill = () => pdf.setFillColor(0, 0, 0, 1);
      const setBlackText = () => pdf.setTextColor(0, 0, 0, 1);
      const setBlackStroke = () => pdf.setDrawColor(0, 0, 0, 1);

      // ─── 2. Triangle (CMYK orange, full bleed-inclusive height) ──
      //       Extends to the page corners so the orange continues past
      //       the trim and survives the print shop's cut.
      if (state.showTriangle) {
        setOrangeFill();
        const tw = pageH * 0.4;
        pdf.triangle(pageW, 0, pageW, pageH, pageW - tw, pageH, "F");
      }

      // ─── 3. Title (CMYK black, Roboto Black) ──────────────────────
      if (titleInfo && titleInfo.text) {
        setBlackText();
        pdf.setFont("Roboto", "black");
        pdf.setFontSize(titleInfo.font.cm * 10 * 2.83465);
        const baselineCm = titleInfo.y + titleInfo.font.cm * 0.85;
        pdf.text(titleInfo.text, titleInfo.x, baselineCm);
      }

      // ─── 4. Subtitle (CMYK orange, Roboto Regular) ────────────────
      if (subtitleInfo && subtitleInfo.text) {
        setOrangeText();
        pdf.setFont("Roboto", "normal");
        pdf.setFontSize(subtitleInfo.font.cm * 10 * 2.83465);
        const baselineCm = subtitleInfo.y + subtitleInfo.font.cm * 0.9;
        pdf.text(subtitleInfo.text, subtitleInfo.x, baselineCm);
      }

      // ─── 5. Spec text rows (CMYK black, Roboto Regular) ───────────
      specTextInfos.forEach((info) => {
        if (!info.text) return;
        setBlackText();
        pdf.setFont("Roboto", "normal");
        pdf.setFontSize(info.font.cm * 10 * 2.83465);
        // Vertically centre on the row (icon height ~6mm)
        const baselineCm = info.y + info.font.cm * 0.9;
        pdf.text(info.text, info.x, baselineCm);
      });

      // ─── 6. Spec icons — captured in the bitmap above; no vector overlay
      //       (the new Batavia icon set uses filled paths, and an outline-
      //       only redraw would print the wrong shape).

      // ─── 7. QR rendering ──────────────────────────────────────────
      if (qrSvg && qrSvgInfo && qrChildren.length) {
        const vbParts = (qrSvgInfo.viewBox || "").trim().split(/\s+/).map(Number);
        const vbW = vbParts[2] || 1, vbH = vbParts[3] || 1;
        const qsx = qrSvgInfo.w / vbW, qsy = qrSvgInfo.h / vbH;
        const QT = (px, py) => [qrSvgInfo.x + px * qsx, qrSvgInfo.y + py * qsy];

        // 7a. Black matrix dots + black "V" polygon
        setBlackFill();
        qrChildren.forEach((c) => {
          if (c.tag === "rect" && c.fill === "#111") {
            const [rx, ry] = QT(+(c.attrs.x || 0), +(c.attrs.y || 0));
            pdf.rect(rx, ry, +c.attrs.width * qsx, +c.attrs.height * qsy, "F");
          } else if (c.tag === "polygon" && !c.isAccent && c.fill === "#111") {
            const nums = c.attrs.points.trim().split(/[\s,]+/).map(Number);
            const pts = [];
            for (let i = 0; i < nums.length; i += 2) pts.push(QT(nums[i], nums[i + 1]));
            for (let i = 1; i < pts.length - 1; i++) {
              pdf.triangle(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "F");
            }
          }
        });
        // 7b. Orange "V" accent polygon
        setOrangeFill();
        qrChildren.forEach((c) => {
          if (c.tag === "polygon" && c.isAccent) {
            const nums = c.attrs.points.trim().split(/[\s,]+/).map(Number);
            const pts = [];
            for (let i = 0; i < nums.length; i += 2) pts.push(QT(nums[i], nums[i + 1]));
            for (let i = 1; i < pts.length - 1; i++) {
              pdf.triangle(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "F");
            }
          }
        });
      }

      // ─── 8. QR brackets (CMYK orange L-shapes) ────────────────────
      setOrangeFill();
      brackets.forEach((br, i) => {
        const info = bracketsInfo[i];
        const cls = br.className;
        const stroke = 0.06;
        const x = info.x, y = info.y, bw = info.w, bh = info.h;
        if (cls.includes("qr-tl")) {
          pdf.rect(x, y, bw, stroke, "F"); pdf.rect(x, y, stroke, bh, "F");
        } else if (cls.includes("qr-tr")) {
          pdf.rect(x, y, bw, stroke, "F"); pdf.rect(x + bw - stroke, y, stroke, bh, "F");
        } else if (cls.includes("qr-bl")) {
          pdf.rect(x, y + bh - stroke, bw, stroke, "F"); pdf.rect(x, y, stroke, bh, "F");
        } else if (cls.includes("qr-br")) {
          pdf.rect(x, y + bh - stroke, bw, stroke, "F"); pdf.rect(x + bw - stroke, y, stroke, bh, "F");
        }
      });

      // ─── 9. QR label (CMYK black, Roboto Regular) ─────────────────
      if (qrLabelInfo && qrLabelInfo.text) {
        setBlackText();
        pdf.setFont("Roboto", "normal");
        pdf.setFontSize(qrLabelInfo.font.cm * 10 * 2.83465);
        const baselineCm = qrLabelInfo.y + qrLabelInfo.font.cm * 0.9;
        // Centre under the QR
        const textW = pdf.getTextWidth(qrLabelInfo.text);
        const cx = qrLabelInfo.x + (qrLabelInfo.w - textW) / 2;
        pdf.text(qrLabelInfo.text, cx, baselineCm);
      }

      return true;
    } finally {
      // Restore visibility
      prevVisMap.forEach((v, el) => { el.style.visibility = v; });
    }
  }, []);

  // Lightweight SVG path renderer (covers M/L/H/V/Q/C/Z; arcs approximated)
  const drawPath = useCallback((pdf, d, T, sx, sy, fill) => {
    if (!d) return;
    const cmds = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[+-]?\d+)?/g) || [];
    let cx = 0, cy = 0, startX = 0, startY = 0;
    let i = 0;
    const num = () => parseFloat(cmds[i++]);
    let cmd = "";
    const segments = [];
    let currentPath = [];
    const flushSubpath = () => {
      for (let k = 0; k < currentPath.length - 1; k++) {
        const a = currentPath[k], b = currentPath[k + 1];
        if (b.curve) {
          pdf.lines([[
            b.c1x - a.x, b.c1y - a.y,
            b.c2x - a.x, b.c2y - a.y,
            b.x - a.x,   b.y - a.y,
          ]], a.tx, a.ty, [1, 1], "S", false);
        } else {
          pdf.line(a.tx, a.ty, b.tx, b.ty);
        }
      }
    };
    const tcoord = (x, y) => T(x, y);
    while (i < cmds.length) {
      const tok = cmds[i];
      if (/^[a-zA-Z]$/.test(tok)) { cmd = tok; i++; }
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === "M") {
        const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0);
        if (currentPath.length) flushSubpath();
        const [tx, ty] = tcoord(x, y);
        currentPath = [{ x, y, tx, ty }];
        cx = x; cy = y; startX = x; startY = y;
        cmd = rel ? "l" : "L";
      } else if (C === "L") {
        const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0);
        const [tx, ty] = tcoord(x, y);
        currentPath.push({ x, y, tx, ty });
        cx = x; cy = y;
      } else if (C === "H") {
        const x = num() + (rel ? cx : 0);
        const [tx, ty] = tcoord(x, cy);
        currentPath.push({ x, y: cy, tx, ty });
        cx = x;
      } else if (C === "V") {
        const y = num() + (rel ? cy : 0);
        const [tx, ty] = tcoord(cx, y);
        currentPath.push({ x: cx, y, tx, ty });
        cy = y;
      } else if (C === "Q") {
        // Quadratic: approximate by cubic, 2 segments
        const qx = num() + (rel ? cx : 0), qy = num() + (rel ? cy : 0);
        const ex = num() + (rel ? cx : 0), ey = num() + (rel ? cy : 0);
        // Convert quadratic (P0, Q, P1) to cubic (P0, C1=P0+2/3(Q-P0), C2=P1+2/3(Q-P1), P1)
        const c1x = cx + (2/3) * (qx - cx), c1y = cy + (2/3) * (qy - cy);
        const c2x = ex + (2/3) * (qx - ex), c2y = ey + (2/3) * (qy - ey);
        const [tx, ty] = tcoord(ex, ey);
        const [tc1x, tc1y] = tcoord(c1x, c1y);
        const [tc2x, tc2y] = tcoord(c2x, c2y);
        currentPath.push({ x: ex, y: ey, tx, ty, curve: true, c1x: tc1x, c1y: tc1y, c2x: tc2x, c2y: tc2y });
        cx = ex; cy = ey;
      } else if (C === "T") {
        // Smooth quadratic: control = reflect previous Q control
        const ex = num() + (rel ? cx : 0), ey = num() + (rel ? cy : 0);
        const last = currentPath.at(-1);
        const prev = currentPath.at(-2);
        let qx = cx, qy = cy;
        if (last && last.curve && prev) {
          // Treat as reflection: not perfectly accurate for cubic, but works for line-art
          qx = 2 * cx - (last.c1x !== undefined ? prev.x + (last.c1x - prev.x) : cx);
          qy = 2 * cy - (last.c1y !== undefined ? prev.y + (last.c1y - prev.y) : cy);
        }
        const c1x = cx + (2/3) * (qx - cx), c1y = cy + (2/3) * (qy - cy);
        const c2x = ex + (2/3) * (qx - ex), c2y = ey + (2/3) * (qy - ey);
        const [tx, ty] = tcoord(ex, ey);
        const [tc1x, tc1y] = tcoord(c1x, c1y);
        const [tc2x, tc2y] = tcoord(c2x, c2y);
        currentPath.push({ x: ex, y: ey, tx, ty, curve: true, c1x: tc1x, c1y: tc1y, c2x: tc2x, c2y: tc2y });
        cx = ex; cy = ey;
      } else if (C === "C") {
        const c1xv = num() + (rel ? cx : 0), c1yv = num() + (rel ? cy : 0);
        const c2xv = num() + (rel ? cx : 0), c2yv = num() + (rel ? cy : 0);
        const ex = num() + (rel ? cx : 0), ey = num() + (rel ? cy : 0);
        const [tx, ty] = tcoord(ex, ey);
        const [tc1x, tc1y] = tcoord(c1xv, c1yv);
        const [tc2x, tc2y] = tcoord(c2xv, c2yv);
        currentPath.push({ x: ex, y: ey, tx, ty, curve: true, c1x: tc1x, c1y: tc1y, c2x: tc2x, c2y: tc2y });
        cx = ex; cy = ey;
      } else if (C === "Z") {
        if (currentPath.length) {
          const [tx, ty] = tcoord(startX, startY);
          currentPath.push({ x: startX, y: startY, tx, ty });
          cx = startX; cy = startY;
        }
      } else {
        // unknown — skip
        i++;
      }
    }
    if (currentPath.length) flushSubpath();
  }, []);

  // Snapshot of current state, kept in a ref so async batch loops read fresh.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // Wait for React to commit and html to paint (2 RAFs + extra for QR regen).
  const waitForRender = (extraMs = 200) =>
    new Promise(r => requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(r, extraMs))));

  const withStageNeutral = async (fn) => {
    const stage = document.querySelector(".stage");
    const card = document.querySelector(".datasheet");
    const prev = {
      stT: stage ? stage.style.transform : "",
      stW: stage ? stage.style.width : "",
      stH: stage ? stage.style.height : "",
      stZ: stage ? stage.style.zoom : "",
      cT: card ? card.style.transform : "",
      cO: card ? card.style.transformOrigin : "",
      cZ: card ? card.style.zoom : "",
    };
    if (stage) {
      stage.style.transform = "none";
      stage.style.width = "auto";
      stage.style.height = "auto";
      stage.style.zoom = "1";
    }
    if (card) {
      card.style.transform = "none";
      card.style.transformOrigin = "";
      card.style.zoom = "1";
    }
    try { return await fn(); }
    finally {
      if (stage) {
        stage.style.transform = prev.stT;
        stage.style.width = prev.stW;
        stage.style.height = prev.stH;
        stage.style.zoom = prev.stZ;
      }
      if (card) {
        card.style.transform = prev.cT;
        card.style.transformOrigin = prev.cO;
        card.style.zoom = prev.cZ;
      }
    }
  };

  // ── Download CURRENT state as a single-page PDF ─────────────────────
  const downloadPdf = useCallback(async () => {
    if (!window.html2canvas || !window.jspdf) {
      alert("PDF libraries are still loading—please try again in a moment.");
      return;
    }
    await withStageNeutral(async () => {
      try {
        const [w, h] = t.ratio.split(":").map(Number);
        const bleedCm = t.bleed ? 0.3 : 0;
        const pageW = w + 2 * bleedCm;
        const pageH = h + 2 * bleedCm;
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: pageW >= pageH ? "landscape" : "portrait",
          unit: "cm", format: [pageW, pageH], compress: true,
        });
        await captureCardIntoPdf(pdf, t);
        const safe = (t.title || "datasheet").replace(/[^a-z0-9 \-_]/gi, "").trim() || "datasheet";
        const bleedTag = t.bleed ? " bleed" : "";
        pdf.save(`${safe} (${w}x${h}cm${bleedTag}).pdf`);
      } catch (e) {
        console.error("PDF export failed:", e);
        alert("PDF export failed: " + (e?.message || e));
      }
    });
  }, [t, captureCardIntoPdf]);

  // Shared progress meter — used by CSV batch AND the in-app multi-page export.
  const [batchProgress, setBatchProgress] = useState(null);  // {i, n} | null

  // ── Export every page in the editor to one combined PDF ─────────────
  const exportAllPages = useCallback(async () => {
    if (!window.html2canvas || !window.jspdf) {
      alert("PDF libraries are still loading—please try again in a moment.");
      return;
    }
    if (pages.length === 0) return;
    const originalIndex = activeIndex;
    await withStageNeutral(async () => {
      try {
        const { jsPDF } = window.jspdf;
        let pdf = null;
        for (let i = 0; i < pages.length; i++) {
          setBatchProgress({ i: i + 1, n: pages.length });
          // Switch active page so the .datasheet DOM renders this page's state.
          setAppState(prev => ({ ...prev, activeIndex: i }));
          await waitForRender(280);
          const page = pages[i];
          const [w, h] = page.ratio.split(":").map(Number);
          const bleedCm = page.bleed ? 0.3 : 0;
          const pageW = w + 2 * bleedCm;
          const pageH = h + 2 * bleedCm;
          if (!pdf) {
            pdf = new jsPDF({
              orientation: pageW >= pageH ? "landscape" : "portrait",
              unit: "cm", format: [pageW, pageH], compress: true,
            });
          } else {
            pdf.addPage([pageW, pageH], pageW >= pageH ? "landscape" : "portrait");
          }
          await captureCardIntoPdf(pdf, page);
        }
        setAppState(prev => ({ ...prev, activeIndex: originalIndex }));
        setBatchProgress(null);
        if (pdf) pdf.save(`Datasheets (${pages.length} page${pages.length === 1 ? "" : "s"}).pdf`);
      } catch (e) {
        console.error("Multi-page export failed:", e);
        alert("Export failed: " + (e?.message || e));
        setBatchProgress(null);
        setAppState(prev => ({ ...prev, activeIndex: originalIndex }));
      }
    });
  }, [pages, activeIndex, captureCardIntoPdf]);

  // ── Auto-fit screen zoom so the cm-sized card is comfortably viewable ──
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  useEffect(() => {
    const fit = () => {
      const stage = stageRef.current;
      const card = cardRef.current;
      if (!stage || !card) return;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      // Desktop reserves a 320px right gutter for the Tweaks panel.
      // Mobile uses a fixed 30vh canvas viewport.
      const avW = isMobile ? window.innerWidth - 24 : window.innerWidth - 384;
      const avH = isMobile ? (window.innerHeight * 0.30 - 24) : (window.innerHeight - 48);
      const maxScale = isMobile ? 1.0 : 1.45;
      const cw = card.offsetWidth;
      const ch = card.offsetHeight;
      if (cw === 0 || ch === 0) return;
      const scale = Math.min(avW / cw, avH / ch, maxScale);
      if (isMobile) {
        // Mobile: stage is a fixed 30vh flex container (CSS); scale the card
        // via zoom so the layout reflects the scaled size and text stays
        // crisp (transform: scale on the stage was causing GPU-rasterised
        // blur during hover transitions on children).
        stage.style.transform = "";
        stage.style.width = "";
        stage.style.height = "";
        card.style.transform = "";
        card.style.transformOrigin = "";
        card.style.zoom = scale;
      } else {
        // Desktop: zoom on the stage. Unlike transform: scale this causes a
        // real layout pass so children rasterise at the final pixel size —
        // no blur, no hover-flicker. The layout box already matches the
        // visible card so flex centring works naturally.
        card.style.transform = "";
        card.style.transformOrigin = "";
        card.style.zoom = "";
        stage.style.transform = "";
        stage.style.width = "";
        stage.style.height = "";
        stage.style.zoom = scale;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (cardRef.current) ro.observe(cardRef.current);
    window.addEventListener("resize", fit);
    return () => { window.removeEventListener("resize", fit); ro.disconnect(); };
  }, [t.ratio]);

  return (
    <>
      <div className="stage" ref={stageRef}>
      <div
        className={`datasheet ${isWide ? "is-wide" : ""}`}
        style={{ "--accent": t.accent, "--bleed": t.bleed ? "3mm" : "0mm" }}
        ref={cardRef}
      >
        {t.bleed && <div className="cut-line" aria-hidden="true" />}
        <div className="ds-body">
          <div className="ds-header">
            <Editable
              className="ds-title"
              value={t.title}
              onChange={(v) => setTweak("title", v)}
              placeholder="PRODUCT NAME"
            />
            <Editable
              className="ds-subtitle"
              value={t.subtitle}
              onChange={(v) => setTweak("subtitle", v)}
              placeholder="Subtitle / collection"
            />
          </div>

          <div className="ds-main">
            <div className="ds-specs">
              {t.specs.map((spec, i) => (
                <div key={i} className="spec-wrap">
                  <SpecRow
                    spec={spec}
                    onChange={(next) => setSpec(i, next)}
                    customIcons={t.customIcons}
                    setCustomIcons={(v) => setTweak("customIcons", typeof v === "function" ? v(t.customIcons || []) : v)}
                  />
                  <button className="spec-remove" onClick={() => removeSpec(i)} title="Remove row">×</button>
                </div>
              ))}
              {t.specs.length < MAX_SPECS && (
                <button className="spec-add" onClick={addSpec}>+ Add spec</button>
              )}
            </div>
          </div>
        </div>

        {t.showQr && (
          <div className="ds-qr">
            <div className="qr-frame">
              <span className="qr-bracket qr-tl" />
              <span className="qr-bracket qr-tr" />
              <span className="qr-bracket qr-bl" />
              <span className="qr-bracket qr-br" />
              <QrCode url={t.qrUrl} size={132} accent={t.accent} />
            </div>
            <Editable
              className="qr-label"
              value={t.qrLabel}
              onChange={(v) => setTweak("qrLabel", v)}
              placeholder="SCAN ME"
            />
          </div>
        )}

        {t.showTriangle && (
          <svg
            className="ds-triangle"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points="100,0 100,100 0,100" fill={t.accent} />
          </svg>
        )}
      </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Pages" />
        <div className="page-list">
          {pages.map((page, i) => (
            <div key={i} className={`page-row ${i === activeIndex ? "is-active" : ""}`}>
              <button
                type="button"
                className="page-row-select"
                onClick={() => selectPage(i)}
                title={page.title || "Untitled"}
              >
                <span className="page-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="page-title">{page.title || "Untitled"}</span>
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  className="page-row-delete"
                  onClick={() => {
                    if (window.confirm(`Remove page ${i + 1}?`)) deletePage(i);
                  }}
                  title="Remove this page"
                >×</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <TweakButton secondary label="+ Add page" onClick={() => addPage()} />
          <TweakButton secondary label="Duplicate" onClick={() => addPage({ duplicate: true })} />
        </div>
        <TweakButton
          secondary
          label="Import CSV → pages"
          onClick={() => csvInputRef.current?.click()}
        />

        <TweakSection label="Format" />
        <TweakRadio
          label="Print size"
          value={t.ratio}
          options={[
            { value: "10:10", label: "10 × 10 cm" },
            { value: "20:10", label: "20 × 10 cm" },
          ]}
          onChange={(v) => setTweak("ratio", v)}
        />
        <TweakToggle
          label="Bleed (3 mm)"
          value={!!t.bleed}
          onChange={(v) => setTweak("bleed", v)}
        />

        <TweakSection label="Content" />
        <TweakText
          label="Title"
          value={t.title}
          onChange={(v) => setTweak("title", v)}
        />
        <TweakText
          label="Subtitle"
          value={t.subtitle}
          onChange={(v) => setTweak("subtitle", v)}
        />

        <TweakSection label="Accent" />
        <TweakColor
          label="Accent color"
          value={t.accent}
          options={["#FF8C00", "#000000"]}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakToggle
          label="Show corner triangle"
          value={t.showTriangle}
          onChange={(v) => setTweak("showTriangle", v)}
        />

        <TweakSection label="QR code" />
        <TweakToggle
          label="Show QR"
          value={t.showQr}
          onChange={(v) => setTweak("showQr", v)}
        />
        <TweakText
          label="QR link"
          value={t.qrUrl}
          onChange={(v) => setTweak("qrUrl", v)}
        />
        <TweakText
          label="QR label"
          value={t.qrLabel}
          onChange={(v) => setTweak("qrLabel", v)}
        />

        <TweakSection label="Export" />
        <TweakButton
          label={
            batchProgress
              ? `Generating page ${batchProgress.i} / ${batchProgress.n}…`
              : `Download as PDF (${t.ratio.replace(":", " × ")} cm${t.bleed ? " + 3 mm bleed" : ""})`
          }
          onClick={downloadPdf}
        />
        {pages.length > 1 && (
          <TweakButton
            label={
              batchProgress
                ? `Exporting page ${batchProgress.i} / ${batchProgress.n}…`
                : `Export all ${pages.length} pages as PDF`
            }
            onClick={exportAllPages}
          />
        )}
        <TweakButton label="Export CSV" onClick={exportCsv} secondary />
        <TweakButton label="Reset to defaults" onClick={resetState} secondary />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) importCsv(f);
          }}
        />

        <TweakSection label="Tip" />
        <div className="twk-tip">
          Click any <b>icon</b> to swap it or upload your own.<br/>
          Click any <b>text</b> to edit it.<br/>
          Hover a spec row to remove it.<br/>
          Use <b>Pages</b> to build multi-page sets — <b>Export all</b> packs them into one PDF.
        </div>
        <div className="twk-autosave">✓ Auto-saved in this browser</div>

        <div className="twk-footer">powered by Xafai</div>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
