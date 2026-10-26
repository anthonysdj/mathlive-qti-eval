# NOTES

Running log of versions, surprises, bugs and workarounds. Newest first.

## Pinned versions

| Package | Version | Where | Why |
|---|---|---|---|
| `mathlive` | **0.111.1** (exact) | `sandbox/basic` | Subject of the study. Latest release (2026-10-09). It fixes 3 XSS advisories in `\enclose`, `\htmlData`/`\href` and the MathML output, so don't go below it. Source reference: commit `30ad20a7` of arnog/mathlive (there's no git tag). |
| `mathml-to-latex` | 1.8.0 (exact) | `sandbox/basic` (runtime) | MathLive cannot read MathML. We need *some* MathML→LaTeX path to re-hydrate annotation-less content (Wiris, legacy). Used by `src/serialize.ts` as the fallback only. MIT. |
| `temml` | 0.14.0 (exact) | `sandbox/converters` | Candidate LaTeX→MathML converter for stored MathML (MIT). Includes its mhchem extension. Recommended in `findings/mathml-converters.md`. |
| `@mathjax/src` | 4.1.3 (exact) | `sandbox/converters` | Second candidate converter, for comparison (Apache-2.0). Only the TeX input and the MathML serialiser are used. |
| `@mathjax/mathjax-newcm-font` | 4.1.3 (exact) | `sandbox/converters` | Font data for MathJax's SVG output in the print-path spike (already a transitive dependency; pinned directly because `src/print.ts` imports it). |
| `@resvg/resvg-js` | 2.6.2 | dev (`sandbox/converters`) | Independent, non-browser SVG renderer: stands in for the PDF engine's rasteriser in the screen/print consistency proof. Also the candidate SVG→PNG step if the engine needs PNG. MPL-2.0. |
| `pixelmatch` + `pngjs` (+ `@types/pngjs`) | 8.0.0 / 7.0.0 | dev (`sandbox/converters`) | Pixel diff of screen vs print renders, and PNG decode/encode for it. ISC / MIT. |
| `vite` | 8.3.5 | dev | Sandbox dev server and build. |
| `vitest` + `@vitest/browser-playwright` | 5.0.5 | dev | MathLive needs a real browser (layout, FontFace, custom elements, adoptedStyleSheets), so tests run in Chromium, not jsdom. |
| `playwright` | 1.64.1 | dev | Browser driver for Vitest and the runtime-check script. |
| `typescript` | 7.0.2 | dev | Type checking (`pnpm typecheck`). |
| `@types/node` | 22 | dev | Types for the config files and scripts. |

On machines with a pre-installed Chromium that doesn't match Playwright's build, set `PW_CHROMIUM=/path/to/chrome` (the cloud container uses `/opt/pw-browsers/chromium`). Otherwise run `pnpm exec playwright install chromium`.

## 2026-10-26 — Demo: render an inserted equation in the page

- `sandbox/converters` now has a Vite demo (`pnpm dev`). Insert in MathLive stores Temml MathML; the page shows MathJax SVG (same as print) plus a visually hidden `<math>` for screen readers. Click an equation to edit it. → `findings/insert-demo.md`.
- **Bug found in the print path:** MathJax 4.1.3 SVG draws only the first child of the `<mrow>` inside `<semantics>`. Our stored format has `<semantics>` (Temml `annotate: true`), so `a+b` printed as `a`. The earlier spikes didn't see it because they used MathML without the annotation. Fixed in `prepareForSvg()`, which now strips `<semantics>`/`<annotation>`. A test pins that the annotated MathML gives a byte-identical SVG for all 60 cases.
- In the browser, MathJax's on-demand font ranges are bare-specifier imports and fail. `src/mathjax-browser-fonts.ts` maps them to Vite chunks via `import.meta.glob`. `@mathjax/mathjax-newcm-font` must be in `optimizeDeps.exclude`, or the ranges register on a pre-bundled duplicate of the font class.
- Stored HTML has to be serialised with XMLSerializer: `innerHTML` writes `&nbsp;` inside MathML.
- Display bundle: MathJax MathML→SVG + font is 320 KB brotli. Lazy-load it, or pre-render on the server.
- Moved `loadTemmlMhchem()` to `src/temml-mhchem.ts` so the demo doesn't pull in MathJax's TeX input. It is still re-exported from `converters.ts`.

## 2026-10-26 — Spike: screen/print consistency

- Ton asked whether screen and print can be made 100% consistent. Yes, if the screen shows the same MathJax SVG as print: median 0.28% differing pixels (max 2.69%, `\bar`), anti-aliasing only. Today's native MathML vs SVG: median 45.7%. → `findings/consistency.md`.
- Print side measured with resvg (not XEP). Needs a real PDF from our engine to close.
- SVG on screen needs the MathML kept for screen readers (M4 accessibility check).
- `tests/consistency.node.test.ts` drives Chromium from the Node project with Playwright directly (no Vitest browser mode), because it needs resvg's native binding next to the browser.

## 2026-10-26 — Spike: print path (MathML → SVG)

- Ton recalls RenderX (probably XEP, XSL-FO) as the PDF engine, with formulas converted to images. Not confirmed yet.
- Temml MathML → MathJax SVG (Node, `fontCache: 'none'`): all 60 cases correct after `prepareForSvg()`. → `findings/print-svg.md`.
- Two surprises, found only by looking at the rendered images: (1) Temml's `<mtd style="padding…">` makes MathJax overlap matrix entries and clip `cases`; (2) MathJax copies Temml's `class="tml-…"` onto the SVG, where Temml's CSS (if loaded on the same page) hides `\vec`/`\bar`. The fix is to strip both before conversion.
- MathJax 4 loads font ranges on demand. In Node, import `@mathjax/src/js/util/asyncLoad/esm.js` or `\mathbb` fails ("No mathjax.asyncLoad method specified").
- `sandbox/converters` now has two Vitest projects: browser (Chromium) and node (print path).

## 2026-10-26 — Spike: MathML converters

- Ran the M1 corpus plus 2 custom-macro cases through MathLive, Temml and MathJax (`sandbox/converters`). **Temml and MathJax: 60/60 clean. MathLive: 46/60.** Recommendation: store Temml output, and use MathLive only for editing. → `findings/mathml-converters.md`.
- Temml's mhchem extension is a plain script that needs a global `temml`. Set `globalThis.temml` and then `await import('temml/contrib/mhchem/mhchem.js')`.
- Temml output uses `class="tml-…"` and inline `style` for `\overline`, `\cancel` and `\boxed`. The delivery side needs `Temml-Local.css` (~9 KB), or those commands must be excluded.
- MathJax output sets `mathvariant="double-struck"` for `\mathbb`, which Chromium's native MathML ignores, so it renders as a plain R. It also adds `data-latex` attributes to every node.
- `temml.renderToString(latex, { xml: true, annotate: true })` produces exactly the planned `<semantics>` + `application/x-tex` annotation format.
- Typing in the field gives `\left(`…`\right)`, not `\mleft`. `\mleft`/`\mright` only appear in pasted or loaded LaTeX, and `toStandardLatex()` maps them anyway.

## 2026-10-26 — M1 kickoff

- **No MathML input.** MathLive 0.111.1 has no MathML parser (no `DOMParser`/MathML import anywhere in `src/`). Round-tripping MathML relies on storing LaTeX alongside it. → `findings/roundtrip.md`.
- **MathML output defects (17 in the corpus, plus custom macros).** The worst for QTI: `\ne` → `&ne;` (malformed XML), `~` → `&nbsp;` (malformed), prompts → `notation="roundexbox"""` (malformed), `\ce{}` → nothing, `\overline` → nothing, user macros → nothing. Each one is pinned in tests so an upgrade that fixes it is noticed. Not yet reported upstream; consider filing issues (would need Ton's OK, since it's posting outside the project).
- **Fonts 404 under Vite.** The default loader resolves `./fonts/` against the bundled chunk URL (`/assets/fonts/…`). Setting `fontsDirectory` in the entry module is too late for a `<math-field>` already in the HTML. **Workaround:** `import 'mathlive/fonts.css'` + `build.assetsInlineLimit: 0` (otherwise Size3 is inlined as `data:` and blocked by `font-src 'self'`).
- **CSP:** a strict `style-src 'self'` collapses the layout (inline `style=` heights). It needs `style-src-attr 'unsafe-inline'`; `style-src-elem` can stay strict. Trusted Types work with `MathfieldElement.createHTML` set before the first field connects.
- **SSR:** under Node, `mathlive` resolves to the SSR build and has no `MathfieldElement`. `convertLatexToSpeakableText` throws in Node unless a stub global `MathfieldElement` is defined.
- **Focus is async.** `focus()` completes on a 60 ms timer, and a blur inside that window is swallowed with no event.
- **The virtual keyboard toggle blurs and refocuses the field.** Watch for this with Froala's blur handling.
- **Host gets `contenteditable="true"`** on connect (NVDA workaround) unless `user-select: none`. To revisit inside Froala.
- **Perf:** 1000 read-only fields take ≈ 11.4 s to mount, vs 0.8 s for static markup and 0.4 s for native MathML. This points to embedding strategy (b) for M2, but it's evidence only; the decision is Ton's (rule 7).
- `validateLatex('\\frac{a}')` returns no errors (lenient parser). `convertAsciiMathToLatex('a/b')` returns `a/b`, not a fraction.
- The Playwright that npm installs (1.64.1) wants Chromium build 1248. The container has 1243, hence `PW_CHROMIUM`.
