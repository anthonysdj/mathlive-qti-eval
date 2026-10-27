# Can MathLive reproduce MathType?

MathLive **0.111.1**, Temml **0.14.0**, MathJax **4.1.3**, speech-rule-engine **5.0.0-rc.4**, mathml-to-latex **1.8.0**, Froala **5.5.0**.

The question: can everything Wiris MathType does be done with MathLive's `<math-field>` plus our LaTeX → MathML pipeline? This is a feature-by-feature check, not a licensing or adoption decision. Every "reproduced" points to a test in this repo. The MathType side comes from its documented toolbar and features and from its open-source integration code (`@wiris/mathtype-froala` 8.15.4, `mathtype-html-integration-devkit` 1.17.17, read in M2). No MathType trial was run, so nothing here measures MathType itself.

**Answer: almost everything, except handwriting.** Every MathType toolbar notation we listed (78 of them, across all 11 tabs plus ChemType) can be built in `<math-field>`, stored as MathML, printed and read aloud. Three needed a small name mapping, and column arithmetic needs a different MathML structure. Handwriting is the one thing that can't be done without a third-party recogniser. The main gaps are in moving content from MathType, typing inside chemistry, and MathLive's own spoken text. Workarounds are below, and most of them are built and tested here.

| | Notations (§1) | Other features (§3–§8) |
|---|---|---|
| ✅ Reproduced | 78 of 78 | 23 |
| 🟡 Partial (works, with a stated limit or a workaround) | (column arithmetic is stored as a table, §2) | 12 |
| ❌ Not possible with MathLive alone | 0 | 1 (handwriting) |

| | Where |
|---|---|
| Feature list (MathType toolbar → LaTeX) | [`sandbox/wiris-parity/src/features.ts`](../sandbox/wiris-parity/src/features.ts) |
| Pipeline check per formula | [`src/run.ts`](../sandbox/wiris-parity/src/run.ts), [`tests/notation.test.ts`](../sandbox/wiris-parity/tests/notation.test.ts) → [`findings/wiris-parity-raw.json`](../findings/wiris-parity-raw.json) |
| MathType MathML import | [`src/wiris-import.ts`](../sandbox/wiris-parity/src/wiris-import.ts), [`src/wiris-samples.ts`](../sandbox/wiris-parity/src/wiris-samples.ts), [`tests/wiris-import.test.ts`](../sandbox/wiris-parity/tests/wiris-import.test.ts) → [`findings/wiris-import-raw.json`](../findings/wiris-import-raw.json) |
| Name mappings MathLive ↔ Temml | `toStandardLatex()` / `toFieldLatex()` in [`sandbox/converters/src/pipeline.ts`](../sandbox/converters/src/pipeline.ts) |
| Copy/paste MathML, `$$…$$` in text | [`src/editor-extras.ts`](../sandbox/wiris-parity/src/editor-extras.ts), [`tests/editor.test.ts`](../sandbox/wiris-parity/tests/editor.test.ts) |
| Alt text and braille | [`tests/speech.node.test.ts`](../sandbox/wiris-parity/tests/speech.node.test.ts) → [`findings/wiris-speech.json`](../findings/wiris-speech.json) |
| Tests | 140 (131 in Chromium, 9 in Node) |

## 1. Notation: MathType's toolbar

Each MathType template was written as LaTeX and run through the whole pipeline ([`run.ts`](../sandbox/wiris-parity/src/run.ts)):

1. **MathLive** parses it with no errors (`validateLatex`), draws it with no error boxes, and gives it back from the field.
2. **Stored MathML**: the same path as the Froala dialog (`latex-expanded` → standard LaTeX → Temml), and the MathML passes the structural check from the converter spike.
3. **Print**: MathJax draws an SVG from that MathML.
4. **MathLive's spoken text** isn't empty.

| MathType tab | Templates checked | MathLive | Stored MathML | Print SVG | MathLive speech |
|---|---|---|---|---|---|
| General (fractions, roots, scripts, brackets, text, functions) | 14 | 14 | 14 | 14 | 14 |
| Symbols (operators, relations, sets, ℕℤℚℝℂ, logic, geometry) | 8 | 8 | 8 | 8 | 8 |
| Arrows (incl. labelled arrows, harpoons) | 3 | 3 | 3 | 3 | 3 |
| Greek | 2 | 2 | 2 | 2 | 2 |
| Matrices (pmatrix, bmatrix, determinant, dots, cases, systems, aligned steps, column alignment, binomial) | 9 | 9 | 9 | 9 | 8 |
| Scripts and layouts (over/under, left scripts, line break) | 3 | 3 | 3 | 3 | 1 |
| Decorations (accents, wide accents, segment/ray, arc, braces, cancel, boxed, circled, repeating decimal) | 9 | 9 | 9 | 9 | 7 |
| Big operators | 4 | 4 | 4 | 4 | 4 |
| Calculus (integrals ∫∬∭∮, limits, derivatives, ∂, ∇, evaluation bar) | 7 | 7 | 7 | 7 | 7 |
| Format (colour, background, bold, font styles, size, spacing, units) | 7 | 7 | 7 | 7 | 7 |
| Elementary math (column addition, carries, multiplication, long division) | 4 | 4 | 4 | 4 | 4 |
| ChemType (formulas, reactions, equilibrium, ions, states, isotopes, conditions, bonds) | 8 | 8 | 8 | 8 | **0** |
| **Total** | **78** | **78** | **78** | **78** | **65** |

A 79th entry is a known failure kept as a test: column arithmetic written with `\hline` (see below).

What needed care:

- **Arc over letters.** MathLive draws `\overarc`, Temml doesn't know it. `toStandardLatex()` ([`pipeline.ts`](../sandbox/converters/src/pipeline.ts)) stores it as `\wideparen`, which is the same arc in both.
- **Long division and circled.** MathLive writes `\enclose{longdiv}{…}` and `\enclose{circle}{…}`. Temml has no `\enclose`, but it has `\longdiv` and `\textcircled`, which give the same `<menclose>`. `toStandardLatex()` maps them for storage and `toFieldLatex()` maps them back when a stored equation is loaded into the field (Froala dialog and `latexOf()`).
- **Column arithmetic** is a right-aligned `array` with `\underline` for the line. **MathLive 0.111.1 has no `\hline`** (error box), which is the usual way to draw the line in LaTeX.
- **MathLive's spoken text is empty for all of chemistry, aligned steps, over/underset, line breaks, segment arrows and boxed**, and wrong for some it does read: `\enclose{circle}` and `\enclose{longdiv}` come out as "crossed out", floor/ceiling as "of 'X'", and labelled arrows and cases lose their content. This is only the authoring-time feedback, though. What delivery and screen readers use is the stored MathML (§5).

So for notation the answer is ✅. The limits are in how column arithmetic is represented (§2) and in typing chemistry (§3).

## 2. Elementary math (column arithmetic, long division) 🟡

MathType writes these as MathML elementary math (`<mstack>`, `<msrow>`, `<mscarries>`, `<msline>`, `<mlongdiv>`). LaTeX has nothing for them, so we can draw the same layout (§1) but store it as an `<mtable>`, not `<mstack>`.

Two findings matter for existing MathType content ([`wiris-import.test.ts`](../sandbox/wiris-parity/tests/wiris-import.test.ts), "MathType elementary math as stored"):

- **MathJax 4.1.3 can't draw `<mstack>` or `<mlongdiv>` at all** ("Unknown node type"), and MathJax is our display and print renderer. **Chromium's native MathML draws an `<mstack>` as one line** (MathML Core has no elementary math). So MathType's elementary math can't be displayed as stored, by us or by a browser.
- The importer turns them into the array layout, so they display, print and can be edited again. It's an approximation: digits line up by right alignment only (MathType's `stackalign`, `charalign` and `position` are not kept), and long division is always drawn the US way. Other `longdivstyle` values are noted as approximations.

Hand-writing `<mstack>` MathML ourselves would keep the semantics, but then nothing we use could draw it. The array layout is the workable choice.

## 3. Chemistry (ChemType) 🟡

| | MathType (ChemType) | Ours | |
|---|---|---|---|
| Formulas, charges, states, isotopes, reaction arrows, conditions, bonds | ChemType toolbar | mhchem `\ce{…}`: all 8 in §1 store, print and display | ✅ |
| Building it | ChemType toolbar, upright element symbols | Text entry in the builder's Chemistry tab (M3), because **MathLive's `\ce{}` can't be typed into** | 🟡 |
| Editing an existing `\ce` | in place | delete and type it again (M3 open item) | 🟡 |
| Speech while authoring | n/a | MathLive has none for `\ce` | 🟡 |
| Speech from stored MathML | MathType's service | speech-rule-engine reads it, but as "normal H of sub 2 …" ([`wiris-speech.json`](../findings/wiris-speech.json) → `ce-reaction`) | 🟡 |
| Separate "insert chemistry" button | in its Froala plugin | one button; the dialog could open on the Chemistry tab | 🟡 (easy) |
| ChemType content from MathType | upright `<mi mathvariant="normal">` | imported as `\mathrm{H}_{2}` etc. (not `\ce`): it displays and edits correctly | ✅ |

## 4. Editor features

| MathType | How we do it | Status | Evidence |
|---|---|---|---|
| Template palette with tabs | Builder panel: 19 categories, 199 templates, Tab between empty boxes. It has a tab for each MathType toolbar tab (Arrows, Decorations, Big operators, Format and Elementary math were added after this check; screenshots `findings/screenshots/builder-tab-*.png`) | ✅ | M3, [`docs/03`](03-equation-builder.md) §2, `builder-check.json` → `mathtypeTabs` |
| Custom toolbars (toolbar XML, hiding tabs) | Allowed-symbols profiles hide tabs and refuse typed input too | ✅ | M3 §4 |
| Type LaTeX directly | Native in `<math-field>` | ✅ | M1 |
| Keyboard navigation inside the formula | Native arrows, Tab between slots | ✅ | M1, M3 |
| Undo / redo inside the editor | Native | ✅ | `editor.test.ts` "undo and redo" |
| Styling a selection (colour, background, size, bold) | `applyStyle()` on the selection; all four store and print | ✅ | `editor.test.ts` "Format tab on a selection" |
| Copy a formula as MathML (e.g. into Word) | MathLive copies LaTeX only. `enableMathmlCopy()` adds the stored MathML as `text/html` | 🟡 workaround built | `editor.test.ts` |
| Paste MathML into the editor | MathLive reads LaTeX only. `enableMathmlPaste()` converts pasted MathML with the importer | 🟡 workaround built | `editor.test.ts` |
| Drag pieces into the formula | Builder drag and drop | ✅ | M3 §8 |
| Touch / mobile | Custom virtual keyboard on touch devices | ✅ | M3 §5 |
| **Handwriting** | MathLive has no handwriting recognition. It would need a third-party recogniser (for example MyScript or Mathpix, both commercial services) that returns LaTeX for `setValue()`. Not built. | ❌ | — |
| Editor UI languages | MathLive ships 15 (ar, de, el, en, es, fr, he, it, ja, ko, pl, pt, uk, zh-cn, zh-tw). Our builder's labels are English only and would need translating. MathType documents more languages (not counted here). | 🟡 | `editor.test.ts` "15 languages" |
| Manual line break inside a formula | No line break key; authors use an aligned or gathered template. MathType's line breaks import as `aligned` | 🟡 | §1, `wiris-import.test.ts` |
| Saved formulas / shortcuts | Saved equations with inline shortcuts | ✅ (MathType has no equivalent we know of) | M3 §9 |

## 5. Accessibility

| MathType | Ours | Status | Evidence |
|---|---|---|---|
| Alt text for formula images from its accessibility service, in several languages | speech-rule-engine (already inside MathJax) makes the text from the stored MathML, on a server or in the browser, with no outside service. Checked for all 78 formulas in English, Spanish, French, German and Italian (SRE has 16 locales) | ✅ | [`speech.node.test.ts`](../sandbox/wiris-parity/tests/speech.node.test.ts) |
| Braille | SRE gives Nemeth braille for all 78. Its `euro` braille returned nothing for some formulas, so it isn't counted | ✅ (Nemeth) | same |
| Screen readers in delivery | Our display keeps the stored `<math>` in the DOM for screen readers (M2). MathType's images rely on alt text instead | ✅ | M2 §5 |
| Reads structure | SRE reads what MathLive misses: "2 cases Case 1: …", "floor of x plus ceiling of y", "right arrow with under below and over above", "2 lines Line 1: …" | ✅ | `wiris-speech.json` |
| Spoken feedback while authoring | MathLive's own text, English only, empty or wrong for 13 of 78 (§1). MathLive can use SRE instead (`textToSpeechRules = 'sre'`); not tried | 🟡 | `notation.test.ts` |
| Keyboard-only and screen reader use of the editor | Builder panel: real buttons, tablist, labels. MathLive's virtual keyboard keycaps have no roles or tab stops | 🟡 | M3 §5 |

Real screen reader testing (NVDA, JAWS, VoiceOver) is still not done.

## 6. Output and existing content

| MathType | Ours | Status | Evidence |
|---|---|---|---|
| MathML output | Temml MathML with the LaTeX annotation, valid for QTI | ✅ | converter spike, §1 |
| Formula images (PNG/SVG) from its render service | MathJax SVG, client or server (Node or Java), and PNG via resvg | ✅ | print and Java spikes |
| Viewer (display formulas on a page) | `<math-eq>` with the MathJax SVG and the MathML for screen readers | ✅ | M2 |
| Reading MathType save modes (xml, safeXml, image, LaTeX annotation, handwriting strokes) | Froala plugin hydrates all of them | ✅ | M2 §6 |
| MathType MathML into the editor | See below | ✅ with the new importer | `wiris-import.test.ts` |
| `$$…$$` LaTeX in the text (MathType's LaTeX parse mode) | `parseLatexInText()` turns it into stored MathML before Froala loads it, then it's an ordinary equation. Text inside `<code>` and LaTeX that Temml rejects stay as text | ✅ built | `editor.test.ts` |

**Plain mathml-to-latex (what the Froala plugin uses today to make MathType content editable) loses a lot of what MathType writes.** It turns upright letters italic (units, chemistry), drops colour, background and size, turns `<mfenced>` parentheses into square brackets, writes broken LaTeX for a brace with no closing fence (piecewise functions), turns a circle into a box, puts line breaks where MathLive rejects them, and flattens column arithmetic into a row of digits. [`wiris-import.ts`](../sandbox/wiris-parity/src/wiris-import.ts) handles each of these before mathml-to-latex sees them. All 20 samples then load into the field, store and print again, and keep what they had:

| MathType writes | Plain mathml-to-latex | With the importer |
|---|---|---|
| `<mi mathvariant="normal">m</mi>` (units) | `m` (italic) | `\mathrm{m}` |
| `<mstyle mathcolor="#FF0000">` | colour dropped | `\textcolor{#FF0000}{x}` |
| `<mstyle mathbackground>` / `mathsize="24px"` | dropped | `\colorbox{…}{$…$}` / `{\Large x}` |
| `<mfenced><mtable>` | `bmatrix` (wrong brackets) | `\left(\begin{matrix}…\right)` |
| `<mfenced open="{" close="">` | invalid LaTeX | `\left\{…\right.` |
| `<menclose notation="circle">` | `\boxed` | `\enclose{circle}` |
| `<mover>` with ⌒ / → | `\overset{⌒}` / `\overset{\rightarrow}` | `\wideparen` / `\vec` |
| `<mmultiscripts>` (isotope) | `{}_{92}^{235}U` | `{}_{92}^{235}\mathrm{U}` |
| `<mspace linebreak="newline">` | `a + b \\ = c` (rejected) | `\begin{aligned}&a + b\\&= c\end{aligned}` |
| `<mstack>`, `<mlongdiv>` | digits in a row | array layout (§2) |

The importer isn't wired into the Froala plugin yet. Doing that means calling `importMathml()` where `fromPersistedMathml()` is called today, and converting elementary math on load so it displays (§2). **The samples follow MathType's output conventions, but they're not real items from our database.** A batch of real MathType items is still the best test of this.

## 7. Froala plugin behaviour

Everything from MathType's Froala plugin that we rely on is in M2 ([`docs/02`](02-froala-integration.md)): insert button and shortcut, click to edit, the formula as one unit for caret/Backspace/Delete/selection, copy and paste inside the editor, pasting MathML or MathType images from elsewhere, undo/redo, keeping MathML through Froala's sanitizer, and swapping formats in `html.get`/`html.set` the way MathType's plugin does. ✅

Differences: MathType shows formulas as `<img>` in the editor. We show an SVG in a custom element, which is the same SVG as print. MathType has a separate ChemType button (§3).

## 8. Styling and theming

| MathType | Ours | Status |
|---|---|---|
| Default formula font size and colour | CSS on `<math-eq>` and the field | ✅ |
| Per-part colour, background, size, bold | §1 Format, §4 styling a selection | ✅ |
| Choice of math font family | MathJax SVG uses New Computer Modern. Another font needs another MathJax font package. Screen and print would still match, because both use the same SVG | 🟡 not tried |
| Editor theming | CSS custom properties and `::part()`, dark theme | ✅ (M3 §10) |

## 9. What only MathType's servers did

MathType's integration calls Wiris services for formula images, alt text and LaTeX ↔ MathML conversion. Each one has a local replacement here: images from the MathJax SVG print path, alt text from speech-rule-engine (§5), LaTeX → MathML from Temml, and MathML → LaTeX from the importer (§6). Nothing has to leave the browser or our own servers.

## Not possible, or not done

- **Handwriting input**: not possible with MathLive alone. It needs a commercial recogniser that returns LaTeX.
- **Typing inside `\ce{}`** and editing an existing one in place (MathLive limitation, M3).
- **Elementary math as `<mstack>`** in stored MathML: we store an array layout instead (§2).
- **Wiring the importer and the copy/paste helpers into the Froala plugin and the Angular app.** They're built and tested in `sandbox/wiris-parity` only.
- **Real MathType content** from our database, and **real screen reader testing**.
- **A MathType trial** to compare the authoring experience hands-on.

## Running it

```sh
cd sandbox/wiris-parity
pnpm test     # 131 tests in Chromium + 9 in Node (set PW_CHROMIUM if Playwright's browser isn't installed)
pnpm dump     # regenerate findings/wiris-parity-raw.json and findings/wiris-import-raw.json
              # (then pnpm test again: the Node speech test reads the first and writes findings/wiris-speech.json)
```
