# Spike: Temml and MathJax on a Java backend

**Question.** Temml is JavaScript only, and there is no Java port. Can a Java backend still use it to convert LaTeX to the MathML we store?

**Answer: yes.** GraalJS, the JavaScript engine from the GraalVM project, runs as a normal Maven dependency on a standard JDK. Inside it, Temml produces **byte-identical MathML to Node for all 60 test formulas**, and it rejects the same attacks. No Node process is needed.

The same goes for the SVG step (see [MathJax SVG in Java](#mathjax-svg-in-java) below): MathJax in GraalJS gives **byte-identical SVG to Node for all 60 formulas**, so the whole backend path (LaTeX → stored MathML → SVG image) can run in Java.

- **Code:** [`sandbox/java-temml`](../sandbox/java-temml): `TemmlConverter.java` and `MathmlToSvg.java` (about 70 lines each), 200 JUnit tests.
- **Run:** `cd sandbox/converters && pnpm install && pnpm build:svg-sync`, then `cd ../java-temml && mvn test`. JDK 21 and Maven are required.
- **Tested on:** OpenJDK 21.0.12, GraalJS 24.2.1 (`org.graalvm.polyglot:polyglot` + `js-community`), and Temml 0.14.0, loaded from the same npm package the browser uses.

## What the tests show

| Check | Result |
|---|---|
| All 60 corpus formulas give the same MathML as Temml in Node (from `findings/mathml-converters-raw.json`) | 60/60 identical |
| Stored form has the LaTeX annotation | ✓ |
| `\href`, `\url`, `\includegraphics`, `\class`, `\style`, `\data`, `\htmlData`, `\cssId`, `\unicode`, bad colour, macro loop | all rejected |
| Script and image tags typed into `\text` or the annotation | escaped, never markup |
| 1,500 levels of nested braces | rejected cleanly (no crash) |
| Formula over 4,000 characters | rejected before Temml runs |
| `\rule{100000em}{100000em}` | capped at 20em (`maxSize`) |
| Speed, warm | about 2.3 ms per formula |

## How it's set up

- **Sandboxed engine.** The JavaScript context gets no host access, files, network or threads (`allowAllAccess(false)`).
- **Hardened settings:** Temml's `trust` stays off, `throwOnError: true`, `maxSize: [20, 200]`, and a 4,000-character limit. Any error means "don't save".
- **Threads:** a GraalJS context serves one thread at a time. The method is `synchronized`; a busy server would use one converter per thread or a small pool.
- **One Temml version.** Maven copies `temml.js` and `mhchem.js` from `sandbox/converters/node_modules`, so the browser preview and the server can't drift apart. In production, pin the same version on both sides.

## Caveats

- **Speed.** On a standard JDK, GraalJS runs interpreted. 2.3 ms is fine for saving items, but about 50 times slower than Node (0.04 ms). On the GraalVM JDK, or with its JIT enabled, it would be much faster. Not measured.
- **Size.** The GraalJS runtime jars add 61 MB to the backend (measured from the resolved Maven dependencies).

## MathJax SVG in Java

Tested 2026-10-26 with MathJax 4.1.3 and its New Computer Modern font, the same versions as the browser and the Node print path.

| Check | Result |
|---|---|
| Stored Temml MathML → SVG, compared with `mathmlToSvg()` in Node (`findings/print-svg-raw.json`) | 60/60 byte-identical |
| End to end in Java: LaTeX → `TemmlConverter` (with annotation) → `MathmlToSvg` | 60/60 identical to Node |
| Rare glyphs (`\mathbb`, `\mathfrak`, `\mathscr`) | drawn, nothing loaded at run time |
| Output is self-contained (glyphs as paths, no `<use>`, sized in ex) | ✓ |
| Empty, oversized or malformed MathML | an error, and the converter keeps working |
| Speed, warm (quadratic formula) | about 25 ms per formula, interpreted |
| Start-up (loading the bundle once per engine) | about 1.9 s |

**How.** MathJax normally loads rarer glyph ranges (double-struck, fraktur, …) on demand with ES-module imports, which GraalJS can't do from a sandbox. [`src/svg-sync.ts`](../sandbox/converters/src/svg-sync.ts) compiles every range into one classic script (`pnpm build:svg-sync`, 12 MB unminified, almost all of it glyph outlines) and tells MathJax its loader is synchronous (`mathjax.asyncIsSynchronous`), so a conversion is a single function call with no Promises or event loop. It uses the same `prepareForSvg()` as the print path, now in its own module ([`src/prepare-svg.ts`](../sandbox/converters/src/prepare-svg.ts)). Maven copies the bundle into the jar, so Java and the browser can't drift apart. The engine is sandboxed the same way as Temml's.

**Speed.** 25 ms is fine for making the image once on save and caching it (keyed by a hash of the MathML), which is the planned design. It's 15 times slower than Node (1.7 ms), because a standard JDK runs GraalJS without its JIT compiler. With the JIT it should be much faster, but I couldn't measure it here:
- Graal 24.2's JIT compiler needs JDK 24 or later; it won't load on JDK 21 (`jdk.graal.compiler does not read a module that exports jdk.vm.ci.services`).
- Running a downloaded GraalVM JDK wasn't allowed in this sandbox.

Worth measuring on the real backend's JDK if volume matters. The other option is still a small Node service for SVG only.
