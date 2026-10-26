# Spike: print path — stored MathML → SVG images for the PDF engine

**Context.** Ton recalls that our PDF pipeline uses **RenderX** (most likely XEP, an XSL-FO formatter) and that formulas are turned into images before layout. **Not yet confirmed: which engine and image format are actually in use.** An XSL-FO pipeline doesn't use CSS, so Temml's stylesheet can't help there. The question is whether the MathML we plan to store (Temml output, see [mathml-converters.md](mathml-converters.md)) turns into correct images.

**Answer: yes. All 60 corpus formulas render correctly as standalone SVG,** server-side in Node with MathJax 4.1.3 (MathML input → SVG output, New Computer Modern font). That needs one small preprocessing step, explained below. It takes about 1.7 ms per formula, and an image averages 2.9 KB (largest 10.3 KB).

- **Evidence:** [`sandbox/converters/tests/print.node.test.ts`](../sandbox/converters/tests/print.node.test.ts) (63 tests).
- **Code:** [`src/print.ts`](../sandbox/converters/src/print.ts).
- **Side by side** (screen rendering vs the SVG image): [`print-svg.html`](print-svg.html) and [`screenshots/print-svg.png`](screenshots/print-svg.png).

## The pipeline

```
stored <math> (Temml) ──prepareForSvg()──► MathJax MathML input ──► SVG (fontCache: 'none')
                                                                        │
                                                    one self-contained file per formula,
                                                    glyphs inlined as <path>, no fonts needed
                                                                        ▼
                                                        XSL-FO <fo:external-graphic> → XEP → PDF
```

## What needed fixing (found by looking at the images, not by the tests)

On the first run, three things were wrong:

| Problem | Cause | Fix in `prepareForSvg()` |
|---|---|---|
| Matrix entries overlapped their brackets (`pmatrix`, `bmatrix`) and `cases` was clipped on the right | Temml spaces columns with `style="padding-…"` on every `<mtd>`, and MathJax misreads it | Strip `style` from `<mtd>`, so MathJax uses its own TeX-style column spacing |
| `\vec` and `\bar` accents vanished, but only on a page that also loaded Temml's CSS | MathJax copies Temml's `class="tml-…"` onto the SVG, where Temml's CSS then restyles the glyphs | Strip `class` attributes (they only mean something with Temml's CSS) |

After the fix, all 60 formulas look right in the side-by-side page. That includes matrices, cases, aligned, chemistry, `\boxed`, colour, arrows, braces, the decimal comma and `ℝ`. `\cancel` is checked separately. Other inline styles are kept, because MathJax honours them, which is why `\boxed` and colour survive. The tests pin all of this, so a Temml or MathJax upgrade that changes it will fail loudly.

## Screen vs print will look slightly different

The screen uses the browser's math font (Chromium's default, or Temml's CSS font stack), while print uses MathJax's New Computer Modern. Layout, symbols and structure match, but glyph shapes and spacing differ a little (compare the two columns). If identical screen and print output becomes a requirement, render the screen with MathJax too, from the same stored MathML. That's a delivery choice and doesn't change what we store. **Measured in [consistency.md](consistency.md):** with the same SVG on both sides, screen and print differ by 0.28% of pixels (median), anti-aliasing only.

## Open points

1. **Confirm the engine and format.** Is it XEP, and does it embed SVG or need PNG? XEP renders SVG natively (as far as I know; to be verified against our version). If PNG is required, add an SVG→PNG step (e.g. resvg), which is cheap.
2. **Accessible PDFs.** The SVGs carry `role="img"` but no text alternative. For tagged or accessible PDFs, each image needs alt text. MathLive's `convertLatexToSpeakableText()` or Speech Rule Engine (SRE) on the MathML can produce it, and XEP needs it passed through. This belongs with the M4 accessibility pass.
3. **Where Wiris fits.** If today's images come from Wiris's server-side rendering service, this pipeline replaces it, and it runs fully offline. That's a point for the M4 comparison: architecture, offline use, vendor risk.
4. **Not yet run inside XEP itself.** The SVGs are standard and self-contained, but the real proof is one XEP render of an FO file that embeds a few of them. That needs an XEP licence or trial, or access to our existing pipeline.
