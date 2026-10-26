# MathLive `<math-field>` deep dive

Evaluating MathLive for a QTI 3.0 authoring tool: how it works, Froala integration, an equation builder, and a comparison with Wiris MathType.

| Milestone | Status | Deliverable |
|---|---|---|
| M1 Fundamentals | done | [`docs/01-how-mathfield-works.md`](docs/01-how-mathfield-works.md), [`findings/roundtrip.md`](findings/roundtrip.md) |
| Spike: MathML for storage | in review | [`findings/mathml-converters.md`](findings/mathml-converters.md) |
| Spike: print path (MathML → SVG) | in review | [`findings/print-svg.md`](findings/print-svg.md) |
| Spike: screen/print consistency | in review | [`findings/consistency.md`](findings/consistency.md) |
| M2 Froala | not started | |
| M3 Equation builder | not started | |
| M4 Decision | not started | |

Surprises and version pins are in [`NOTES.md`](NOTES.md).

## Running the basic sandbox

```sh
pnpm install
cd sandbox/basic
pnpm dev            # demo page: field + LaTeX/MathML/speech panels + live event log
pnpm test           # Vitest in headless Chromium (set PW_CHROMIUM if Playwright's browser isn't installed)
pnpm probe          # regenerate findings/roundtrip-raw.json and findings/events-raw.json
pnpm size           # bundle-size table
pnpm runtime-check  # CSP / Trusted Types / fonts / many-equations timings → stdout (JSON)
pnpm ssr-check      # what MathLive offers under Node
```

## Running the converters sandbox

```sh
cd sandbox/converters
pnpm test      # 255 tests: converter output (Chromium) + print path SVG and screen/print consistency (Node)
pnpm compare   # regenerate findings/mathml-converters-raw.json and -timing.json
pnpm gallery   # converters rendered side by side (HTML + screenshots)
pnpm print     # Temml MathML → SVG for print, side by side with screen rendering
pnpm consistency  # pixel-diff the same SVG on screen (Chromium) vs print (resvg) → findings/consistency.html
pnpm size      # bundle size per converter
```
