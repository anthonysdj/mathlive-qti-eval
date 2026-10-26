# NOTES

Running log of versions, surprises, bugs and workarounds. Newest first.

## Pinned versions

| Package | Version | Where | Why |
|---|---|---|---|
| `mathlive` | **0.111.1** (exact) | `sandbox/basic` | Subject of the study. Latest release (2026-10-09). It fixes 3 XSS advisories in `\enclose`, `\htmlData`/`\href` and the MathML output, so don't go below it. Source reference: commit `30ad20a7` of arnog/mathlive (there's no git tag). |
| `mathml-to-latex` | 1.8.0 (exact) | `sandbox/basic` (runtime) | MathLive cannot read MathML. We need *some* MathML→LaTeX path to re-hydrate annotation-less content (Wiris, legacy). Used by `src/serialize.ts` as the fallback only. MIT. |
| `vite` | 8.3.5 | dev | Sandbox dev server and build. |
| `vitest` + `@vitest/browser-playwright` | 5.0.5 | dev | MathLive needs a real browser (layout, FontFace, custom elements, adoptedStyleSheets), so tests run in Chromium, not jsdom. |
| `playwright` | 1.64.1 | dev | Browser driver for Vitest and the runtime-check script. |
| `typescript` | 7.0.2 | dev | Type checking (`pnpm typecheck`). |
| `@types/node` | 22 | dev | Types for the config files and scripts. |

On machines with a pre-installed Chromium that doesn't match Playwright's build, set `PW_CHROMIUM=/path/to/chrome` (the cloud container uses `/opt/pw-browsers/chromium`). Otherwise run `pnpm exec playwright install chromium`.

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
