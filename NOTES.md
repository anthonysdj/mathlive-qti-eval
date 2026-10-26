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
| `froala-editor` | 5.5.0 (exact) | `sandbox/froala`, `apps/authoring` | The rich-text editor we integrate with (M2). Commercial licence; used unlicensed here, which shows "Powered by Froala". |
| `angular-froala-wysiwyg` | 5.5.0 (exact) | `apps/authoring` | Froala's official Angular directive, wrapped by our component. |
| `@angular/*` | 22.2.3 (core, compiler-cli…), 22.2.4 (build, cli) | `apps/authoring` | The final integration demo must run in Angular. Needs Node ≥ 22.22.3 / 24.15. |
| `typescript` | 6.0.3 | dev (`apps/authoring`) | What Angular 22 supports (the sandboxes use 7.0.2). |
| GraalJS (`org.graalvm.polyglot:polyglot`, `js-community`) | 24.2.1 | `sandbox/java-temml` | Runs the same Temml and MathJax builds on a Java backend without Node (UPL / MIT). |
| JUnit 5, Jackson | 5.11.4 / 2.18.2 | `sandbox/java-temml` (test) | Tests; Jackson reads the Node results to compare. |
| `vite` | 8.3.5 | dev | Sandbox dev server and build. |
| `vitest` + `@vitest/browser-playwright` | 5.0.5 | dev | MathLive needs a real browser (layout, FontFace, custom elements, adoptedStyleSheets), so tests run in Chromium, not jsdom. |
| `playwright` | 1.64.1 | dev | Browser driver for Vitest and the runtime-check script. |
| `typescript` | 7.0.2 | dev | Type checking (`pnpm typecheck`). |
| `@types/node` | 22 | dev | Types for the config files and scripts. |

On machines with a pre-installed Chromium that doesn't match Playwright's build, set `PW_CHROMIUM=/path/to/chrome` (the cloud container uses `/opt/pw-browsers/chromium`). Otherwise run `pnpm exec playwright install chromium`.

## 2026-10-26 — M3: equation builder

- Builder logic in `sandbox/builder` (palette, allowed-symbols profiles, notation, keyboard layouts, controller), Angular `EquationBuilder` in `apps/authoring`, plugged into the M2 dialog through a new extension point (`mathEquationExtend`). No new dependencies. → `docs/03-equation-builder.md`.
- **MathLive's `\ce{}` can't be typed into.** Text typed into `\ce{#?}` is lost; into `\ce{#0}` it produces `undefined{…}`. MathLive also has no spoken text for `\ce`. Chemistry goes in through a text entry instead (`tests/notation.test.ts`).
- **Typed text in a `\mathrm{#?}` slot doesn't stay upright**: it comes out italic, or as `\operatorname{kg}` with MathLive's default shortcuts. Units are fixed buttons plus a text entry.
- **After a literal `\mathrm{d}`, MathLive types the variable into the same group** (`\mathrm{dx}`). Integral and derivative templates use MathLive's `\differentialD`, which `latex-expanded` writes as `\mathrm{d}`.
- **A macro with arguments keeps its empty slot in `getValue('latex')`** while `latex-expanded` has the typed content, and its spoken text is the macro's name. Custom macros are zero-argument only; templates with slots are inline shortcuts.
- **Typing `y''` gives `y^{\doubleprime}`, which Temml rejects**, so the M2 dialog refused to save it. Fixed in `toStandardLatex()` (`\doubleprime` → `\prime\prime`).
- MathLive sends one `input` event for a burst of keys but `selection-change` for each, and none at all for a lone `^` (empty superscript). The allowed-symbols check listens to both.
- MathLive reads `event.code`: a `|` sent without Shift (Vitest's `userEvent`, Playwright's `keyboard.type`) arrives as `\` and enters LaTeX mode. Tests use Shift+Backslash.
- The virtual keyboard's keycaps are `div`s with no role and no tab stop; the layer switcher has no labels (measured in `scripts/builder-check.mjs`).
- `<math-span>` (MathLive's static renderer) draws nothing for `\placeholder{}`; palette buttons use `\square`.

## 2026-10-26 — M2: Froala integration

- Strategy **(b)** built: the content holds `<math-eq data-mathml>` elements that show the MathJax SVG from a shadow root; a modal `<dialog>` with one `<math-field>` inserts and edits. Measured (a) for comparison: ~10× slower load and undo at 100 equations, and its screen rendering isn't the print SVG. The evidence wasn't split, so (b) without asking. → `docs/02-froala-integration.md`.
- **Default Froala turns MathML into stray text** (unwraps `<math>`, keeps the annotation as visible text). Needs a MathML allow-list, in the options from the start, because Froala cleans the initial content before plugins run.
- Froala collapses runs of spaces in MathML text when it cleans; the plugin wraps `html.set()` to convert first.
- Froala 5.5.0 removes `fr-deletable` elements on Backspace but not on Delete; the plugin handles Delete.
- MathLive's virtual keyboard is inert behind a modal dialog, has zero height in a non-body container, and can't be moved at all inside an iframe (proxy). Workarounds in `equation-dialog.ts`.
- **Bug found in the print path:** MathJax 4.1.3 draws a multi-child `<math>` (how Wiris writes MathML) only up to the first operator. Fixed in `prepareForSvg()`.
- The MathJax font loader no longer uses `import.meta.glob`, so the Angular CLI can build it. In Vite, `@mathjax/src` must also stay out of `optimizeDeps` when the loader lives in another package.
- MathLive leaves three one-shot document/window listeners per blur (`restoreFocusWhenDocumentFocused`); they go on the next click or focus. The teardown tests account for it.
- Angular CLI 22 refuses Node 22.22.0 (container); built with Node 24.15.0 from `npx node@24.15.0`.

## 2026-10-26 — Spike: MathJax SVG on a Java backend

- Ton asked to cover the gap "the MathJax SVG step in Java is untested". MathJax 4.1.3 in GraalJS gives byte-identical SVG to Node for all 60 formulas, also end to end from LaTeX through `TemmlConverter`. → `findings/java-temml.md`, `MathmlToSvg.java`.
- The trick: `src/svg-sync.ts` eagerly imports every font range (`import.meta.glob(..., { eager: true })`) and sets `mathjax.asyncIsSynchronous = true` with a synchronous `asyncLoad`. MathJax then applies a range the first time a glyph needs it (`FontData.loadDynamicFileSync`) and `doc.convert()` works without Promises. Built as one IIFE with `vite.svg-sync.config.ts` (12 MB).
- `prepareForSvg()` moved to `src/prepare-svg.ts` so the bundle doesn't pull in `asyncLoad/esm.js` (which uses `import.meta.url`). `print.ts` re-exports it.
- About 25 ms per formula interpreted, 1.9 s start-up. Graal 24.2's JIT needs JDK 24+, so it wasn't measured on JDK 21.

## 2026-10-26 — Spike: Temml on a Java backend

- Ton asked whether Temml exists for Java. It doesn't, but GraalJS (Maven: `org.graalvm.polyglot:polyglot` + `js-community` 24.2.1) runs it on OpenJDK 21 with no Node. 60/60 corpus outputs are byte-identical to Node, and the attack inputs are rejected. → `findings/java-temml.md`, `sandbox/java-temml`.
- It is interpreted on a stock JDK, at about 2.3 ms per formula. The MathJax SVG step in GraalJS is untested.
- Temml security (read from the 0.14.0 source + 23 attack inputs): `trust` defaults to false; link/HTML commands are unsupported; colours are validated; text and the annotation are escaped; `maxExpand` is 1000. Not covered by Temml: input length, deep nesting (stack overflow) and `\rule` size (`maxSize`). Those guards are in `TemmlConverter.java`.
- MathLive (0.111.1) does support `\href` (http/https only), `\htmlData`, `\cssId` and `\class`, sanitising their values. Rejecting them at save time via Temml keeps them out of every editor.

## 2026-10-26 — Same math font for native MathML?

- Ton asked whether pointing the browser at the same math font would make screen and print consistent. Measured in Chromium with New Computer Modern Math as a web font: median 42.0% differing pixels vs the print SVG (45.7% with the default font, 0.3% with the same SVG). Shapes match; layout (operator spacing, script size, matrix gaps) doesn't. → `findings/consistency.md`, `findings/same-font.html`.
- The font isn't committed (1.1 MB, GUST font licence). CTAN is blocked from the cloud container; the copy used came from the `typst-assets` 0.13.1 crate (crates.io).

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
