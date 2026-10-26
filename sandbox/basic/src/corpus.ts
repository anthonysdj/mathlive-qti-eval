// LaTeX corpus for the round-trip experiments, grouped by the palette
// categories planned for the equation builder (workstream 3).
//
// `expect` records what MathLive 0.111.1 does today. The tests in
// tests/roundtrip.test.ts assert these, so a MathLive upgrade that changes
// behaviour (for better or worse) makes a test fail and gets noticed.

export type Case = {
  id: string;
  category: string;
  latex: string;
  expect?: {
    /** getValue('latex') after setValue(latex), if different from input */
    latex?: string;
    /** substrings that must appear in getValue('math-ml') */
    mathmlHas?: string[];
    /** substrings that must NOT appear (used to pin a known loss) */
    mathmlLacks?: string[];
    /** getValue('math-ml') must be exactly this */
    mathml?: string;
  };
  /** Free-text description of a known loss; shown in findings/roundtrip.md */
  lossy?: string;
};

export const corpus: Case[] = [
  // Fractions
  { id: 'frac', category: 'Fractions', latex: '\\frac{a}{b}', expect: { mathml: '<mfrac><mi>a</mi><mi>b</mi></mfrac>' } },
  { id: 'frac-short', category: 'Fractions', latex: '\\frac12', expect: { latex: '\\frac12' } },
  { id: 'dfrac', category: 'Fractions', latex: '\\dfrac{1}{x+1}' },
  { id: 'binom', category: 'Fractions', latex: '\\binom{n}{k}' },
  { id: 'nested-frac', category: 'Fractions', latex: '\\frac{1}{1+\\frac{1}{x}}' },

  // Roots
  { id: 'sqrt', category: 'Roots', latex: '\\sqrt{x^2+1}', expect: { mathmlHas: ['<msqrt>'] } },
  { id: 'nthroot', category: 'Roots', latex: '\\sqrt[3]{x}', expect: { mathml: '<mroot><mi>x</mi><mn>3</mn></mroot>' } },

  // Powers / subscripts
  { id: 'sup', category: 'Scripts', latex: 'x^2', expect: { mathml: '<msup><mi>x</mi><mn>2</mn></msup>' } },
  { id: 'subsup', category: 'Scripts', latex: 'x_i^2', expect: { mathmlHas: ['<msubsup>'] } },
  { id: 'prime', category: 'Scripts', latex: "f'(x)" },
  { id: 'sci', category: 'Scripts', latex: '6.02\\times10^{23}' },

  // Matrices & environments
  { id: 'pmatrix', category: 'Matrices', latex: '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}', expect: { mathmlHas: ['<mtable', '<mtr>'] } },
  { id: 'bmatrix', category: 'Matrices', latex: '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}' },
  { id: 'cases', category: 'Matrices', latex: 'f(x)=\\begin{cases}1&x>0\\\\0&\\text{otherwise}\\end{cases}' },
  { id: 'aligned', category: 'Matrices', latex: '\\begin{aligned}a&=b+c\\\\&=d\\end{aligned}' },

  // Big operators
  { id: 'int', category: 'Calculus', latex: '\\int_0^1 f(x)\\,dx', expect: { mathmlHas: ['<msubsup><mo>∫</mo>'] } },
  { id: 'sum', category: 'Calculus', latex: '\\sum_{i=1}^{n} i^2', expect: { mathmlHas: ['∑'] } },
  { id: 'lim', category: 'Calculus', latex: '\\lim_{x\\to\\infty}\\frac{1}{x}', expect: { mathmlHas: ['<munder>'] } },
  { id: 'partial', category: 'Calculus', latex: '\\frac{\\partial f}{\\partial x}' },
  { id: 'oint', category: 'Calculus', latex: '\\oint_C \\vec{F}\\cdot d\\vec{r}' },

  // Brackets
  { id: 'leftright', category: 'Brackets', latex: '\\left(\\frac{a}{b}\\right)' },
  { id: 'abs', category: 'Brackets', latex: '\\left|x\\right|' },
  { id: 'norm', category: 'Brackets', latex: '\\lVert v\\rVert' },
  { id: 'angle', category: 'Brackets', latex: '\\langle u,v\\rangle' },
  { id: 'set', category: 'Brackets', latex: '\\{x\\mid x>0\\}' },

  // Greek & letters
  { id: 'greek', category: 'Greek', latex: '\\alpha+\\beta=\\Gamma', expect: { mathmlHas: ['<mi>'] } },
  { id: 'mathbb', category: 'Greek', latex: '\\mathbb{R}', expect: { mathml: '<mi>ℝ</mi>' } },
  { id: 'mathbf', category: 'Greek', latex: '\\mathbf{v}' },

  // Operators & relations
  { id: 'relations', category: 'Operators', latex: 'a\\le b\\ne c\\approx d' },
  { id: 'pm', category: 'Operators', latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
  { id: 'trig', category: 'Operators', latex: '\\sin^2\\theta+\\cos^2\\theta=1' },
  { id: 'log', category: 'Operators', latex: '\\log_2 8=3' },
  { id: 'operatorname', category: 'Operators', latex: '\\operatorname{lcm}(a,b)' },
  { id: 'logic', category: 'Operators', latex: '\\forall x\\in A,\\exists y' },
  { id: 'arrow', category: 'Operators', latex: 'A\\Rightarrow B' },

  // Accents
  { id: 'vec', category: 'Accents', latex: '\\vec{v}' },
  { id: 'hat', category: 'Accents', latex: '\\hat{x}' },
  { id: 'bar', category: 'Accents', latex: '\\bar{x}' },
  { id: 'overline', category: 'Accents', latex: '\\overline{AB}' },
  { id: 'overrightarrow', category: 'Accents', latex: '\\overrightarrow{AB}' },
  { id: 'underbrace', category: 'Accents', latex: '\\underbrace{a+b}_{n}' },
  { id: 'overbrace', category: 'Accents', latex: '\\overbrace{a+b}^{n}' },
  { id: 'mathring', category: 'Accents', latex: '\\mathring{A}' },
  { id: 'xrightarrow', category: 'Accents', latex: 'A\\xrightarrow{k}B' },

  // Chemistry
  { id: 'ce-water', category: 'Chemistry', latex: '\\ce{H2O}' },
  { id: 'ce-reaction', category: 'Chemistry', latex: '\\ce{2H2 + O2 -> 2H2O}' },
  { id: 'chem-manual', category: 'Chemistry', latex: '\\mathrm{H_2O}' },

  // Units
  { id: 'unit-mathrm', category: 'Units', latex: '9.8\\,\\mathrm{m/s^2}' },
  { id: 'unit-degree', category: 'Units', latex: '90\\degree' },
  { id: 'percent', category: 'Units', latex: '50\\%' },

  // Text & styling
  { id: 'text', category: 'Text & style', latex: '\\text{if } x>0' },
  { id: 'color', category: 'Text & style', latex: '\\textcolor{red}{x}+y' },
  { id: 'space-tilde', category: 'Text & style', latex: 'a~b' },
  { id: 'phantom', category: 'Text & style', latex: '\\phantom{x}+1' },
  { id: 'boxed', category: 'Text & style', latex: '\\boxed{x=1}' },

  // Editor-specific
  { id: 'placeholder', category: 'Editor', latex: '\\frac{\\placeholder{}}{\\placeholder{}}' },
  { id: 'prompt', category: 'Editor', latex: 'x+\\placeholder[ans]{}=5' },
  { id: 'decimal-comma', category: 'Editor', latex: '3{,}14' },
];

// Known MathML-output defects in MathLive 0.111.1, found by
// tests/probe-dump.test.ts and confirmed in src/formats/atom-to-math-ml.ts of
// the 0.111.1 source. tests/roundtrip.test.ts asserts each one is *still*
// present, so an upgrade that fixes one fails the test and the entry can be
// removed.
export type Defect =
  | 'malformed-xml' // output is not well-formed XML (breaks QTI / XHTML)
  | 'empty' // no MathML at all
  | 'body-lost' // part of the expression is missing
  | 'invalid-structure' // well-formed, but violates the MathML schema
  | 'style-dropped' // visual styling not carried over
  | 'semantics-changed'; // renders differently / means something else

export const knownDefects: Record<string, { defect: Defect; note: string }> = {
  relations: { defect: 'malformed-xml', note: '`\\ne` / `\\neq` is emitted as the HTML entity `&ne;`, which is undefined in XML (atom-to-math-ml.ts:399).' },
  prompt: { defect: 'malformed-xml', note: '`\\placeholder[id]{}` emits `<menclose notation="roundexbox""">` (stray quotes, atom-to-math-ml.ts:1088).' },
  'ce-water': { defect: 'empty', note: '`\\ce{}` (mhchem) produces no MathML: the `chem` case is an empty `break` (atom-to-math-ml.ts:1121).' },
  'ce-reaction': { defect: 'empty', note: 'Same as above: chemistry is lost entirely in MathML.' },
  overline: { defect: 'empty', note: '`\\overline` / `\\underline` (`line` atom) produce nothing (atom-to-math-ml.ts:893).' },
  overrightarrow: { defect: 'body-lost', note: '`\\overrightarrow{AB}` becomes `<mover>→</mover>`: the base `AB` is dropped and `<mover>` has one child.' },
  underbrace: { defect: 'body-lost', note: '`\\underbrace{a+b}_n` becomes `<munder>⏟</munder>`: the braced expression is dropped.' },
  placeholder: { defect: 'invalid-structure', note: 'Empty `\\placeholder{}` becomes a bare `?` text node, so `\\frac{■}{■}` is `<mfrac>??</mfrac>`.' },
  prime: { defect: 'invalid-structure', note: "`f'` gives `<msup>` with 3 children (an `&#x2061;` function-application `<mo>` is inserted inside it)." },
  binom: { defect: 'invalid-structure', note: '`\\binom` emits `<mtr>` rows with no `<mtd>` cells.' },
  'space-tilde': { defect: 'malformed-xml', note: '`~` and `\\ ` emit `&nbsp;` (HTML-only entity) as a bare child of `<mrow>` (atom-to-math-ml.ts:1094).' },
  overbrace: { defect: 'body-lost', note: '`\\overbrace{a+b}^n` becomes `<mover>⏞</mover>`: the braced expression is dropped.' },
  xrightarrow: { defect: 'invalid-structure', note: '`\\xrightarrow{k}` becomes `<munderover>→<mi>k</mi></munderover>`: 2 children and a bare text node.' },
  mathring: { defect: 'semantics-changed', note: '`\\mathring{A}` emits `<mo>730</mo>`: the decimal code point of ˚ as literal text.' },
  phantom: { defect: 'body-lost', note: '`\\phantom` is dropped instead of `<mphantom>`, so spacing differs from the rendered field.' },
  color: { defect: 'style-dropped', note: '`\\textcolor` / `\\color` are not carried into MathML (no `mathcolor`).' },
  'decimal-comma': { defect: 'semantics-changed', note: '`3{,}14` is emitted as `<mn>3.14</mn>`: the decimal comma becomes a point.' },
};
