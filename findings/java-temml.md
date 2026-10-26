# Spike: Temml on a Java backend

**Question.** Temml is JavaScript only, and there is no Java port. Can a Java backend still use it to convert LaTeX to the MathML we store?

**Answer: yes.** GraalJS, the JavaScript engine from the GraalVM project, runs as a normal Maven dependency on a standard JDK. Inside it, Temml produces **byte-identical MathML to Node for all 60 test formulas**, and it rejects the same attacks. No Node process is needed.

- **Code:** [`sandbox/java-temml`](../sandbox/java-temml): `TemmlConverter.java` (about 70 lines) and 76 JUnit tests.
- **Run:** `cd sandbox/converters && pnpm install`, then `cd ../java-temml && mvn test`. JDK 21 and Maven are required.
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
- **This covers Temml only, not the SVG step.** MathJax (MathML → SVG) is much larger and loads fonts on demand through ES-module imports. Running it in GraalJS is untested. Options:
  - try MathJax in GraalJS next;
  - keep a small Node service just for SVG;
  - make the SVG in the browser and only check it on the server. This is weaker, because the SVG would come from the client.
- **Size.** The GraalJS runtime jars add 61 MB to the backend (measured from the resolved Maven dependencies).
