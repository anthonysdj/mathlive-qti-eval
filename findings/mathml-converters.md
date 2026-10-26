# Spike: which converter should produce the MathML we store?

**Question.** MathLive's own MathML has defects (see [roundtrip.md](roundtrip.md)). Can a dedicated LaTeX→MathML converter produce clean MathML for QTI item bodies, so that MathLive is used only for editing?

**Answer: yes. Both Temml and MathJax produced clean MathML for all 60 cases. I recommend Temml.**

The run on 2026-10-26 used MathLive 0.111.1, Temml 0.14.0 (+ its mhchem extension) and MathJax 4.1.3 (`@mathjax/src`), in Chromium 1243.

- **Evidence:** [`sandbox/converters/tests/converters.test.ts`](../sandbox/converters/tests/converters.test.ts) (132 assertions).
- **Raw output for every case:** [`mathml-converters-raw.json`](mathml-converters-raw.json).
- **Rendered side by side:** [`mathml-converters.html`](mathml-converters.html) and [`screenshots/mathml-converters.png`](screenshots/mathml-converters.png). There's also a version with Temml's stylesheet loaded: [`mathml-converters-temml-css.html`](mathml-converters-temml-css.html) and [`.png`](screenshots/mathml-converters-temml-css.png).

## The pipeline that was tested

```
<math-field> ──getValue('latex-expanded')──► toStandardLatex() ──► converter ──► <math>…</math>
                (custom macros expanded,       (\placeholder → \square,
                 so stored MathML doesn't       \mleft/\mright → \left/\right)
                 depend on our macro set)
```

This is `storageMathml()` in [`src/pipeline.ts`](../sandbox/converters/src/pipeline.ts). The corpus is M1's 58 cases plus 2 custom-macro cases.

## Results

| | MathLive 0.111.1 | **Temml 0.14.0** | MathJax 4.1.3 |
|---|---|---|---|
| Clean on all checks* (of 60) | 46 | **60** | **60** |
| Malformed XML | 3 | 0 | 0 |
| Empty output | 3 | 0 | 0 |
| Schema problems (child counts, bare text, rows without cells) | 7 | 0 | 0 |
| Content missing (typed letters/digits absent from the MathML) | 7 | 0 | 0 |
| Chemistry (`\ce`) | none | ✓ | ✓ |
| Decimal comma `3{,}14` | `<mn>3.14</mn>` ✗ | `<mn>3,14</mn>` ✓ | `<mn>3</mn><mo>,</mo><mn>14</mn>` (faithful to TeX, split) |
| Function names (`\sin`) | `<mo>` ✗ | `<mi>` ✓ | `<mi>` ✓ |
| Colour | dropped ✗ | `style="color:…"` | `mathcolor` ✓ |
| Native rendering in Chromium (no MathJax on the page) | gaps | **best**: stretchy fences, `ℝ`, bold, box, arrows | `\mathbb`/`\mathbf` not shown (uses `mathvariant`, which Chromium ignores); matrix fences don't stretch; `\boxed` box and `\ce` arrow invisible |
| Average output size | 141 chars | 209 chars | 436 chars (a `data-latex` attribute on every node) |
| Speed per formula | 0.08 ms | **0.04 ms** | 0.35 ms |
| Bundle (min / brotli) | 335 KB / 81 KB (SSR build) | **233 KB / 56 KB** with mhchem | 297 KB / 72 KB |
| Runs in Node (server-side export) | ✓ (SSR build) | ✓ | ✓ |
| Rejects `\href{javascript:…}` | — | ✓ (unsupported) | ✓ (package not loaded) |
| Licence | MIT | MIT | Apache-2.0 |

\* The checks are: well-formed XML, `<math>` root in the MathML namespace, not empty, no `<merror>`, correct child counts for `mfrac`/`msup`/`msub`/`msubsup`/`mover`/`munder`/`munderover`/`mroot`, table rows made of `mtd` cells, no bare text outside token elements, and every letter or digit the author typed present in the output. See [`src/check.ts`](../sandbox/converters/src/check.ts).

## Why Temml

1. **It renders best with no help.** QTI delivery engines differ: some ship MathJax, some rely on the browser. Temml targets MathML Core, the subset browsers implement, so its output looks right in plain Chromium (the screenshots show this). MathJax's output assumes MathJax will render it.
2. **It keeps meaning that MathLive loses.** The decimal comma stays one number, function names are identifiers, and colour, chemistry, arrows and braces all survive.
3. **It's smallest and fastest,** and MIT-licensed like MathLive.
4. **`annotate: true` produces exactly the storage format we planned:** `<math><semantics>…<annotation encoding="application/x-tex">…</annotation></semantics></math>`, with the LaTeX XML-escaped (tested). The M1 `toPersistedMathml()` helper becomes unnecessary.

## Caveats to carry into M2

- **Temml output leans on its stylesheet for a few constructs.** `\overline`, `\cancel`, `\fbox`-style boxes and some accents use `class="tml-…"` and inline `style` attributes. Without `Temml-Local.css` (about 9 KB), `\overline` renders as plain `AB`. Compare the two screenshots. The delivery side needs that CSS, or we restrict those commands. QTI 3.0 items can reference stylesheets, but **the rule has to be checked against our delivery engine.**
- **`\boxed` is drawn with CSS** (`style="padding:3pt;border:1px solid;"`), not `<menclose>`, so a screen reader won't announce "boxed". That's minor, but relevant for accessibility.
- **`\ce` output is presentational** (`<msub><mrow></mrow><mn>2</mn></msub>`), as with any TeX-based converter. It's fine visually; speech for chemistry needs testing in the M4 accessibility pass.
- **Some MathLive-only commands have no Temml equivalent:** `\enclose`, `\bbox`, `\displaylines`, `\unicode`, `\class`, `\cssId`, `\mathtip`, `\texttip`, `\error`. `\placeholder` and `\mleft`/`\mright` are mapped by `toStandardLatex()`. The rest should stay out of authored content through the equation builder's allowed-symbols list (M3). If one does get through, the converter throws, so we can block the save instead of storing broken MathML.
- **Two renderers.** The editor (MathLive's KaTeX-style layout) and the stored MathML (rendered by the browser or delivery engine) will differ slightly in spacing and fonts. This is inherent to option 3 and acceptable for authoring, but print consistency (a hard requirement) should be judged on the *stored* MathML.
- **Only tested in Chromium.** Firefox's MathML support is older and more complete (it honours `mathvariant`), and Safari's is in between. A cross-browser render check belongs in M4.

## If MathJax renders on the delivery side

If our QTI player already loads MathJax, MathJax-generated MathML is a reasonable alternative. It is more MathML-3-semantic (`mathcolor`, `<menclose>`), but verbose, and the `data-latex` / `data-mjx-*` attributes should be stripped before storage. Nothing here rules it out. It loses to Temml only on output size and on native rendering.

## Print

The PDF pipeline can't use CSS. The stored Temml MathML converts cleanly to standalone SVG with MathJax (60/60, after a small preprocessing step). See [print-svg.md](print-svg.md).

## What this changes in the plan

- **M2 (Froala):** the persisted HTML stores the Temml output with an annotation. Editing loads the annotation's LaTeX into `<math-field>`; display uses the stored MathML (embedding strategy (b) pairs naturally with this). MathLive's `getValue('math-ml')` isn't used for storage at all.
- **M3 (builder):** the allowed-symbols list doubles as the converter's whitelist.
- **M4 (comparison):** the "Output fidelity" and "QTI 3.0 fit" rows for MathLive should be scored on the combination of MathLive editing and Temml storage.
