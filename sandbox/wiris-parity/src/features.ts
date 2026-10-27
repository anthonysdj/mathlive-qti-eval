// What MathType (Wiris) lets an author build, written as the LaTeX we would
// produce for it with MathLive. The groups follow the tabs of the MathType
// web editor toolbar (General, Symbols, Arrows, Greek, Matrices, Scripts and
// layouts, Decorations, Big operators, Calculus, Format, Elementary math) and
// ChemType's toolbar. Each entry is one template or notation from that tab.
//
// The checks in tests/notation.test.ts run every entry through the whole
// pipeline: MathLive parses and renders it, Temml turns it into the MathML we
// store, MathJax draws the print SVG, and MathLive speaks it.

export type Feature = {
  id: string;
  /** MathType toolbar tab (or ChemType) the template comes from */
  tab: string;
  name: string;
  latex: string;
  /**
   * Known to fail somewhere in the pipeline. The tests assert the failure, so
   * a newer MathLive or Temml that fixes it makes the test fail and the doc
   * gets updated.
   */
  expect?: Partial<Record<Stage, 'fails'>>;
  /** Why it fails and what we do instead */
  note?: string;
};

export type Stage = 'mathlive' | 'temml' | 'svg' | 'spoken';

export const FEATURES: Feature[] = [
  // --- General -----------------------------------------------------------
  { id: 'frac', tab: 'General', name: 'Fraction', latex: '\\frac{a+1}{b}' },
  { id: 'bevelled', tab: 'General', name: 'Bevelled (slash) fraction', latex: '{}^{a}\\!/_{b}' },
  { id: 'sqrt', tab: 'General', name: 'Square root', latex: '\\sqrt{x^2+1}' },
  { id: 'nroot', tab: 'General', name: 'n-th root', latex: '\\sqrt[3]{27}' },
  { id: 'sup', tab: 'General', name: 'Superscript', latex: 'x^{2}' },
  { id: 'sub', tab: 'General', name: 'Subscript', latex: 'a_{n}' },
  { id: 'subsup', tab: 'General', name: 'Sub- and superscript', latex: 'x_{i}^{2}' },
  { id: 'parens', tab: 'General', name: 'Stretchy brackets', latex: '\\left(\\frac{a}{b}\\right)' },
  { id: 'brackets', tab: 'General', name: 'Square, curly, angle brackets', latex: '\\left[x\\right]\\left\\{y\\right\\}\\left\\langle z\\right\\rangle' },
  { id: 'abs', tab: 'General', name: 'Absolute value and norm', latex: '\\left|x\\right|+\\left\\|v\\right\\|' },
  { id: 'floor', tab: 'General', name: 'Floor and ceiling', latex: '\\lfloor x\\rfloor+\\lceil y\\rceil' },
  { id: 'onesided', tab: 'General', name: 'One-sided bracket', latex: '\\left.\\frac{df}{dx}\\right|_{x=0}' },
  { id: 'text', tab: 'General', name: 'Text in a formula', latex: '\\text{area}=\\pi r^2' },
  { id: 'func', tab: 'General', name: 'Recognised function names', latex: '\\sin x+\\cos x+\\log_{2}x+\\ln x' },

  // --- Symbols -------------------------------------------------------------
  { id: 'ops', tab: 'Symbols', name: 'Operators', latex: 'a\\pm b\\mp c\\times d\\div e\\cdot f' },
  { id: 'rel', tab: 'Symbols', name: 'Relations', latex: 'a\\le b\\ge c\\ne d\\approx e\\equiv f\\sim g\\cong h\\propto i' },
  { id: 'notrel', tab: 'Symbols', name: 'Negated relations', latex: 'a\\not\\equiv b\\nless c\\nsubseteq D' },
  { id: 'sets', tab: 'Symbols', name: 'Set notation', latex: 'A\\cup B\\cap C\\subset D\\subseteq E\\in F\\notin G\\setminus H\\emptyset' },
  { id: 'numsets', tab: 'Symbols', name: 'Number sets', latex: '\\mathbb{N}\\subset\\mathbb{Z}\\subset\\mathbb{Q}\\subset\\mathbb{R}\\subset\\mathbb{C}' },
  { id: 'logic', tab: 'Symbols', name: 'Logic', latex: '\\forall x\\exists y\\neg p\\land q\\lor r\\Rightarrow s\\Leftrightarrow t' },
  { id: 'geometry', tab: 'Symbols', name: 'Geometry symbols', latex: '\\angle ABC=90^{\\circ},\\ AB\\parallel CD,\\ AB\\perp BC,\\ \\triangle ABC' },
  { id: 'misc', tab: 'Symbols', name: 'Infinity, dots, primes', latex: "\\infty,\\ \\ldots,\\ \\cdots,\\ \\vdots,\\ \\ddots,\\ f'(x)" },

  // --- Arrows --------------------------------------------------------------
  { id: 'arrows', tab: 'Arrows', name: 'Arrows', latex: '\\to\\leftarrow\\leftrightarrow\\Rightarrow\\Leftarrow\\uparrow\\downarrow\\mapsto' },
  { id: 'arrowlabel', tab: 'Arrows', name: 'Arrow with text over and under', latex: 'A\\xrightarrow[\\text{under}]{\\text{over}}B' },
  { id: 'harpoons', tab: 'Arrows', name: 'Harpoons', latex: '\\rightleftharpoons\\rightharpoonup\\leftharpoondown' },

  // --- Greek ---------------------------------------------------------------
  { id: 'greek', tab: 'Greek', name: 'Lower-case Greek', latex: '\\alpha\\beta\\gamma\\delta\\epsilon\\varepsilon\\theta\\lambda\\mu\\pi\\sigma\\phi\\varphi\\omega' },
  { id: 'Greek', tab: 'Greek', name: 'Upper-case Greek', latex: '\\Gamma\\Delta\\Theta\\Lambda\\Pi\\Sigma\\Phi\\Psi\\Omega' },

  // --- Matrices ------------------------------------------------------------
  { id: 'pmatrix', tab: 'Matrices', name: 'Matrix in parentheses', latex: '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}' },
  { id: 'bmatrix', tab: 'Matrices', name: 'Matrix in square brackets', latex: '\\begin{bmatrix}a&b&c\\\\d&e&f\\end{bmatrix}' },
  { id: 'det', tab: 'Matrices', name: 'Determinant', latex: '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}' },
  { id: 'matdots', tab: 'Matrices', name: 'Matrix with dots', latex: '\\begin{pmatrix}a_{11}&\\cdots&a_{1n}\\\\\\vdots&\\ddots&\\vdots\\\\a_{m1}&\\cdots&a_{mn}\\end{pmatrix}' },
  { id: 'cases', tab: 'Matrices', name: 'Piecewise function', latex: 'f(x)=\\begin{cases}x&x\\ge0\\\\-x&x<0\\end{cases}' },
  { id: 'system', tab: 'Matrices', name: 'System of equations', latex: '\\left\\{\\begin{aligned}2x+y&=5\\\\x-y&=1\\end{aligned}\\right.' },
  { id: 'align', tab: 'Matrices', name: 'Aligned steps (align at =)', latex: '\\begin{aligned}(a+b)^2&=(a+b)(a+b)\\\\&=a^2+2ab+b^2\\end{aligned}', expect: { spoken: 'fails' } },
  { id: 'colalign', tab: 'Matrices', name: 'Table with column alignment', latex: '\\begin{array}{lcr}a&b&c\\\\aaa&bbb&ccc\\end{array}' },
  { id: 'binom', tab: 'Matrices', name: 'Binomial coefficient', latex: '\\binom{n}{k}' },

  // --- Scripts and layouts -------------------------------------------------
  { id: 'over', tab: 'Scripts and layouts', name: 'Over and under scripts', latex: '\\overset{\\text{def}}{=}\\ \\underset{n}{\\max}', expect: { spoken: 'fails' } },
  { id: 'prescript', tab: 'Scripts and layouts', name: 'Left scripts (pre-sub/superscript)', latex: '{}_{a}^{b}X' },
  { id: 'linebreak', tab: 'Scripts and layouts', name: 'Line break inside a formula', latex: '\\begin{gathered}a+b+c\\\\=d\\end{gathered}', expect: { spoken: 'fails' } },

  // --- Decorations ---------------------------------------------------------
  { id: 'accents', tab: 'Decorations', name: 'Accents', latex: '\\hat{a}\\ \\bar{b}\\ \\vec{v}\\ \\dot{x}\\ \\ddot{y}\\ \\tilde{n}' },
  { id: 'wide', tab: 'Decorations', name: 'Wide accents', latex: '\\widehat{ABC}\\ \\widetilde{xy}\\ \\overline{AB}' },
  { id: 'segment', tab: 'Decorations', name: 'Segment, ray, line (geometry)', latex: '\\overline{AB}\\ \\overrightarrow{AB}\\ \\overleftrightarrow{AB}', expect: { spoken: 'fails' } },
  { id: 'arc', tab: 'Decorations', name: 'Arc over letters', latex: '\\overarc{AB}', note: 'Temml has no \\overarc; compat.ts stores it as \\wideparen, the same arc.' },
  { id: 'braces', tab: 'Decorations', name: 'Over- and underbrace with label', latex: '\\underbrace{a+\\cdots+a}_{n}\\ \\overbrace{b+b}^{2}' },
  { id: 'cancel', tab: 'Decorations', name: 'Cancel (strike-through)', latex: '\\frac{\\cancel{2}x}{\\cancel{2}}\\ \\bcancel{y}\\ \\xcancel{z}' },
  { id: 'boxed', tab: 'Decorations', name: 'Boxed result', latex: '\\boxed{x=2}', expect: { spoken: 'fails' } },
  { id: 'repeating', tab: 'Decorations', name: 'Repeating decimal', latex: '0.\\overline{3}' },

  // --- Big operators -------------------------------------------------------
  { id: 'sum', tab: 'Big operators', name: 'Sum with limits', latex: '\\sum_{i=1}^{n}i^2' },
  { id: 'prod', tab: 'Big operators', name: 'Product', latex: '\\prod_{k=1}^{n}k' },
  { id: 'bigcup', tab: 'Big operators', name: 'Big union and intersection', latex: '\\bigcup_{i}A_i\\ \\bigcap_{j}B_j' },
  { id: 'coprod', tab: 'Big operators', name: 'Coproduct, big O-plus', latex: '\\coprod_{i}X_i\\ \\bigoplus_{k}V_k' },

  // --- Calculus ------------------------------------------------------------
  { id: 'int', tab: 'Calculus', name: 'Definite integral', latex: '\\int_{0}^{1}x^2\\,\\mathrm{d}x' },
  { id: 'iint', tab: 'Calculus', name: 'Double, triple and contour integrals', latex: '\\iint_{D}f\\,\\mathrm{d}A\\ \\iiint_{V}g\\,\\mathrm{d}V\\ \\oint_{C}F\\cdot\\mathrm{d}r' },
  { id: 'lim', tab: 'Calculus', name: 'Limit', latex: '\\lim_{x\\to0}\\frac{\\sin x}{x}=1' },
  { id: 'deriv', tab: 'Calculus', name: 'Derivative', latex: '\\frac{\\mathrm{d}y}{\\mathrm{d}x}' },
  { id: 'partial', tab: 'Calculus', name: 'Partial derivative', latex: '\\frac{\\partial^2 f}{\\partial x\\,\\partial y}' },
  { id: 'nabla', tab: 'Calculus', name: 'Gradient, divergence', latex: '\\nabla f,\\ \\nabla\\cdot\\vec{F}' },
  { id: 'evalbar', tab: 'Calculus', name: 'Evaluation bar', latex: '\\left[F(x)\\right]_{a}^{b}' },

  // --- Format --------------------------------------------------------------
  { id: 'color', tab: 'Format', name: 'Text colour', latex: '\\textcolor{red}{x}+\\textcolor{#0000ff}{y}' },
  { id: 'bgcolor', tab: 'Format', name: 'Background colour', latex: '\\colorbox{yellow}{$x+1$}' },
  { id: 'bold', tab: 'Format', name: 'Bold and upright', latex: '\\mathbf{v}+\\boldsymbol{\\alpha}+\\mathrm{d}' },
  { id: 'fonts', tab: 'Format', name: 'Font styles (script, fraktur, sans, mono)', latex: '\\mathcal{L}\\ \\mathfrak{g}\\ \\mathsf{A}\\ \\mathtt{x}' },
  { id: 'size', tab: 'Format', name: 'Font size', latex: '{\\large x}+{\\small y}+{\\Huge z}' },
  { id: 'spacing', tab: 'Format', name: 'Manual spacing', latex: 'a\\,b\\;c\\quad d\\qquad e\\!f' },

  // --- Elementary math ----------------------------------------------------
  // MathType writes these as MathML elementary math (<mstack>, <mlongdiv>),
  // which LaTeX has no standard notation for. These are the closest LaTeX
  // layouts; tests/wiris-mathml.test.ts checks what happens to Wiris's own MathML.
  { id: 'stack-hline', tab: 'Elementary math', name: 'Column addition, line as \\hline', latex: '\\begin{array}{r}123\\\\+\\,456\\\\\\hline579\\end{array}', expect: { mathlive: 'fails' }, note: 'MathLive 0.111.1 has no \\hline: an error box. Use \\underline on the row above the line instead.' },
  { id: 'stack-add', tab: 'Elementary math', name: 'Column addition', latex: '\\begin{array}{r}123\\\\\\underline{+\\,456}\\\\579\\end{array}' },
  { id: 'carries', tab: 'Elementary math', name: 'Column addition with carries', latex: '\\begin{array}{r}\\scriptstyle1\\phantom{0}\\\\58\\\\\\underline{+\\,67}\\\\125\\end{array}' },
  { id: 'stack-mul', tab: 'Elementary math', name: 'Column multiplication', latex: '\\begin{array}{r}23\\\\\\underline{\\times\\,12}\\\\46\\\\\\underline{23\\phantom{0}}\\\\276\\end{array}' },
  { id: 'longdiv', tab: 'Elementary math', name: 'Long division (US style)', latex: '\\begin{array}{r}41\\\\3\\enclose{longdiv}{125}\\end{array}', note: 'Temml has no \\enclose; compat.ts stores it as \\longdiv, which gives the same <menclose notation="longdiv">.' },
  { id: 'circled', tab: 'Decorations', name: 'Circled', latex: '\\enclose{circle}{5}', note: 'Stored as \\textcircled (compat.ts).' },

  // --- ChemType ------------------------------------------------------------
  { id: 'ce-formula', tab: 'ChemType', name: 'Chemical formula', latex: '\\ce{H2SO4}', expect: { spoken: 'fails' } },
  { id: 'ce-reaction', tab: 'ChemType', name: 'Reaction with arrow', latex: '\\ce{2H2 + O2 -> 2H2O}', expect: { spoken: 'fails' } },
  { id: 'ce-equilibrium', tab: 'ChemType', name: 'Equilibrium arrow', latex: '\\ce{N2 + 3H2 <=> 2NH3}', expect: { spoken: 'fails' } },
  { id: 'ce-ions', tab: 'ChemType', name: 'Ions and charges', latex: '\\ce{SO4^2- + Ba^2+ -> BaSO4 v}', expect: { spoken: 'fails' } },
  { id: 'ce-states', tab: 'ChemType', name: 'States of matter', latex: '\\ce{NaCl(aq) + AgNO3(aq) -> AgCl(s) + NaNO3(aq)}', expect: { spoken: 'fails' } },
  { id: 'ce-isotope', tab: 'ChemType', name: 'Isotope (mass and atomic number)', latex: '\\ce{^{235}_{92}U}', expect: { spoken: 'fails' } },
  { id: 'ce-conditions', tab: 'ChemType', name: 'Reaction conditions over the arrow', latex: '\\ce{CaCO3 ->[\\Delta] CaO + CO2}', expect: { spoken: 'fails' } },
  { id: 'ce-bonds', tab: 'ChemType', name: 'Bonds', latex: '\\ce{H-C#N}', expect: { spoken: 'fails' } },

  // --- Units (MathType's "units" are upright text) ----------------------------
  { id: 'units', tab: 'Format', name: 'Units', latex: '9.8\\,\\mathrm{m}/\\mathrm{s}^{2}' },
];
