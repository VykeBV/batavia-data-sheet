// app.jsx — Editable product datasheet template.

const { useState, useEffect, useRef, useCallback } = React;

// ─── Defaults (editable via Tweaks; persisted to file on change) ──────────────
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "title": "",
  "subtitle": "",
  "accent": "#FF8C00",
  "ratio": "10:10",
  "bleed": false,
  "specs": [
    {"icon": "_blank", "text": ""},
    {"icon": "_blank", "text": ""},
    {"icon": "_blank", "text": ""}
  ],
  "qrUrl": "https://example.com",
  "qrLabel": "SCAN ME",
  "showTriangle": true,
  "showQr": true
  /* customIcons is shared across every page, so it lives on appState
     (not in DEFAULTS / per-page). The pre-multi-page builds stored it
     here; the migration code in loadInitialAppState hoists those out. */
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
  const searchRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDown);
    // Auto-focus the search input
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const rect = anchor?.getBoundingClientRect();
  const PW = 320, PH = 480;
  const style = rect ? {
    position: "fixed",
    top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - PH - 8)),
    left: Math.max(8, Math.min(rect.left, window.innerWidth - PW - 8)),
  } : {};

  // Group the built-in library by category, filtered by the search query.
  const q = query.trim().toLowerCase();
  const allEntries = Object.entries(window.ICON_LIBRARY || {});
  const matches = q
    ? allEntries.filter(([key, ic]) =>
        key.toLowerCase().includes(q) || (ic.label || "").toLowerCase().includes(q))
    : allEntries;
  // The placeholder icon ('No icon') gets its own pinned group at the top.
  const placeholderEntry = matches.find(([key]) => key === "_blank");
  const groups = (window.ICON_CATEGORIES || []).map(cat => ({
    id: cat.id,
    label: cat.label,
    items: matches.filter(([_, ic]) => ic.category === cat.id),
  })).filter(g => g.items.length > 0);
  // Other uncategorised built-ins fall under a final 'Other' group (the
  // placeholder is rendered separately above).
  const uncategorised = matches.filter(([key, ic]) => !ic.category && key !== "_blank");
  const customMatches = q
    ? (customIcons || []).filter(c =>
        (c.key || "").toLowerCase().includes(q) || (c.label || "").toLowerCase().includes(q))
    : (customIcons || []);

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(ICON_PROMPT); }
    catch { /* clipboard API may be blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // Normalise any pasted/uploaded SVG so it plays nicely with the
  // datasheet: strip outer dimensions / style (e.g. Flaticon's
  // width="512" height="512"), replace every colour with currentColor
  // so the icon picks up the spec-row colour, and clean up empty
  // <g></g> wrappers that Flaticon's exports sprinkle in.
  const normalizeSvgCode = (raw) => {
    let svg = String(raw || "").trim();
    if (!svg) return "";
    // Drop XML / DOCTYPE prologues.
    svg = svg.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/g, "").trim();
    // Strip layout-poisoning attrs on the OUTER <svg> only — let CSS size.
    svg = svg.replace(/<svg\b([^>]*)>/i, (_, attrs) => {
      const cleaned = attrs
        .replace(/\s+(width|height|enable-background)="[^"]*"/gi, "")
        .replace(/\s+style="[^"]*"/gi, "")
        .replace(/\s+id="[^"]*"/gi, "")
        .replace(/\s+xml:space="[^"]*"/gi, "")
        .replace(/\s+version="[^"]*"/gi, "")
        .replace(/\s+x="[^"]*"/gi, "")
        .replace(/\s+y="[^"]*"/gi, "");
      return `<svg${cleaned}>`;
    });
    // Colour normalisation — attributes.
    svg = svg.replace(/\bfill="(?!none\b|currentColor\b)[^"]*"/gi, 'fill="currentColor"');
    svg = svg.replace(/\bstroke="(?!none\b|currentColor\b)[^"]*"/gi, 'stroke="currentColor"');
    // Colour normalisation — inline styles.
    svg = svg.replace(/fill\s*:\s*(?!none|currentColor)[^;"]+/gi, "fill:currentColor");
    svg = svg.replace(/stroke\s*:\s*(?!none|currentColor)[^;"]+/gi, "stroke:currentColor");
    // Strip empty wrapper groups (Flaticon dumps many).
    let prev;
    do { prev = svg; svg = svg.replace(/<g\s*>\s*<\/g>/g, ""); } while (svg !== prev);
    return svg.trim();
  };

  const addCustomIcon = (rawSvg, labelHint) => {
    const svg = normalizeSvgCode(rawSvg);
    if (!svg || !/<svg\b/i.test(svg)) {
      alert("That doesn't look like valid SVG markup. Paste the full <svg>…</svg> block.");
      return false;
    }
    const key = "custom_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const label = (labelHint || "Custom").slice(0, 18);
    setCustomIcons([...(customIcons || []), { key, label, svg }]);
    onChange(key);
    onClose();
    return true;
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
      addCustomIcon(String(reader.result || ""), file.name.replace(/\.svg$/i, ""));
    };
    reader.readAsText(file);
  };

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const pasteRef = useRef(null);
  const onAddPasted = () => {
    if (addCustomIcon(pasteText, "Pasted")) {
      setPasteText("");
      setPasteOpen(false);
    }
  };

  const removeCustom = (key, e) => {
    e.stopPropagation();
    setCustomIcons((customIcons || []).filter(ic => ic.key !== key));
    if (value === key) onChange("gear");
  };

  // Portal to document.body so the .stage CSS transform doesn't change our
  // fixed-position containing block.
  const renderTile = (key, ic, isCustom = false) => (
    <button
      key={key}
      className={`icon-tile ${isCustom ? "is-custom " : ""}${key === value ? "is-active" : ""}`}
      title={ic.label || key}
      onClick={() => { onChange(key); onClose(); }}
    >
      <span className="icon-tile-svg" dangerouslySetInnerHTML={{ __html: ic.svg }} />
      <span className="icon-tile-label">{ic.label || key}</span>
      {isCustom && (
        <span
          className="icon-tile-remove"
          title="Remove this icon"
          onClick={(e) => removeCustom(key, e)}
        >×</span>
      )}
    </button>
  );

  const totalMatches = groups.reduce((n, g) => n + g.items.length, 0) + uncategorised.length + customMatches.length;

  return ReactDOM.createPortal(
    <div ref={ref} className="icon-picker" style={style}>
      <div className="icon-picker-hd">Choose icon</div>
      <div className="icon-picker-search">
        <input
          ref={searchRef}
          type="text"
          className="icon-picker-search-field"
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="icon-picker-search-clear" onClick={() => setQuery("")} title="Clear">×</button>
        )}
      </div>

      <div className="icon-picker-scroll">
        {totalMatches === 0 && !placeholderEntry && (
          <div className="icon-picker-empty">No icons match "{query}". Try a different term, or upload your own below.</div>
        )}

        {placeholderEntry && (
          <div className="icon-picker-group">
            <div className="icon-picker-group-hd">Placeholder</div>
            <div className="icon-picker-grid">
              {renderTile(placeholderEntry[0], placeholderEntry[1])}
            </div>
          </div>
        )}

        {customMatches.length > 0 && (
          <div className="icon-picker-group">
            <div className="icon-picker-group-hd">Your icons</div>
            <div className="icon-picker-grid">
              {customMatches.map(c => renderTile(c.key, c, true))}
            </div>
          </div>
        )}

        {groups.map(g => (
          <div key={g.id} className="icon-picker-group">
            <div className="icon-picker-group-hd">{g.label}</div>
            <div className="icon-picker-grid">
              {g.items.map(([key, ic]) => renderTile(key, ic))}
            </div>
          </div>
        ))}

        {uncategorised.length > 0 && (
          <div className="icon-picker-group">
            <div className="icon-picker-group-hd">Other</div>
            <div className="icon-picker-grid">
              {uncategorised.map(([key, ic]) => renderTile(key, ic))}
            </div>
          </div>
        )}

        <div className="icon-picker-group">
          <div className="icon-picker-group-hd">Add custom</div>
          <div className="icon-picker-grid">
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
              <span className="icon-tile-label">Upload SVG</span>
            </button>
            <button
              className="icon-tile icon-tile-add"
              title="Paste raw SVG code (e.g. from Flaticon)"
              onClick={() => {
                setPasteOpen((v) => !v);
                setTimeout(() => pasteRef.current?.focus(), 0);
              }}
            >
              <span className="icon-tile-svg">
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="10" y="4" width="12" height="4" rx="1.2" />
                  <path d="M22 6 h3 a2 2 0 0 1 2 2 v18 a2 2 0 0 1 -2 2 H7 a2 2 0 0 1 -2 -2 V8 a2 2 0 0 1 2 -2 h3" />
                  <line x1="10" y1="15" x2="22" y2="15" />
                  <line x1="10" y1="20" x2="19" y2="20" />
                </svg>
              </span>
              <span className="icon-tile-label">Paste SVG</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".svg,image/svg+xml"
              style={{ display: "none" }}
              onChange={onPickFile}
            />
          </div>
          {pasteOpen && (
            <div className="icon-picker-paste">
              <textarea
                ref={pasteRef}
                className="icon-picker-paste-field"
                placeholder="Paste full <svg>…</svg> markup here. Colours and width / height get normalised automatically."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                spellCheck={false}
                rows={5}
              />
              <div className="icon-picker-paste-actions">
                <button
                  type="button"
                  className="icon-picker-paste-cancel"
                  onClick={() => { setPasteOpen(false); setPasteText(""); }}
                >Cancel</button>
                <button
                  type="button"
                  className="icon-picker-paste-add"
                  onClick={onAddPasted}
                  disabled={!pasteText.trim()}
                >Add icon</button>
              </div>
            </div>
          )}
        </div>
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
        placeholder="Icon text"
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
// ── Roboto fonts parsed via opentype.js for vector-outline PDF text ──
//    Earlier we let jsPDF embed Roboto TTFs and call pdf.text(). That
//    triggered three things print shops / Illustrator hated:
//      1. subset-font CMAP bugs in jsPDF 2.5.1 occasionally remapped
//         glyphs (the printed "M" came out as a thin slash)
//      2. the embedded subset uses a synthesised PostScript name
//         (e.g. "ABCDEF+Roboto-Regular"), so Illustrator sees a font
//         it doesn't know and reports it as missing even when Roboto
//         is installed locally
//      3. registering two styles under one family ("Roboto" normal +
//         "Roboto" black) made Illustrator collapse them into one
//         font dictionary
//    Outlining the text to vector paths sidesteps all of it: the PDF
//    contains shapes, not glyphs, so there's no font to be missing,
//    no subset to corrupt, and the printer / Illustrator both see
//    the exact path data.
let __robotoOpentypeCache = null;
const __loadRobotoForPdf = async () => {
  if (__robotoOpentypeCache) return __robotoOpentypeCache;
  if (!window.opentype) {
    throw new Error("opentype.js not loaded yet — wait for the page to settle and try again");
  }
  const [regBuf, blackBuf] = await Promise.all([
    fetch("fonts/Roboto-Regular.ttf").then(r => {
      if (!r.ok) throw new Error("Roboto-Regular.ttf " + r.status);
      return r.arrayBuffer();
    }),
    fetch("fonts/Roboto-Black.ttf").then(r => {
      if (!r.ok) throw new Error("Roboto-Black.ttf " + r.status);
      return r.arrayBuffer();
    }),
  ]);
  __robotoOpentypeCache = {
    regular: window.opentype.parse(regBuf),
    black:   window.opentype.parse(blackBuf),
  };
  return __robotoOpentypeCache;
};

// Draw outlined text into jsPDF as filled vector paths. Each glyph gets
// its OWN PDF subpath + fill operator — the previous build emitted one
// huge compound path across the whole text, and a printer RIP somewhere
// down the line was dropping a subpath of the 'M' glyph (the first stem
// stroke went missing on physical print even though on-screen looked
// fine). Per-glyph emission means the RIP only ever sees a single
// character's contours at a time. Glyph holes (O, B, D, e, o, etc.)
// still render correctly because each glyph's outer + counter contours
// land in the same fill, and TrueType outlines wind those opposite ways
// so non-zero filling produces rings.
// Coordinates are in cm; fontSizeCm is the desired text size; the caller
// must set the fill colour beforehand (CMYK supported by jsPDF).
// Returns the rendered advance width in cm for centre-alignment.
const __drawTextAsPaths = (pdf, text, xCm, yBaselineCm, fontSizeCm, font) => {
  if (!text || !font) return 0;
  const fontSizePt = fontSizeCm * 28.3465;
  const PT_TO_CM = 1 / 28.3465;
  const internal = pdf.internal;
  const sf = internal.scaleFactor;
  const pageH = internal.pageSize.getHeight();
  const xPdf = (uCm) => (uCm * sf).toFixed(3);
  const yPdf = (uCm) => ((pageH - uCm) * sf).toFixed(3);

  // Iterate the text codepoint-by-codepoint so each character becomes its
  // own discrete PDF fill. We track an x advance manually using opentype's
  // per-glyph advanceWidth so the layout matches what font.getPath() of
  // the full string would have produced (sans kerning, which the
  // datasheet doesn't depend on).
  let advanceX = 0;
  let stream = "";
  // Spread iterator handles surrogate pairs (rare for our content but safe).
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    const glyphAdvance = (glyph.advanceWidth / font.unitsPerEm) * fontSizePt;
    if (glyph.path && glyph.path.commands.length) {
      const path = glyph.getPath(advanceX, 0, fontSizePt);
      let lastX = 0, lastY = 0;
      for (const c of path.commands) {
        const ux = (px) => xCm + px * PT_TO_CM;
        const uy = (py) => yBaselineCm + py * PT_TO_CM;
        if (c.type === "M") {
          stream += `${xPdf(ux(c.x))} ${yPdf(uy(c.y))} m\n`;
          lastX = c.x; lastY = c.y;
        } else if (c.type === "L") {
          stream += `${xPdf(ux(c.x))} ${yPdf(uy(c.y))} l\n`;
          lastX = c.x; lastY = c.y;
        } else if (c.type === "C") {
          stream += `${xPdf(ux(c.x1))} ${yPdf(uy(c.y1))} `
                  + `${xPdf(ux(c.x2))} ${yPdf(uy(c.y2))} `
                  + `${xPdf(ux(c.x))}  ${yPdf(uy(c.y))} c\n`;
          lastX = c.x; lastY = c.y;
        } else if (c.type === "Q") {
          const c1x = lastX + (2 / 3) * (c.x1 - lastX);
          const c1y = lastY + (2 / 3) * (c.y1 - lastY);
          const c2x = c.x   + (2 / 3) * (c.x1 - c.x);
          const c2y = c.y   + (2 / 3) * (c.y1 - c.y);
          stream += `${xPdf(ux(c1x))} ${yPdf(uy(c1y))} `
                  + `${xPdf(ux(c2x))} ${yPdf(uy(c2y))} `
                  + `${xPdf(ux(c.x))}  ${yPdf(uy(c.y))} c\n`;
          lastX = c.x; lastY = c.y;
        } else if (c.type === "Z") {
          stream += "h\n";
        }
      }
      stream += "f\n"; // fill this glyph, then start the next one fresh
    }
    advanceX += glyphAdvance;
  }
  internal.write(stream);
  return advanceX * PT_TO_CM;
};

// localStorage key. State shape: { pages: [...], activeIndex }.
// Pre-multi-page builds stored a single page object directly; we migrate on
// first load so existing in-browser work isn't lost.
// Inject a placeholder icon into the library so brand-new specs render as
// a dashed empty box (a clear visual cue: "click to pick an icon") rather
// than guessing a real Batavia pictogram.
const PLACEHOLDER_ICON_KEY = "_blank";
if (typeof window !== "undefined" && window.ICON_LIBRARY && !window.ICON_LIBRARY[PLACEHOLDER_ICON_KEY]) {
  window.ICON_LIBRARY[PLACEHOLDER_ICON_KEY] = {
    category: null,
    label: "No icon",
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.4 2" '
      + 'stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/>'
      + '</svg>',
  };
}

const STORAGE_KEY = "batavia-datasheet-state-v1";

// Currently-supported print sizes. Any stored ratio that doesn't match
// one of these gets remapped to its modern equivalent on load so a
// stale localStorage entry (e.g. "20:9.5" from the pre-10×10 layout)
// can't poison the canvas/export size mismatch.
const VALID_RATIOS = ["10:10", "20:10"];
const sanitizeRatio = (r) => {
  if (typeof r === "string" && VALID_RATIOS.includes(r)) return r;
  if (typeof r === "string") {
    const w = parseFloat(r.split(":")[0]);
    if (w >= 20) return "20:10";  // 20:9.5, 20:9, etc. → 20:10
    if (w > 0)  return "10:10";   // 10:9.5, 10:9, etc. → 10:10
  }
  return DEFAULTS.ratio;
};
const sanitizePage = (p) => {
  if (!p || typeof p !== "object") return { ...DEFAULTS };
  // Strip any per-page customIcons left over from older builds — they're
  // shared across pages now and live on appState.customIcons. The caller
  // is responsible for hoisting them up before discarding.
  const { customIcons, ...rest } = p;
  return { ...DEFAULTS, ...rest, ratio: sanitizeRatio(rest.ratio) };
};

// Dedupe by .key. Returns a new array preserving the first occurrence of
// each key.
const dedupeIcons = (icons) => {
  const seen = new Set();
  const out = [];
  for (const ic of (icons || [])) {
    if (!ic || !ic.key || seen.has(ic.key)) continue;
    seen.add(ic.key); out.push(ic);
  }
  return out;
};

const loadInitialAppState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length) {
        // Collect customIcons from top-level (new shape) AND from any
        // page that still carries them from a pre-promotion save.
        const collected = [
          ...(parsed.customIcons || []),
          ...parsed.pages.flatMap(p => p?.customIcons || []),
        ];
        return {
          pages: parsed.pages.map(sanitizePage),
          activeIndex: Math.max(0, Math.min(parsed.activeIndex || 0, parsed.pages.length - 1)),
          customIcons: dedupeIcons(collected),
        };
      }
      // Old format: a single page object stored at the root.
      if (parsed && typeof parsed === "object" && parsed.title !== undefined) {
        return {
          pages: [sanitizePage(parsed)],
          activeIndex: 0,
          customIcons: dedupeIcons(parsed.customIcons),
        };
      }
    }
  } catch (e) { /* ignore — fall through to defaults */ }
  return { pages: [{ ...DEFAULTS }], activeIndex: 0, customIcons: [] };
};

function App() {
  // ── Multi-page state ────────────────────────────────────────────────
  //    pages[] holds the per-page tweak state; t is the active page.
  //    setTweak writes into the active page (existing call-sites unchanged).
  const [appState, setAppState] = useState(loadInitialAppState);
  const pages = appState.pages;
  const activeIndex = appState.activeIndex;
  const t = pages[activeIndex];
  // Shared library of user-uploaded / pasted icons, available on every page.
  const customIcons = appState.customIcons || [];
  const setCustomIcons = useCallback((updater) => {
    setAppState(prev => {
      const cur = prev.customIcons || [];
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, customIcons: dedupeIcons(next) };
    });
  }, []);

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
      return { ...prev, pages: [...prev.pages, newPage], activeIndex: prev.pages.length };
    });
  }, []);

  const deletePage = useCallback((idx) => {
    setAppState(prev => {
      if (prev.pages.length <= 1) return prev;
      const newPages = prev.pages.filter((_, i) => i !== idx);
      let newIdx = prev.activeIndex;
      if (idx < newIdx) newIdx -= 1;
      else if (idx === newIdx) newIdx = Math.min(newIdx, newPages.length - 1);
      return { ...prev, pages: newPages, activeIndex: newIdx };
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
    // New specs start with the placeholder icon — a clear "pick me" prompt.
    setTweak("specs", [...t.specs, { icon: PLACEHOLDER_ICON_KEY, text: "" }]);
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
    if (row.ratio) out.ratio = sanitizeRatio(row.ratio);
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
          ...prev,
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
    if (!window.confirm("Reset everything? This removes every page and clears all content. Your uploaded custom icons are kept.")) return;
    // Preserve the user's custom icon library — it's deliberately shared
    // across pages, so wiping it on 'reset to defaults' would be a nasty
    // surprise. localStorage is rewritten by the autosave effect.
    setAppState(prev => ({ pages: [{ ...DEFAULTS }], activeIndex: 0, customIcons: prev.customIcons || [] }));
  }, []);

  // ── Capture the .datasheet DOM into an existing jsPDF page ──────
  //    Reusable for single export, batch export, and any callers.
  //    Strategy: hide every coloured element from the bitmap, capture only
  //    paper + spec icon strokes; then overlay all text + QR + triangle as
  //    true CMYK vectors (orange = 0/45/100/0, black = 0/0/0/100).
  const captureCardIntoPdf = useCallback(async (pdf, state) => {
    const card = document.querySelector(".datasheet");
    if (!card) return false;
    // Parse the Roboto fonts once; we'll draw each text run as outlined
    // vector paths so the PDF never references a font (no missing-font
    // warnings in Illustrator, no glyph-subset bugs in print).
    let robotoFonts = null;
    try {
      robotoFonts = await __loadRobotoForPdf();
    } catch (e) {
      console.warn("Roboto outline fonts failed to load — text will be omitted", e);
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

      // ─── 3. Title (CMYK black, Roboto Black outlined) ─────────────
      if (titleInfo && titleInfo.text && robotoFonts) {
        setBlackFill();
        const baselineCm = titleInfo.y + titleInfo.font.cm * 0.85;
        __drawTextAsPaths(pdf, titleInfo.text, titleInfo.x, baselineCm,
                          titleInfo.font.cm, robotoFonts.black);
      }

      // ─── 4. Subtitle (CMYK orange, Roboto Regular outlined) ───────
      if (subtitleInfo && subtitleInfo.text && robotoFonts) {
        setOrangeFill();
        const baselineCm = subtitleInfo.y + subtitleInfo.font.cm * 0.9;
        __drawTextAsPaths(pdf, subtitleInfo.text, subtitleInfo.x, baselineCm,
                          subtitleInfo.font.cm, robotoFonts.regular);
      }

      // ─── 5. Spec text rows (CMYK black, Roboto Regular outlined) ─
      specTextInfos.forEach((info) => {
        if (!info.text || !robotoFonts) return;
        setBlackFill();
        const baselineCm = info.y + info.font.cm * 0.9;
        __drawTextAsPaths(pdf, info.text, info.x, baselineCm,
                          info.font.cm, robotoFonts.regular);
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

      // ─── 9. QR label (CMYK black, Roboto Regular outlined) ───────
      if (qrLabelInfo && qrLabelInfo.text && robotoFonts) {
        setBlackFill();
        const baselineCm = qrLabelInfo.y + qrLabelInfo.font.cm * 0.9;
        // Centre under the QR: measure the outlined width via the font's
        // own advance table (matches what __drawTextAsPaths will draw).
        const fontSizePt = qrLabelInfo.font.cm * 28.3465;
        const textWidthCm = robotoFonts.regular.getAdvanceWidth(qrLabelInfo.text, fontSizePt) / 28.3465;
        const cx = qrLabelInfo.x + (qrLabelInfo.w - textWidthCm) / 2;
        __drawTextAsPaths(pdf, qrLabelInfo.text, cx, baselineCm,
                          qrLabelInfo.font.cm, robotoFonts.regular);
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
      cW: card ? card.style.width : "",
      cH: card ? card.style.height : "",
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
      card.style.width = "";
      card.style.height = "";
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
        card.style.width = prev.cW;
        card.style.height = prev.cH;
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
      // Clear any inline sizing from a previous fit() pass FIRST — otherwise
      // offsetWidth keeps returning the previous run's pixel value and the
      // canvas appears stuck on the old ratio until the page reloads.
      card.style.width = "";
      card.style.height = "";
      card.style.transform = "";
      card.style.zoom = "";
      stage.style.zoom = "";
      stage.style.transform = "";
      stage.style.width = "";
      stage.style.height = "";
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
        // Mobile: stage is a fixed 30vh flex container with overflow: hidden
        // (CSS). Scale the card via transform — works in every browser
        // including iOS Safari inside Webflow's iframe, which has been
        // ignoring CSS `zoom` and letting the card render at full cm size.
        // Explicit width/height in px set the layout box so flex centring
        // computes against the unscaled box; the visible scaled card stays
        // centred inside the 30vh region.
        stage.style.transform = "";
        stage.style.width = "";
        stage.style.height = "";
        card.style.zoom = "";
        card.style.width = cw + "px";
        card.style.height = ch + "px";
        card.style.transformOrigin = "center";
        card.style.transform = `scale(${scale})`;
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
  }, [t.ratio, t.bleed]);

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
              placeholder="Title"
            />
            <Editable
              className="ds-subtitle"
              value={t.subtitle}
              onChange={(v) => setTweak("subtitle", v)}
              placeholder="Tag line"
            />
          </div>

          <div className="ds-main">
            <div className="ds-specs">
              {t.specs.map((spec, i) => (
                <div key={i} className="spec-wrap">
                  <SpecRow
                    spec={spec}
                    onChange={(next) => setSpec(i, next)}
                    customIcons={customIcons}
                    setCustomIcons={setCustomIcons}
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
