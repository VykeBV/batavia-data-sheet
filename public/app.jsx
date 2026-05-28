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
          <div className="icon-picker-empty">No icons match "{query}". Try a different term, or upload your own.</div>
        )}

        {/* Custom-icon entry points sit at the top of the picker so the
            user doesn't have to scroll past every Batavia category to add
            their own. The pasted-code textarea unfurls in place. */}
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

// Render a live SVG element into the PDF as filled vector paths, fitted
// into the given rectangle (cm). Walks the SVG tree once, composes any
// matrix/translate/scale/rotate transforms on parent <g>s, parses every
// <path d="…"> (with full M/L/H/V/C/S/Q/T/A/Z, absolute + relative
// support), expands shape elements (<rect>, <circle>, <ellipse>,
// <polygon>, <polyline>) into path commands, then emits jsPDF raw
// stream operators (m/l/c/h/f) so the output is real vector geometry
// — Illustrator can edit it and the printer RIP rasterises it at the
// output device's resolution rather than at the bitmap's fixed PNG
// resolution. Paths with fill="none" (the dashed placeholder marker)
// are skipped so they don't ghost into the final PDF.
const __drawSvgIconAsPaths = (pdf, svgEl, rectCm) => {
  const vbParts = (svgEl.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number);
  if (vbParts.length !== 4) return;
  const [vbX, vbY, vbW, vbH] = vbParts;
  if (!vbW || !vbH) return;

  // preserveAspectRatio defaults to xMidYMid meet — fit-and-centre.
  const scale = Math.min(rectCm.w / vbW, rectCm.h / vbH);
  const offsetX = rectCm.x + (rectCm.w - vbW * scale) / 2;
  const offsetY = rectCm.y + (rectCm.h - vbH * scale) / 2;

  const sf = pdf.internal.scaleFactor;
  const pageH = pdf.internal.pageSize.getHeight();
  const xPdf = (cm) => (cm * sf).toFixed(3);
  const yPdf = (cm) => ((pageH - cm) * sf).toFixed(3);
  const toCmXY = (px, py) => [
    offsetX + (px - vbX) * scale,
    offsetY + (py - vbY) * scale,
  ];

  // SVG transform = 2×3 matrix in [a, b, c, d, e, f] order.
  const matMul = (A, B) => [
    A[0]*B[0] + A[2]*B[1],
    A[1]*B[0] + A[3]*B[1],
    A[0]*B[2] + A[2]*B[3],
    A[1]*B[2] + A[3]*B[3],
    A[0]*B[4] + A[2]*B[5] + A[4],
    A[1]*B[4] + A[3]*B[5] + A[5],
  ];
  const apply = (T, x, y) => [T[0]*x + T[2]*y + T[4], T[1]*x + T[3]*y + T[5]];

  const parseTransform = (s) => {
    if (!s) return null;
    let T = null;
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const fn = m[1];
      const nums = m[2].split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      let local = null;
      if (fn === "matrix" && nums.length >= 6) {
        local = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
      } else if (fn === "translate") {
        local = [1, 0, 0, 1, nums[0] || 0, nums[1] || 0];
      } else if (fn === "scale") {
        const sx = nums[0] || 1;
        const sy = nums.length > 1 ? nums[1] : sx;
        local = [sx, 0, 0, sy, 0, 0];
      } else if (fn === "rotate") {
        const a = (nums[0] || 0) * Math.PI / 180;
        const ca = Math.cos(a), sa = Math.sin(a);
        if (nums.length >= 3) {
          const cx = nums[1], cy = nums[2];
          local = matMul([1, 0, 0, 1, cx, cy],
                  matMul([ca, sa, -sa, ca, 0, 0],
                         [1, 0, 0, 1, -cx, -cy]));
        } else {
          local = [ca, sa, -sa, ca, 0, 0];
        }
      } else if (fn === "skewX") {
        local = [1, 0, Math.tan((nums[0] || 0) * Math.PI / 180), 1, 0, 0];
      } else if (fn === "skewY") {
        local = [1, Math.tan((nums[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      }
      if (local) T = T ? matMul(T, local) : local;
    }
    return T;
  };

  // d-attribute → token list. Numbers can run together ("1.2-3.4" is two
  // numbers; "-.5.6" is "-.5" and ".6") so the regex matches one number
  // at a time including optional sign and exponent.
  const parsePathD = (d) => {
    const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.\d+(?:[eE][-+]?\d+)?|-?\d+(?:[eE][-+]?\d+)?)/g;
    const tokens = [];
    let m;
    while ((m = re.exec(d)) !== null) {
      if (m[1]) tokens.push({ kind: "cmd", v: m[1] });
      else tokens.push({ kind: "num", v: parseFloat(m[2]) });
    }
    const argCounts = { M:2, L:2, H:1, V:1, C:6, S:4, Q:4, T:2, A:7, Z:0 };
    const cmds = [];
    let i = 0;
    let prevCmd = null;
    while (i < tokens.length) {
      let cmd;
      if (tokens[i].kind === "cmd") {
        cmd = tokens[i].v;
        i++;
      } else {
        if (!prevCmd) break;
        // Implicit-repeat rule: after M/m, repeats become L/l; otherwise same.
        cmd = prevCmd === "M" ? "L" : prevCmd === "m" ? "l" : prevCmd;
      }
      const n = argCounts[cmd.toUpperCase()];
      if (n === 0) {
        cmds.push({ c: cmd, a: [] });
      } else {
        const args = [];
        for (let j = 0; j < n; j++) {
          if (i >= tokens.length || tokens[i].kind !== "num") return cmds;
          args.push(tokens[i].v);
          i++;
        }
        cmds.push({ c: cmd, a: args });
      }
      prevCmd = cmd;
    }
    return cmds;
  };

  // Elliptical arc → list of cubic bezier segments (≤ 90° each).
  // Endpoint-to-centre parametrisation, then split by arcs of ≤π/2.
  const arcToCubics = (x1, y1, rx, ry, phi, fa, fs, x2, y2) => {
    if (x1 === x2 && y1 === y2) return [];
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (rx === 0 || ry === 0) {
      return [{ x1, y1, x2: x2, y2: y2, x: x2, y: y2 }];
    }
    const sinPhi = Math.sin(phi * Math.PI / 180);
    const cosPhi = Math.cos(phi * Math.PI / 180);
    const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
    const x1p = cosPhi * dx2 + sinPhi * dy2;
    const y1p = -sinPhi * dx2 + cosPhi * dy2;
    let rxSq = rx * rx, rySq = ry * ry;
    const x1pSq = x1p * x1p, y1pSq = y1p * y1p;
    const lambda = x1pSq / rxSq + y1pSq / rySq;
    if (lambda > 1) {
      const s = Math.sqrt(lambda);
      rx *= s; ry *= s;
      rxSq = rx * rx; rySq = ry * ry;
    }
    const radicand = Math.max(0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq);
    let coef = Math.sqrt(radicand / (rxSq * y1pSq + rySq * x1pSq));
    if (fa === fs) coef = -coef;
    const cxp = coef * (rx * y1p) / ry;
    const cyp = -coef * (ry * x1p) / rx;
    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
    const vecAngle = (ux, uy, vx, vy) => {
      const sign = ux * vy - uy * vx < 0 ? -1 : 1;
      const dot = (ux * vx + uy * vy) /
                  (Math.sqrt(ux*ux + uy*uy) * Math.sqrt(vx*vx + vy*vy));
      return sign * Math.acos(Math.max(-1, Math.min(1, dot)));
    };
    const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let deltaTheta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry,
                              (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && deltaTheta > 0) deltaTheta -= 2 * Math.PI;
    if (fs && deltaTheta < 0) deltaTheta += 2 * Math.PI;
    const segments = Math.max(1, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2)));
    const dt = deltaTheta / segments;
    const t = (4 / 3) * Math.tan(dt / 4);
    const cubics = [];
    const localToWorld = (lx, ly) => [
      cosPhi * rx * lx - sinPhi * ry * ly + cx,
      sinPhi * rx * lx + cosPhi * ry * ly + cy,
    ];
    for (let i = 0; i < segments; i++) {
      const a0 = theta1 + i * dt;
      const a1 = a0 + dt;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const [cp1x, cp1y] = localToWorld(c0 - t * s0, s0 + t * c0);
      const [cp2x, cp2y] = localToWorld(c1 + t * s1, s1 - t * c1);
      const [endX, endY] = localToWorld(c1, s1);
      cubics.push({ x1: cp1x, y1: cp1y, x2: cp2x, y2: cp2y, x: endX, y: endY });
    }
    return cubics;
  };

  // Read fill / stroke / stroke-width / stroke-linecap / stroke-linejoin /
  // stroke-dasharray from an element, checking both the inline style="…"
  // attribute (which the Batavia icon set uses heavily) and the
  // presentation attributes (fill="…", stroke="…", …) used by hand-
  // authored or Flaticon-style icons. Inline style wins over the
  // presentation attribute for the same property (matches SVG cascade).
  const parseStyleAttr = (s) => {
    const out = {};
    if (!s) return out;
    for (const part of s.split(";")) {
      const m = part.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i);
      if (m) out[m[1].toLowerCase()] = m[2];
    }
    return out;
  };
  const STYLE_KEYS = ["fill", "stroke", "stroke-width",
                      "stroke-linecap", "stroke-linejoin", "stroke-dasharray"];
  const readStyle = (node) => {
    const ss = parseStyleAttr(node.getAttribute && node.getAttribute("style"));
    const out = {};
    for (const k of STYLE_KEYS) {
      if (ss[k] !== undefined) out[k] = ss[k];
      else {
        const v = node.getAttribute && node.getAttribute(k);
        if (v != null && v !== "") out[k] = v;
      }
    }
    return out;
  };
  // SVG presentation attributes inherit down the tree — a <g stroke="…"
  // stroke-width="…"> applies to every shape below it that doesn't
  // override the property. Own values override inherited.
  const mergeStyle = (own, inh) => {
    const out = {};
    for (const k of STYLE_KEYS) out[k] = own[k] !== undefined ? own[k] : inh[k];
    return out;
  };
  // Uniform scale extracted from a 2×3 affine matrix — used to convert
  // a stroke-width from the path's local user space into viewBox units
  // (so a path with transform="matrix(.1,…)" stroke-width="3" renders
  // with a 0.3-unit visual stroke). Non-uniform scales degrade to the
  // geometric mean; our icons are all uniform so this is exact.
  const matScale = (T) => {
    const det = T[0] * T[3] - T[1] * T[2];
    return Math.sqrt(Math.abs(det)) || 1;
  };

  let stream = "";

  const emitPath = (dStr, T, st) => {
    // Resolve final paint state. SVG defaults: fill=black, stroke=none.
    const fillSpec = st.fill !== undefined ? st.fill : "currentColor";
    const strokeSpec = st.stroke !== undefined ? st.stroke : "none";
    const fillOn = fillSpec !== "none";
    const strokeOn = strokeSpec !== "none";
    if (!fillOn && !strokeOn) return;
    // Skip dashed strokes (the _blank placeholder uses stroke-dasharray
    // as an editor-only "click me" cue and shouldn't appear in print).
    if (st["stroke-dasharray"] && st["stroke-dasharray"] !== "none") return;

    const cmds = parsePathD(dStr);
    if (!cmds.length) return;

    let curX = 0, curY = 0;
    let startX = 0, startY = 0;
    let prevCCtrl = null;
    let prevQCtrl = null;
    let hasGeometry = false;
    let local = "";
    const m = (px, py) => {
      const [tx, ty] = apply(T, px, py);
      const [cx, cy] = toCmXY(tx, ty);
      local += `${xPdf(cx)} ${yPdf(cy)} m\n`;
    };
    const l = (px, py) => {
      const [tx, ty] = apply(T, px, py);
      const [cx, cy] = toCmXY(tx, ty);
      local += `${xPdf(cx)} ${yPdf(cy)} l\n`;
    };
    const cu = (x1, y1, x2, y2, x, y) => {
      const [t1x, t1y] = apply(T, x1, y1);
      const [t2x, t2y] = apply(T, x2, y2);
      const [tx, ty]   = apply(T, x, y);
      const [c1x, c1y] = toCmXY(t1x, t1y);
      const [c2x, c2y] = toCmXY(t2x, t2y);
      const [cx, cy]   = toCmXY(tx, ty);
      local += `${xPdf(c1x)} ${yPdf(c1y)} ${xPdf(c2x)} ${yPdf(c2y)} ${xPdf(cx)} ${yPdf(cy)} c\n`;
    };
    for (const { c, a } of cmds) {
      const k = c.toUpperCase();
      const rel = c !== k;
      if (k === "M") {
        let x = a[0], y = a[1];
        if (rel) { x += curX; y += curY; }
        m(x, y);
        curX = startX = x; curY = startY = y;
        prevCCtrl = null; prevQCtrl = null;
        hasGeometry = true;
      } else if (k === "L") {
        let x = a[0], y = a[1];
        if (rel) { x += curX; y += curY; }
        l(x, y);
        curX = x; curY = y;
        prevCCtrl = null; prevQCtrl = null;
      } else if (k === "H") {
        let x = a[0];
        if (rel) x += curX;
        l(x, curY); curX = x;
        prevCCtrl = null; prevQCtrl = null;
      } else if (k === "V") {
        let y = a[0];
        if (rel) y += curY;
        l(curX, y); curY = y;
        prevCCtrl = null; prevQCtrl = null;
      } else if (k === "C") {
        let [x1, y1, x2, y2, x, y] = a;
        if (rel) { x1+=curX; y1+=curY; x2+=curX; y2+=curY; x+=curX; y+=curY; }
        cu(x1, y1, x2, y2, x, y);
        prevCCtrl = [x2, y2]; prevQCtrl = null;
        curX = x; curY = y;
      } else if (k === "S") {
        let [x2, y2, x, y] = a;
        if (rel) { x2+=curX; y2+=curY; x+=curX; y+=curY; }
        const x1 = prevCCtrl ? 2*curX - prevCCtrl[0] : curX;
        const y1 = prevCCtrl ? 2*curY - prevCCtrl[1] : curY;
        cu(x1, y1, x2, y2, x, y);
        prevCCtrl = [x2, y2]; prevQCtrl = null;
        curX = x; curY = y;
      } else if (k === "Q") {
        let [x1, y1, x, y] = a;
        if (rel) { x1+=curX; y1+=curY; x+=curX; y+=curY; }
        const c1x = curX + (2/3)*(x1 - curX), c1y = curY + (2/3)*(y1 - curY);
        const c2x = x + (2/3)*(x1 - x),       c2y = y + (2/3)*(y1 - y);
        cu(c1x, c1y, c2x, c2y, x, y);
        prevQCtrl = [x1, y1]; prevCCtrl = null;
        curX = x; curY = y;
      } else if (k === "T") {
        let [x, y] = a;
        if (rel) { x+=curX; y+=curY; }
        const x1 = prevQCtrl ? 2*curX - prevQCtrl[0] : curX;
        const y1 = prevQCtrl ? 2*curY - prevQCtrl[1] : curY;
        const c1x = curX + (2/3)*(x1 - curX), c1y = curY + (2/3)*(y1 - curY);
        const c2x = x + (2/3)*(x1 - x),       c2y = y + (2/3)*(y1 - y);
        cu(c1x, c1y, c2x, c2y, x, y);
        prevQCtrl = [x1, y1]; prevCCtrl = null;
        curX = x; curY = y;
      } else if (k === "A") {
        let [rx, ry, phi, fa, fs, x, y] = a;
        if (rel) { x+=curX; y+=curY; }
        const arcs = arcToCubics(curX, curY, rx, ry, phi, fa, fs, x, y);
        for (const ar of arcs) cu(ar.x1, ar.y1, ar.x2, ar.y2, ar.x, ar.y);
        prevCCtrl = null; prevQCtrl = null;
        curX = x; curY = y;
      } else if (k === "Z") {
        local += "h\n";
        curX = startX; curY = startY;
        prevCCtrl = null; prevQCtrl = null;
      }
    }
    if (!hasGeometry) return;

    // Stroke-state prefix (must come BEFORE the path-construction ops).
    // Width is in path-local user units → convert to PDF units by
    // baking in the matrix scale, viewBox-to-cm scale, and the
    // jsPDF cm-to-PDF scale factor. CMYK black for the stroke,
    // matching the fill colour the caller set on the page.
    let prefix = "";
    if (strokeOn) {
      const sw = parseFloat(st["stroke-width"]);
      const swUser = isNaN(sw) ? 1 : sw;
      const widthPdf = swUser * matScale(T) * scale * sf;
      prefix += `0 0 0 1 K\n${widthPdf.toFixed(3)} w\n`;
      const cap = st["stroke-linecap"];
      if (cap === "round") prefix += "1 J\n";
      else if (cap === "square") prefix += "2 J\n";
      const join = st["stroke-linejoin"];
      if (join === "round") prefix += "1 j\n";
      else if (join === "bevel") prefix += "2 j\n";
    }
    const paintOp = fillOn && strokeOn ? "B" : fillOn ? "f" : "S";
    stream += prefix + local + paintOp + "\n";
  };

  const walk = (node, T, inhStyle) => {
    if (!node || node.nodeType !== 1) return;
    const tag = (node.tagName || "").toLowerCase();
    const localT = parseTransform(node.getAttribute && node.getAttribute("transform"));
    const cur = localT ? matMul(T, localT) : T;
    const own = readStyle(node);
    const eff = mergeStyle(own, inhStyle);
    if (tag === "path") {
      const d = node.getAttribute("d");
      if (d) emitPath(d, cur, eff);
    } else if (tag === "rect") {
      const x = +(node.getAttribute("x") || 0);
      const y = +(node.getAttribute("y") || 0);
      const w = +(node.getAttribute("width") || 0);
      const h = +(node.getAttribute("height") || 0);
      if (w > 0 && h > 0) {
        emitPath(`M${x} ${y}h${w}v${h}h${-w}z`, cur, eff);
      }
    } else if (tag === "circle") {
      const cx = +(node.getAttribute("cx") || 0);
      const cy = +(node.getAttribute("cy") || 0);
      const r  = +(node.getAttribute("r") || 0);
      if (r > 0) {
        const k = 0.5522847498307936;
        emitPath(
          `M${cx - r} ${cy}` +
          `C${cx - r} ${cy - r*k} ${cx - r*k} ${cy - r} ${cx} ${cy - r}` +
          `C${cx + r*k} ${cy - r} ${cx + r} ${cy - r*k} ${cx + r} ${cy}` +
          `C${cx + r} ${cy + r*k} ${cx + r*k} ${cy + r} ${cx} ${cy + r}` +
          `C${cx - r*k} ${cy + r} ${cx - r} ${cy + r*k} ${cx - r} ${cy}z`, cur, eff);
      }
    } else if (tag === "ellipse") {
      const cx = +(node.getAttribute("cx") || 0);
      const cy = +(node.getAttribute("cy") || 0);
      const rx = +(node.getAttribute("rx") || 0);
      const ry = +(node.getAttribute("ry") || 0);
      if (rx > 0 && ry > 0) {
        const k = 0.5522847498307936;
        emitPath(
          `M${cx - rx} ${cy}` +
          `C${cx - rx} ${cy - ry*k} ${cx - rx*k} ${cy - ry} ${cx} ${cy - ry}` +
          `C${cx + rx*k} ${cy - ry} ${cx + rx} ${cy - ry*k} ${cx + rx} ${cy}` +
          `C${cx + rx} ${cy + ry*k} ${cx + rx*k} ${cy + ry} ${cx} ${cy + ry}` +
          `C${cx - rx*k} ${cy + ry} ${cx - rx} ${cy + ry*k} ${cx - rx} ${cy}z`, cur, eff);
      }
    } else if (tag === "polygon" || tag === "polyline") {
      const pts = (node.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      if (pts.length >= 4) {
        let d = `M${pts[0]} ${pts[1]}`;
        for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i+1]}`;
        if (tag === "polygon") d += "z";
        emitPath(d, cur, eff);
      }
    } else if (tag === "g" || tag === "svg" || tag === "symbol") {
      for (let i = 0; i < node.children.length; i++) walk(node.children[i], cur, eff);
    }
  };

  walk(svgEl, [1, 0, 0, 1, 0, 0], {});
  if (stream) pdf.internal.write(stream);
};

// ── PDF/X-4 post-processing ──────────────────────────────────────────────
// jsPDF 2.5.1 has no PDF/X support — its output is a plain PDF 1.3 file.
// To make the export pass Acrobat's "Convert to PDF/X-4 (Coated FOGRA39)"
// preflight as-is, we append an incremental update to the bytes that:
//   • embeds the Coated FOGRA39 ICC profile as a stream object,
//   • adds an OutputIntent referencing that ICC (S=GTS_PDFX),
//   • writes an XMP metadata stream declaring PDF/X-4 conformance,
//   • adds /GTS_PDFXVersion (PDF/X-4) to the Info dict,
//   • adds /TrimBox (and /BleedBox if bleed > 0) to every Page.
// Incremental update means we never rewrite the original bytes — we
// append the changed objects, a new xref pointing at their offsets,
// and a new trailer whose /Prev chains back to the original xref.
let __iccCache = null;
const __loadFogra39Icc = async () => {
  if (__iccCache) return __iccCache;
  const r = await fetch("CoatedFOGRA39.icc");
  if (!r.ok) throw new Error("CoatedFOGRA39.icc " + r.status);
  __iccCache = new Uint8Array(await r.arrayBuffer());
  return __iccCache;
};

const __toPdfX4 = (origBytes, opts) => {
  // opts: { title, iccBytes, pages: [{ bleedCm }] }
  const dec = new TextDecoder("latin1");
  const enc = new TextEncoder();

  // ── 1. Locate the existing trailer / xref offset ────────────────
  const tailStart = Math.max(0, origBytes.length - 4096);
  const tail = dec.decode(origBytes.subarray(tailStart));
  const sxm = tail.match(/startxref\s+(\d+)\s+%%EOF/);
  if (!sxm) throw new Error("PDF/X-4: no startxref in trailer");
  const oldXrefOffset = parseInt(sxm[1], 10);

  // ── 2. Parse the xref subsections to learn each object's offset ─
  const xrefArea = dec.decode(origBytes.subarray(oldXrefOffset, oldXrefOffset + 8192));
  const xm = xrefArea.match(/^xref\s+([\s\S]+?)trailer/);
  if (!xm) throw new Error("PDF/X-4: malformed xref");
  const entries = new Map(); // objNum -> { offset, gen, used }
  const xrefRe = /(\d+)\s+(\d+)\s*\n((?:\d{10}\s+\d{5}\s+[nf]\s*\n)+)/g;
  let xrm;
  while ((xrm = xrefRe.exec(xm[1])) !== null) {
    const first = parseInt(xrm[1], 10);
    const lines = xrm[3].trim().split(/\n/);
    lines.forEach((line, i) => {
      const lm = line.match(/(\d{10})\s+(\d{5})\s+([nf])/);
      if (!lm) return;
      entries.set(first + i, {
        offset: parseInt(lm[1], 10),
        gen: parseInt(lm[2], 10),
        used: lm[3] === "n",
      });
    });
  }
  if (!entries.size) throw new Error("PDF/X-4: empty xref");

  // ── 3. Parse the trailer dict ───────────────────────────────────
  const tdm = xrefArea.match(/trailer\s*<<([\s\S]+?)>>/);
  if (!tdm) throw new Error("PDF/X-4: no trailer dict");
  const tDict = tdm[1];
  const rootM = tDict.match(/\/Root\s+(\d+)\s+\d+\s+R/);
  const infoM = tDict.match(/\/Info\s+(\d+)\s+\d+\s+R/);
  const idM   = tDict.match(/\/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
  if (!rootM || !infoM) throw new Error("PDF/X-4: trailer missing Root/Info");
  const catalogNum = parseInt(rootM[1], 10);
  const infoNum    = parseInt(infoM[1], 10);
  const docId      = idM ? idM[1] : null;
  const docIdAlt   = idM ? idM[2] : null;

  // ── 4. Read an indirect object's dict body, stripped of <<…>> ───
  const readDict = (objNum) => {
    const e = entries.get(objNum);
    if (!e) throw new Error(`PDF/X-4: object ${objNum} missing from xref`);
    const slice = origBytes.subarray(e.offset, Math.min(origBytes.length, e.offset + 16384));
    const txt = dec.decode(slice);
    const head = txt.match(new RegExp("^" + objNum + "\\s+\\d+\\s+obj"));
    if (!head) throw new Error(`PDF/X-4: bad header for object ${objNum}`);
    const endIdx = txt.indexOf("endobj");
    if (endIdx < 0) throw new Error(`PDF/X-4: no endobj for ${objNum}`);
    let body = txt.slice(head[0].length, endIdx).trim();
    const wrap = body.match(/^<<([\s\S]*)>>\s*$/);
    return wrap ? wrap[1].trim() : body;
  };

  // ── 5. Catalog → Pages → enumerate Page objects ─────────────────
  const catalogBody = readDict(catalogNum);
  const pagesRefM = catalogBody.match(/\/Pages\s+(\d+)\s+\d+\s+R/);
  if (!pagesRefM) throw new Error("PDF/X-4: catalog has no /Pages");
  const pagesNum = parseInt(pagesRefM[1], 10);
  const pagesBody = readDict(pagesNum);
  const kidsM = pagesBody.match(/\/Kids\s*\[([\s\S]+?)\]/);
  if (!kidsM) throw new Error("PDF/X-4: Pages has no /Kids");
  const pageNums = [...kidsM[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => parseInt(m[1], 10));

  // ── 6. Build the XMP packet ─────────────────────────────────────
  // Acrobat preflight enforces strict equality between Info and XMP
  // for Producer and CreationDate, so read both from the Info object
  // and reuse them verbatim in XMP. The same applies to ModDate (if
  // jsPDF wrote one) — we mirror CreateDate when it didn't.
  const infoBodyOrig = readDict(infoNum);
  const pickInfoString = (key) => {
    // Match  /Key (…)  allowing PDF's \( \) \) escaping inside.
    const re = new RegExp("\\/" + key + "\\s*\\(((?:\\\\.|[^()\\\\])*)\\)");
    const m = infoBodyOrig.match(re);
    return m ? m[1].replace(/\\([\\()])/g, "$1") : null;
  };
  // PDF date "D:YYYYMMDDHHmmSSOhh'mm'" → ISO-8601 "YYYY-MM-DDTHH:mm:ss±hh:mm".
  // Acrobat compares the two as datetimes, so the format has to be
  // structurally valid — we don't get to slip the raw PDF string in.
  const pdfDateToIso = (s) => {
    if (!s) return null;
    const m = s.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([Z+\-])?(\d{2})?'?(\d{2})?'?/);
    if (!m) return null;
    const [, y, mo, d, hh, mm, ss, tz, oh, om] = m;
    let zone = "Z";
    if (tz === "+" || tz === "-") zone = `${tz}${oh || "00"}:${om || "00"}`;
    else if (tz === "Z" || !tz) zone = "Z";
    return `${y}-${mo}-${d}T${hh}:${mm}:${ss}${zone}`;
  };
  const xmpProducer = pickInfoString("Producer") || "jsPDF";
  const xmpCreateIso = pdfDateToIso(pickInfoString("CreationDate"))
                       || new Date().toISOString().slice(0, 19) + "Z";
  const xmpModifyIso = pdfDateToIso(pickInfoString("ModDate")) || xmpCreateIso;
  const safe = (opts.title || "Datasheet").replace(/[<>&"']/g, " ");
  const xmpEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Document/Instance IDs as RFC-4122-ish UUIDs (32 hex chars hyphenated)
  // so xmpMM gets the format Acrobat expects.
  const hexToUuid = (h) => {
    const p = (h || "").padStart(32, "0").slice(0, 32);
    return `${p.slice(0,8)}-${p.slice(8,12)}-${p.slice(12,16)}-${p.slice(16,20)}-${p.slice(20,32)}`;
  };
  const docUuid = hexToUuid(docId);
  const instUuid = hexToUuid(docIdAlt || docId);
  const xmp =
`<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="batavia-data-sheet">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
        xmlns:pdfx="http://ns.adobe.com/pdfx/1.3/"
        xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmpEsc(safe)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>Vyke Design</rdf:li></rdf:Seq></dc:creator>
      <pdf:Producer>${xmpEsc(xmpProducer)}</pdf:Producer>
      <pdf:Trapped>False</pdf:Trapped>
      <xmp:CreateDate>${xmpCreateIso}</xmp:CreateDate>
      <xmp:ModifyDate>${xmpModifyIso}</xmp:ModifyDate>
      <xmp:MetadataDate>${xmpModifyIso}</xmp:MetadataDate>
      <xmpMM:DocumentID>uuid:${docUuid}</xmpMM:DocumentID>
      <xmpMM:InstanceID>uuid:${instUuid}</xmpMM:InstanceID>
      <xmpMM:VersionID>1</xmpMM:VersionID>
      <xmpMM:RenditionClass>default</xmpMM:RenditionClass>
      <pdfx:GTS_PDFXVersion>PDF/X-4</pdfx:GTS_PDFXVersion>
      <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  // ── 7. Allocate object numbers for the appended objects ─────────
  const origCount = Math.max(...entries.keys()) + 1;
  let nextObj = origCount;
  const iccObj  = nextObj++;
  const oiObj   = nextObj++;
  const metaObj = nextObj++;

  // ── 8. Write the appended section ───────────────────────────────
  const chunks = [];
  let appendPos = origBytes.length;
  const newEntries = new Map();   // objNum → byte offset
  const writeBytes = (u8) => { chunks.push(u8); appendPos += u8.length; };
  const writeText = (s) => writeBytes(enc.encode(s));
  // Start the appended section on a fresh line.
  if (origBytes[origBytes.length - 1] !== 0x0a) writeText("\n");

  // 8a. ICC profile stream (4-component CMYK).
  newEntries.set(iccObj, appendPos);
  writeText(`${iccObj} 0 obj\n<< /N 4 /Length ${opts.iccBytes.length} >>\nstream\n`);
  writeBytes(opts.iccBytes);
  writeText(`\nendstream\nendobj\n`);

  // 8b. OutputIntent dict.
  newEntries.set(oiObj, appendPos);
  writeText(
`${oiObj} 0 obj
<<
/Type /OutputIntent
/S /GTS_PDFX
/OutputConditionIdentifier (FOGRA39)
/OutputCondition (Coated FOGRA39 \\(ISO 12647-2:2004\\))
/Info (Coated FOGRA39 \\(ISO 12647-2:2004\\))
/RegistryName (http://www.color.org)
/DestOutputProfile ${iccObj} 0 R
>>
endobj
`);

  // 8c. XMP metadata stream.
  const xmpBytes = enc.encode(xmp);
  newEntries.set(metaObj, appendPos);
  writeText(`${metaObj} 0 obj\n<< /Type /Metadata /Subtype /XML /Length ${xmpBytes.length} >>\nstream\n`);
  writeBytes(xmpBytes);
  writeText(`\nendstream\nendobj\n`);

  // 8d. Updated Catalog (add /Metadata + /OutputIntents).
  let cat = catalogBody;
  if (!/\/Metadata\s+\d+\s+\d+\s+R/.test(cat))      cat += `\n/Metadata ${metaObj} 0 R`;
  if (!/\/OutputIntents\s*\[/.test(cat))            cat += `\n/OutputIntents [${oiObj} 0 R]`;
  newEntries.set(catalogNum, appendPos);
  writeText(`${catalogNum} 0 obj\n<<\n${cat}\n>>\nendobj\n`);

  // 8e. Updated Info dict (add GTS_PDFXVersion + Title + Trapped).
  //     Producer / CreationDate stay as jsPDF wrote them — XMP above
  //     mirrors those exact values so preflight's equality check passes.
  let info = infoBodyOrig;
  if (!/\/GTS_PDFXVersion/.test(info))   info += `\n/GTS_PDFXVersion (PDF/X-4)`;
  if (!/\/Title\s/.test(info))           info += `\n/Title (${safe.replace(/[\\()]/g, "\\$&")})`;
  if (!/\/Trapped/.test(info))           info += `\n/Trapped /False`;
  newEntries.set(infoNum, appendPos);
  writeText(`${infoNum} 0 obj\n<<\n${info}\n>>\nendobj\n`);

  // 8f. Updated Pages — add /TrimBox (and /BleedBox if bled).
  //     BleedBox uses the MediaBox's *verbatim* numeric string so the
  //     two boxes are byte-identical — preflight's nesting check is
  //     strict and any floating-point rounding can trip a "not nested
  //     properly" error.
  pageNums.forEach((pn, i) => {
    const body = readDict(pn);
    const mbM = body.match(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s*\]/);
    if (!mbM) return;
    const llx = parseFloat(mbM[1]), lly = parseFloat(mbM[2]);
    const urx = parseFloat(mbM[3]), ury = parseFloat(mbM[4]);
    const bleedPt = ((opts.pages[i] && opts.pages[i].bleedCm) || 0) * 28.3465;
    let trim;
    if (bleedPt > 0) {
      // For the bleed case the inset is large enough (≥ 8 pt) that any
      // 0.0005-pt toFixed rounding can never push TrimBox outside
      // BleedBox / MediaBox.
      const fmt = (n) => n.toFixed(3);
      trim = `/TrimBox [${fmt(llx + bleedPt)} ${fmt(lly + bleedPt)} ${fmt(urx - bleedPt)} ${fmt(ury - bleedPt)}]`;
    } else {
      // No bleed → TrimBox must equal MediaBox. toFixed(3) on a value
      // like 283.4645669… rounds UP to 283.465, which then exceeds the
      // unrounded MediaBox by 0.0004 pt — Acrobat flags it as "Page
      // boxes not nested properly". Reuse the verbatim MediaBox tokens
      // so the two boxes are byte-identical.
      trim = `/TrimBox [${mbM[1]} ${mbM[2]} ${mbM[3]} ${mbM[4]}]`;
    }
    const bleed = bleedPt > 0
      ? `\n/BleedBox [${mbM[1]} ${mbM[2]} ${mbM[3]} ${mbM[4]}]` : "";
    let newBody = body;
    if (!/\/TrimBox/.test(newBody))  newBody += `\n${trim}${bleed}`;
    newEntries.set(pn, appendPos);
    writeText(`${pn} 0 obj\n<<\n${newBody}\n>>\nendobj\n`);
  });

  // ── 9. New xref table — group contiguous object numbers ─────────
  const sorted = [...newEntries.keys()].sort((a, b) => a - b);
  const subs = [];
  for (const n of sorted) {
    const last = subs[subs.length - 1];
    if (last && n === last.first + last.list.length) last.list.push(n);
    else subs.push({ first: n, list: [n] });
  }
  const newXrefOffset = appendPos;
  let xrefStr = "xref\n";
  for (const s of subs) {
    xrefStr += `${s.first} ${s.list.length}\n`;
    for (const n of s.list) {
      const off = newEntries.get(n).toString().padStart(10, "0");
      xrefStr += `${off} 00000 n \n`;
    }
  }
  writeText(xrefStr);

  // ── 10. New trailer chaining back to the original xref ─────────
  const newSize = nextObj;
  const idStr = docId
    ? `/ID [<${docId}> <${docIdAlt || docId}>]\n`
    : "";
  writeText(
`trailer
<<
/Size ${newSize}
/Root ${catalogNum} 0 R
/Info ${infoNum} 0 R
${idStr}/Prev ${oldXrefOffset}
>>
startxref
${newXrefOffset}
%%EOF
`);

  // ── 11. Concatenate original bytes + appended section ──────────
  let totalLen = origBytes.length;
  for (const c of chunks) totalLen += c.length;
  const out = new Uint8Array(totalLen);
  out.set(origBytes, 0);
  let p = origBytes.length;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
};

// Trigger a browser download for a Uint8Array as a named file.
const __downloadBytes = (bytes, filename) => {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  // Build a CSV with one row per page (or a single state). The union of
  // keys across all rows becomes the header so every page's columns line
  // up even when some pages have more spec slots than others.
  //
  // The shared custom-icon library travels along as a JSON blob in the
  // _customIcons column on the FIRST row only — large strings (full SVG
  // markup) get embedded once and round-trip cleanly through CSV
  // quoting. Empty on every later row to keep file size sane.
  const pagesToCsv = (states, customIcons) => {
    const list = Array.isArray(states) ? states : [states];
    const rows = list.map(stateToRow);
    if (customIcons && customIcons.length) {
      rows[0]._customIcons = JSON.stringify(customIcons);
      for (let i = 1; i < rows.length; i++) rows[i]._customIcons = "";
    }
    const headers = Array.from(rows.reduce((set, r) => {
      Object.keys(r).forEach(k => set.add(k));
      return set;
    }, new Set()));
    const body = rows.map(r => headers.map(h => csvEscape(r[h] ?? "")).join(","));
    return headers.join(",") + "\n" + body.join("\n");
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
    // Export every page as one row each — round-trips through 'Import CSV →
    // pages' to recreate the whole deck, custom icon library included.
    const csv = pagesToCsv(pages, customIcons);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = `${pages.length} page${pages.length === 1 ? "" : "s"}`;
    a.download = `datasheets (${stamp}).csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }, [pages, customIcons]);

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
        // Pull the embedded custom icon library out of the first non-empty
        // _customIcons cell (we only populate row 0 on export, but tolerate
        // a value anywhere just in case the user edited the CSV by hand).
        let importedIcons = [];
        for (const row of rows) {
          const blob = row._customIcons;
          if (!blob || !blob.trim()) continue;
          try {
            const parsed = JSON.parse(blob);
            if (Array.isArray(parsed)) {
              importedIcons = parsed.filter(ic =>
                ic && typeof ic === "object" && ic.key && ic.svg);
            }
          } catch (e) {
            console.warn("Could not parse _customIcons cell:", e);
          }
          break;
        }
        setAppState(prev => ({
          ...prev,
          pages: [...prev.pages, ...newPages],
          activeIndex: prev.pages.length,  // jump to the first imported page
          customIcons: dedupeIcons([...(prev.customIcons || []), ...importedIcons]),
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
      // Measure the SVG itself (not the button) so the vector overlay lands
      // on the exact content rect — the button has 0.4mm dashed border +
      // 0.4mm padding around the SVG that we don't want to count.
      return svg ? { svg, ...posOf(svg) } : null;
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

    try {
      // No bitmap pass — everything below is redrawn from the measured
      // DOM rects as CMYK vector geometry. Skipping html2canvas keeps
      // the PDF strictly CMYK (no DeviceRGB image XObject), which is
      // what PDF/X-4 with a CMYK OutputIntent requires, and cuts the
      // exported file size by roughly 90 %.

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

      // ─── 6. Spec icons (CMYK black, vector paths) ────────────────
      //       Hidden during the bitmap above, redrawn here as real
      //       vector geometry so the PDF stays editable in Illustrator
      //       and prints at the RIP's native resolution.
      setBlackFill();
      specIconInfos.forEach((info) => {
        if (!info || !info.svg) return;
        __drawSvgIconAsPaths(pdf, info.svg, { x: info.x, y: info.y, w: info.w, h: info.h });
      });

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
    } catch (e) {
      throw e;
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
        // Wrap the plain jsPDF output as PDF/X-4 (Coated FOGRA39) before
        // saving — adds OutputIntent, XMP metadata, GTS_PDFXVersion, and
        // a TrimBox per page so the file passes Acrobat's preflight.
        const origBytes = new Uint8Array(pdf.output("arraybuffer"));
        const icc = await __loadFogra39Icc();
        const finalBytes = __toPdfX4(origBytes, {
          title: safe,
          iccBytes: icc,
          pages: [{ bleedCm }],
        });
        __downloadBytes(finalBytes, `${safe} (${w}x${h}cm${bleedTag}).pdf`);
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
        // Track per-page bleed so the PDF/X-4 wrapper can write each
        // page's TrimBox at the right inset.
        const pdfPages = [];
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
          pdfPages.push({ bleedCm });
        }
        setAppState(prev => ({ ...prev, activeIndex: originalIndex }));
        setBatchProgress(null);
        if (pdf) {
          const origBytes = new Uint8Array(pdf.output("arraybuffer"));
          const icc = await __loadFogra39Icc();
          const finalBytes = __toPdfX4(origBytes, {
            title: `Datasheets (${pages.length} pages)`,
            iccBytes: icc,
            pages: pdfPages,
          });
          __downloadBytes(finalBytes,
            `Datasheets (${pages.length} page${pages.length === 1 ? "" : "s"}).pdf`);
        }
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
        <TweakButton
          label={`Export CSV (${pages.length} page${pages.length === 1 ? "" : "s"})`}
          onClick={exportCsv}
          secondary
        />
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
