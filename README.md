# Batavia Data Sheet Template

Interactive product datasheet template for Batavia. Editable title, subtitle, spec rows with swappable icons (47 Batavia-style line icons + custom SVG upload), QR code with Batavia "V" center mark, and CMYK-accurate PDF export at exact print dimensions (10×9.5 cm or 20×9.5 cm).

Designed in Claude Design, deployed as a minimal Astro static site so it works on **GitHub Pages** and **Webflow Cloud** out of the box.

## Live URL

After the first GitHub Actions deploy completes:

- **Landing (auto-redirects):** `https://vykebv.github.io/batavia-data-sheet/`
- **Direct editor:** `https://vykebv.github.io/batavia-data-sheet/Data%20Sheet%20Template.html`

## Local development

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # → dist/
npm run preview      # serve dist/ locally
```

## Embed in Webflow (iframe)

Paste this into a Webflow **Embed** element on any page:

```html
<iframe
  src="https://vykebv.github.io/batavia-data-sheet/Data%20Sheet%20Template.html"
  style="width:100%;height:900px;border:0;display:block;"
  allow="clipboard-write"
  loading="lazy"
></iframe>
```

Adjust `height` to suit. The editor's own canvas auto-scales to its container.

## Deploy via Webflow Cloud

This repo is structured to drop straight into Webflow Cloud (Astro framework support).

1. In your Webflow site dashboard → **Webflow Cloud** → **New project**.
2. **Connect repository:** `VykeBV/batavia-data-sheet`.
3. **Framework:** Astro.
4. **Build command:** `npm run build`.
5. **Output directory:** `dist`.
6. **Mount path:** pick a path on your Webflow site (e.g. `/tools/data-sheet`).
7. Deploy. The editor will be live at `https://<your-domain>/tools/data-sheet/Data%20Sheet%20Template.html`.

## Project layout

```
public/
  Data Sheet Template.html        # Main interactive editor (entry point)
  Data Sheet Template-print.html  # Print-only static fallback
  app.jsx                          # React app: state, specs, picker, PDF export
  icons.jsx                        # 47 Batavia-style line icons
  tweaks-panel.jsx                 # Tweaks UI (settings panel)
  batavia-mark.svg                 # QR center "V" logo
  vyke-create-logo.png             # Tweaks panel branding
src/pages/
  index.astro                      # Landing → meta-refresh to the template
.github/workflows/
  deploy.yml                       # Build Astro → deploy to GitHub Pages on push
astro.config.mjs                   # output: 'static', base: '/batavia-data-sheet'
```

Astro just statically serves everything in `public/` — no build-time transforms — so the existing HTML/JSX/React-via-Babel pipeline keeps working exactly as designed.

## Editing the template

- **Inline edit:** click title, subtitle, spec text, or "SCAN ME" to edit in place.
- **Swap icons:** click any icon → picker opens with the 47 built-in icons + "Upload SVG" for your own.
- **Add/remove specs:** hover a row → small ×. Hover the card → "+ Add spec" (cap is 5 in 10×9.5 mode, 12 in 20×9.5 mode).
- **Tweaks panel** (top-right): aspect ratio (10:9.5 / 20:9.5), accent color (orange/black), triangle on/off, QR on/off + link + label, Save/Load JSON, CSV import for batch multi-page PDF, Reset.
- **Export:** Tweaks → **Download as PDF** — produces a CMYK-accurate vector PDF at exact cm dimensions.

## License

Internal Vyke / Batavia use.
