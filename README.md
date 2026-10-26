# MathLive `<math-field>` deep dive

Evaluating MathLive for a QTI 3.0 authoring tool: how it works, Froala integration, an equation builder, and a comparison with Wiris MathType.

| Milestone | Status | Deliverable |
|---|---|---|
| M1 Fundamentals | done | [`docs/01-how-mathfield-works.md`](docs/01-how-mathfield-works.md), [`findings/roundtrip.md`](findings/roundtrip.md) |
| Spike: MathML for storage | done | [`findings/mathml-converters.md`](findings/mathml-converters.md) |
| Spike: print path (MathML → SVG) | done | [`findings/print-svg.md`](findings/print-svg.md) |
| Spike: screen/print consistency | done | [`findings/consistency.md`](findings/consistency.md) |
| Demo: render an inserted equation | done | [`findings/insert-demo.md`](findings/insert-demo.md) |
| Spike: Temml and MathJax on a Java backend | done | [`findings/java-temml.md`](findings/java-temml.md) |
| M2 Froala | in review | [`docs/02-froala-integration.md`](docs/02-froala-integration.md) |
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

## Running the Froala sandbox and the Angular demo

```sh
cd sandbox/froala
pnpm dev                        # Froala + equation plugin: load, edit, save, reload, Wiris content
pnpm test                       # 96 tests in Chromium
pnpm build && pnpm demo:check   # drive the built demo, screenshots

cd apps/authoring               # Angular 22: needs Node >= 22.22.3 or 24.15
pnpm start
pnpm build && pnpm check        # insert/edit/save/reload + teardown checks
```

## Running the converters sandbox

```sh
cd sandbox/converters
pnpm dev       # insert-equation demo: MathLive → stored MathML → SVG in the page
pnpm test      # 384 tests: converters + rendering in the page (Chromium), print path + screen/print consistency (Node)
pnpm compare   # regenerate findings/mathml-converters-raw.json and -timing.json
pnpm gallery   # converters rendered side by side (HTML + screenshots)
pnpm print     # Temml MathML → SVG for print, side by side with screen rendering
pnpm build && pnpm demo:shot  # drive the built demo and screenshot it
pnpm consistency  # pixel-diff the same SVG on screen (Chromium) vs print (resvg) → findings/consistency.html
pnpm size      # bundle size per converter
```
