# Round-trip findings: LaTeX → `<math-field>` → MathML → back

MathLive **0.111.1**, Chromium 1243 (Playwright), mathml-to-latex 1.8.0. Recorded 2026-10-26.

- **Evidence:** [`sandbox/basic/tests/roundtrip.test.ts`](../sandbox/basic/tests/roundtrip.test.ts) (assertions) and [`roundtrip-raw.json`](roundtrip-raw.json) (every output for every case, written by `pnpm probe`).
- **Corpus:** [`sandbox/basic/src/corpus.ts`](../sandbox/basic/src/corpus.ts), 58 cases grouped by the palette categories planned for the equation builder.
- **Defect list:** `knownDefects` in the same file. Each defect is pinned by a test that **fails when MathLive fixes it**, so we notice when an upgrade changes things.

## Summary

| Path | Result |
|---|---|
| LaTeX → field → `getValue('latex')` | **Lossless on all 58 cases.** The output is byte-identical to the input and stable when fed back in. MathLive keeps the author's spelling (`\frac12` stays `\frac12`). |
| LaTeX → `getValue('math-ml')` | **41 of 58 corpus cases are clean.** 17 have a defect: 3 give malformed XML, 3 give no MathML at all, 4 drop part of the expression, 4 break the MathML schema, 1 drops colour, and 2 change the meaning. Details below. User-defined macros are also dropped (tested separately). |
| Persisted `<math><semantics>…<annotation encoding="application/x-tex">` → LaTeX | **Lossless whenever the MathML is well-formed** (55 of 58). The 3 malformed cases cannot even be parsed as XML, so the annotation inside them can't be read either. |
| MathML only (no annotation, e.g. older or third-party content) → mathml-to-latex → field | 36 of 58 give identical MathML after the trip, and 3 of those are empty both ways. 13 change and 9 fail to convert. Function names (`\sin`, `\log`, `\lim`, `\operatorname`) come back as separate letters. |

**What this means for QTI:** storing LaTeX in the annotation makes editing lossless. The MathML that MathLive generates is **not safe to store as-is**: some outputs are not well-formed XML, which would make a QTI item invalid, and some silently lose content (chemistry, `\overline`, arrows, braces). Before M2 we need to either (a) post-process and validate MathLive's MathML, or (b) generate the stored MathML with a different LaTeX→MathML converter and use MathLive only for editing. That choice belongs to workstream 2/4 and needs a quick spike (Temml or MathJax are the obvious candidates).

## Defects in MathLive's MathML output

All of these were confirmed in the 0.111.1 source, `src/formats/atom-to-math-ml.ts`. Line numbers refer to the release commit `30ad20a7`.

| Case | LaTeX | Kind | What happens |
|---|---|---|---|
| relations | `a\le b\ne c\approx d` | malformed XML | `\ne`/`\neq` → `<mo>&ne;</mo>`. `&ne;` is an HTML entity and is undefined in XML (l. 399). |
| space-tilde | `a~b`, `a\ b` | malformed XML | Emits a bare `&nbsp;` between elements (l. 1094). |
| prompt | `x+\placeholder[ans]{}=5` | malformed XML | `<menclose notation="roundexbox""">`: a typo in the source (l. 1088). |
| ce-water, ce-reaction | `\ce{H2O}` | empty | The `chem` atom case is an empty `break` (l. 1121). **All mhchem chemistry is lost in MathML.** |
| overline | `\overline{AB}` | empty | The `line` atom (`\overline`, `\underline`) produces nothing (l. 893). |
| overrightarrow | `\overrightarrow{AB}` | body lost | `<mover>→</mover>`: the base `AB` is dropped. |
| underbrace / overbrace | `\underbrace{a+b}_n` | body lost | `<munder>⏟</munder>`: the braced expression is dropped. |
| phantom | `\phantom{x}+1` | body lost | Dropped, where `<mphantom>` was expected. Spacing differs from the field. |
| placeholder | `\frac{\placeholder{}}{\placeholder{}}` | invalid | Each placeholder becomes a bare `?`, giving `<mfrac>??</mfrac>`. |
| prime | `f'(x)` | invalid | `<msup>` gets 3 children (an `&#x2061;` is inserted inside it). |
| binom | `\binom{n}{k}` | invalid | `<mtr>` rows have no `<mtd>` cells. |
| xrightarrow | `A\xrightarrow{k}B` | invalid | `<munderover>→<mi>k</mi></munderover>` has 2 children, one of them a bare text node. |
| color | `\textcolor{red}{x}` | style dropped | No `mathcolor`. Colour is lost. |
| decimal-comma | `3{,}14` | meaning changed | `<mn>3.14</mn>`: the decimal comma becomes a point. |
| mathring | `\mathring{A}` | meaning changed | `<mo>730</mo>`: the code point of ˚ is printed as decimal text. |
| custom macros | `x\in\R` with `macros = {R: '\mathbb{R}'}` | body lost | **User-defined macros vanish from MathML**: the output is `<mrow><mi>x</mi><mo>∈</mo></mrow>`. Workaround: `convertLatexToMathMl(mf.getValue('latex-expanded'))` gives the right result (`lifecycle.test.ts`). Built-in macros such as `\differentialD` are fine. |

Smaller issues that are well-formed but worth knowing:

- Function names are emitted as `<mo>sin</mo>` / `<mo>log</mo>` / `<mo>lim</mo>`. MathML convention, and MathML Core, use `<mi>`. Converters and screen readers then treat them as operators.
- `\partial f` gets a spurious function-application `<mo>&#x2061;</mo>` after `f`.
- `\mathrm{m/s^2}` becomes one `<mi mathvariant="normal">m/s</mi>` token. Units need a convention, e.g. `\mathrm{m}/\mathrm{s}^2`, to give usable MathML.
- `columnalign` on matrices always lists 10 values (`"center center … "`), whatever the column count.
- Characters are a mix of numeric references (`&#x03b1;`) and raw UTF-8 (`β`), and token elements sometimes have a stray space (`<mtext >`). Both are harmless but noisy in diffs.

## Spoken text (`getValue('spoken-text')`) gaps

These are relevant to the accessibility requirement. Screen readers read MathLive's ARIA live region, which uses this same generator.

- **Empty:** `\boxed`, `\overline`, `\overrightarrow`, `\ce`, `aligned`.
- **Truncated:** the `cases` example reads only "'F' of 'X' equals". The whole piecewise body is missing.
- **Wrong:** `a\le b\ne c` reads "… 'B' 'C' …", so `≠` is missing. `\log_2 8` reads "log sub 28", because subscript and argument run together. `\lVert v\rVert` reads " of 'V'".

## Lossless where it matters for editing

- `getValue('latex')` returned the exact input for all 58 cases, including environments, `\ce{}`, prompts and `{,}`.
- Feeding that output back in gave the same LaTeX every time (`latexStable` in the raw data).
- The annotation helper ([`src/serialize.ts`](../sandbox/basic/src/serialize.ts)) escapes `<`, `&` and `>`, and recovers LaTeX from any annotation labelled `application/x-tex`, `LaTeX`, `TeX` or `text/x-latex` (tests in `serialize.test.ts`).

## Not yet covered

- **Real Wiris content.** The "Wiris-like" samples in `serialize.test.ts` are hand-written shapes, not captured output. Real samples come with the Wiris trial sandbox (M4).
- **Firefox and Safari.** Only Chromium has been run so far. The event timing in particular is browser-dependent (see the source comments about Firefox/Safari blur).

## Full case table

Generated from `roundtrip-raw.json`. "MathML-only trip" means: take MathLive's MathML, drop the annotation, convert it with mathml-to-latex, load the result into the field, and compare the new MathML with the original.

| Case | LaTeX in | MathML well-formed | MathML-only trip | Spoken |
|---|---|---|---|---|
| frac | `\frac{a}{b}` | yes | identical | 'A' over 'B' |
| frac-short | `\frac12` | yes | identical | half |
| dfrac | `\dfrac{1}{x+1}` | yes | identical | the fraction 1 over 'X' plus 1. End fraction. |
| binom | `\binom{n}{k}` | yes | changed → `\begin{pmatrix} n \\ k \end{pmatrix}` | 'N' over 'K' |
| nested-frac | `\frac{1}{1+\frac{1}{x}}` | yes | identical | the fraction 1 over 1 plus 1 over 'X'. End fraction. |
| sqrt | `\sqrt{x^2+1}` | yes | identical | the square root of 'X' squared plus 1. End square root |
| nthroot | `\sqrt[3]{x}` | yes | identical | the cube root of 'X'. End cube root |
| sup | `x^2` | yes | identical | 'X' squared |
| subsup | `x_i^2` | yes | identical | 'X' squared sub 'I' |
| prime | `f'(x)` | yes | error: msup tag must have exactly 2 children. It's actually 3 | 'F' to the prime; of 'X' |
| sci | `6.02\times10^{23}` | yes | identical | 6.02 times 10 raised to the 23 power; |
| pmatrix | `\begin{pmatrix}1&2\\3&4\end{pmatrix}` | yes | identical | begin parenthesis matrix row 1 column 1: 1, column 2: 2, row 2 column 1: 3, column 2: 4 end parenthesis matrix |
| bmatrix | `\begin{bmatrix}a&b\\c&d\end{bmatrix}` | yes | identical | begin square brackets matrix row 1 column 1: 'A', column 2: 'B', row 2 column 1: 'C', column 2: 'D' end square brackets matrix |
| cases | `f(x)=\begin{cases}1&x>0\\0&\text{otherwise}\end{cases}` | yes | identical | 'F' of 'X' equals |
| aligned | `\begin{aligned}a&=b+c\\&=d\end{aligned}` | yes | identical | _(empty)_ |
| int | `\int_0^1 f(x)\,dx` | yes | changed → `\int_{0}^{1} f \left(x\right) d x` | the integral from 0 to 1 of 'F' of 'X' 'D' 'X' |
| sum | `\sum_{i=1}^{n} i^2` | yes | identical | the summation from 'I' equals 1 to 'N' of 'I' squared |
| lim | `\lim_{x\to\infty}\frac{1}{x}` | yes | changed → `\underset{x \rightarrow \infty}{lim} \frac{1}{x}` | lim subscript 'X' to infinity. End subscript. 1 over 'X' |
| partial | `\frac{\partial f}{\partial x}` | yes | identical | the fraction partial derivative of 'F' over partial derivative of 'X'. End fraction. |
| oint | `\oint_C \vec{F}\cdot d\vec{r}` | yes | changed → `\oint_{C} \overset{⃗}{F} \cdot d \overset{⃗}{r}` | ∮ sub 'capital C'vector 'capital F' times 'D'vector 'R' |
| leftright | `\left(\frac{a}{b}\right)` | yes | identical | Open paren. 'A' over 'B' Close paren. |
| abs | `\left\|x\right\|` | yes | identical | Vertical bar 'X'Vertical bar |
| norm | `\lVert v\rVert` | yes | changed → `\left\\|v\right\\|` | of 'V' |
| angle | `\langle u,v\rangle` | yes | identical | left angle bracket 'U' comma 'V' right angle bracket |
| set | `\{x\mid x>0\}` | yes | changed → `\left\{x \mid x > 0\right\}` | open brace 'X' mid 'X' is greater than 0 close brace |
| greek | `\alpha+\beta=\Gamma` | yes | identical | alpha plus beta equals Gamma |
| mathbb | `\mathbb{R}` | yes | identical | 'capital R' |
| mathbf | `\mathbf{v}` | yes | identical | 'V' |
| relations | `a\le b\ne c\approx d` | **no** | error: Invalid MathML: This page contains the following errors:erro | 'A' is less than or equal to 'B' 'C' approx 'D' |
| pm | `x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}` | yes | identical | 'X' equals the fraction minus 'B' plus or minus the square root of 'B' squared minus 4 'A' 'C'. End square root over 2 'A'. End fraction. |
| trig | `\sin^2\theta+\cos^2\theta=1` | yes | changed → `sin^{2} \theta + cos^{2} \theta = 1` | sine squared theta plus cosine squared theta equals 1 |
| log | `\log_2 8=3` | yes | changed → `log_{2} 8 = 3` | log sub 28 equals 3 |
| operatorname | `\operatorname{lcm}(a,b)` | yes | changed → `lcm \left(a , b\right)` | lcm Open paren. 'A' comma 'B' Close paren. |
| logic | `\forall x\in A,\exists y` | yes | identical | for all 'X' element of 'capital A' comma there exists 'Y' |
| arrow | `A\Rightarrow B` | yes | identical | 'capital A' implies 'capital B' |
| vec | `\vec{v}` | yes | changed → `\overset{⃗}{v}` | vector 'V' |
| hat | `\hat{x}` | yes | identical | hat over 'X' |
| bar | `\bar{x}` | yes | identical | 'X' bar |
| overline | `\overline{AB}` | empty | identical | _(empty)_ |
| overrightarrow | `\overrightarrow{AB}` | yes | error: mover tag must have exactly 2 children. It's actually 0 | _(empty)_ |
| underbrace | `\underbrace{a+b}_{n}` | yes | error: munder tag must have exactly 2 children. It's actually 0 | sub 'N' |
| overbrace | `\overbrace{a+b}^{n}` | yes | error: mover tag must have exactly 2 children. It's actually 0 | to the 'N'; |
| mathring | `\mathring{A}` | yes | changed → `\overset{730}{A}` | ring over 'capital A' |
| xrightarrow | `A\xrightarrow{k}B` | yes | error: munderover tag must have exactly 3 children. It's actually 1 | 'capital A' 'capital B' |
| ce-water | `\ce{H2O}` | empty | identical | _(empty)_ |
| ce-reaction | `\ce{2H2 + O2 -> 2H2O}` | empty | identical | _(empty)_ |
| chem-manual | `\mathrm{H_2O}` | yes | changed → `H_{2} O` | 'capital H' sub 2 'capital O' |
| unit-mathrm | `9.8\,\mathrm{m/s^2}` | yes | changed → `9.8 m/s^{2}` | 9.8 'M'/ 'S' squared |
| unit-degree | `90\degree` | yes | identical | 90 degree |
| percent | `50\%` | yes | identical | 50 % |
| text | `\text{if } x>0` | yes | identical | if 'X' is greater than 0 |
| color | `\textcolor{red}{x}+y` | yes | identical | 'X' plus 'Y' |
| space-tilde | `a~b` | **no** | error: Invalid MathML: This page contains the following errors:erro | 'A' 'B' |
| phantom | `\phantom{x}+1` | yes | identical | plus 1 |
| boxed | `\boxed{x=1}` | yes | identical | _(empty)_ |
| placeholder | `\frac{\placeholder{}}{\placeholder{}}` | yes | error: mfrac tag must have exactly 2 children. It's actually 0 | placeholder over placeholder |
| prompt | `x+\placeholder[ans]{}=5` | **no** | error: Invalid MathML: This page contains the following errors:erro | 'X' plus blank. . equals 5 |
| decimal-comma | `3{,}14` | yes | identical | 3.14 |
