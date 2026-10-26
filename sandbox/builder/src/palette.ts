// The equation builder's template palette: one definition that both the
// in-dialog panel and the custom virtual keyboard are built from.
//
// Insert strings use MathLive's insert syntax (MathfieldElement.insert):
//   #?  an empty slot (\placeholder{}); Tab moves to the next one
//   #0  the current selection, or an empty slot: wraps what is selected
//   #@  the "implicit argument": the selection, or the term just before the
//       caret (3x then x² gives 3x^2), or an empty slot
// Everything inserted is standard LaTeX that Temml converts, so stored
// MathML never depends on a MathLive-only command or one of our macros. The
// one exception is MathLive's \differentialD, which `latex-expanded` writes
// as \mathrm{d}: after a literal \mathrm{d}, MathLive types the variable into
// the same upright group (\mathrm{dx}), so integrals and derivatives use it.

export type CategoryId =
  | 'fractions'
  | 'roots'
  | 'scripts'
  | 'brackets'
  | 'operators'
  | 'relations'
  | 'greek'
  | 'functions'
  | 'calculus'
  | 'matrices'
  | 'sets'
  | 'geometry'
  | 'chemistry'
  | 'units'
  // The author's saved equations (saved.ts): not in CATEGORIES, the host adds the tab
  | 'saved';

export interface PaletteItem {
  id: string;
  /** Accessible name and tooltip, in words: authors may not know the symbol's name in LaTeX */
  label: string;
  /** What gets inserted (MathLive insert syntax, see above) */
  insert: string;
  /** What the button shows, if not the insert string with its slots */
  display?: string;
}

/**
 * An entry that takes typed text rather than a template, for notation the
 * math field can't edit in place. MathLive shows `\ce{…}` as one atom
 * whose content can't be typed into (typing into `\ce{#?}` does nothing, and
 * into `\ce{#0}` it produces `undefined{…}`), and text typed into
 * `\mathrm{#?}` comes out italic or as `\operatorname` (tests/notation.test.ts).
 */
export interface TextEntry {
  id: string;
  label: string;
  placeholder: string;
  /** LaTeX for the text the author typed; throws if it can't be used */
  toLatex(text: string): string;
}

export interface Category {
  id: CategoryId;
  label: string;
  /** Short label for the keyboard's layout switcher */
  short: string;
  items: PaletteItem[];
  entry?: TextEntry;
}

const sym = (id: string, latex: string, label: string): PaletteItem => ({ id, label, insert: latex });

const GREEK_LOWER: [string, string][] = [
  ['alpha', 'alpha'], ['beta', 'beta'], ['gamma', 'gamma'], ['delta', 'delta'], ['epsilon', 'epsilon'],
  ['zeta', 'zeta'], ['eta', 'eta'], ['theta', 'theta'], ['lambda', 'lambda'], ['mu', 'mu'],
  ['pi', 'pi'], ['rho', 'rho'], ['sigma', 'sigma'], ['tau', 'tau'], ['phi', 'phi'],
  ['chi', 'chi'], ['psi', 'psi'], ['omega', 'omega'],
];
const GREEK_UPPER = ['Gamma', 'Delta', 'Theta', 'Lambda', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'];

// Text typed into a text entry goes inside a LaTeX group: refuse what would
// break out of it or smuggle in commands.
function plainText(text: string, allowed: RegExp, what: string): string {
  const t = text.trim();
  if (!t) throw new Error(`Type a ${what} first.`);
  if (!allowed.test(t)) throw new Error(`A ${what} can't contain ${JSON.stringify(t.match(/[\\{}$%#&~^_]/)?.[0] ?? t)}.`);
  return t;
}

export const CATEGORIES: Category[] = [
  {
    id: 'fractions',
    label: 'Fractions',
    short: 'a/b',
    items: [
      { id: 'frac', label: 'Fraction', insert: '\\frac{#@}{#?}' },
      { id: 'mixed', label: 'Mixed number', insert: '#?\\frac{#?}{#?}' },
      { id: 'slash', label: 'Fraction with a slash', insert: '#@/#?' },
      { id: 'dfrac', label: 'Large fraction', insert: '\\dfrac{#@}{#?}' },
    ],
  },
  {
    id: 'roots',
    label: 'Roots',
    short: '√',
    items: [
      { id: 'sqrt', label: 'Square root', insert: '\\sqrt{#0}' },
      { id: 'cbrt', label: 'Cube root', insert: '\\sqrt[3]{#0}' },
      { id: 'nroot', label: 'Nth root', insert: '\\sqrt[#?]{#0}' },
    ],
  },
  {
    id: 'scripts',
    label: 'Powers and subscripts',
    short: 'xⁿ',
    items: [
      { id: 'square', label: 'Squared', insert: '#@^2' },
      { id: 'cube', label: 'Cubed', insert: '#@^3' },
      { id: 'power', label: 'Power', insert: '#@^{#?}' },
      { id: 'subscript', label: 'Subscript', insert: '#@_{#?}' },
      { id: 'subsup', label: 'Subscript and power', insert: '#@_{#?}^{#?}' },
      { id: 'inverse', label: 'Inverse (power minus one)', insert: '#@^{-1}' },
      { id: 'exp', label: 'e to the power', insert: 'e^{#?}' },
      { id: 'sci', label: 'Times ten to the power', insert: '\\times10^{#?}' },
    ],
  },
  {
    id: 'brackets',
    label: 'Brackets',
    short: '( )',
    items: [
      { id: 'paren', label: 'Parentheses', insert: '\\left(#0\\right)' },
      { id: 'square-br', label: 'Square brackets', insert: '\\left[#0\\right]' },
      { id: 'brace', label: 'Braces', insert: '\\left\\lbrace#0\\right\\rbrace' },
      { id: 'abs', label: 'Absolute value', insert: '\\left|#0\\right|' },
      { id: 'norm', label: 'Norm', insert: '\\left\\Vert#0\\right\\Vert' },
      { id: 'angle-br', label: 'Angle brackets', insert: '\\left\\langle#0\\right\\rangle' },
      { id: 'floor', label: 'Floor', insert: '\\left\\lfloor#0\\right\\rfloor' },
      { id: 'ceil', label: 'Ceiling', insert: '\\left\\lceil#0\\right\\rceil' },
    ],
  },
  {
    id: 'operators',
    label: 'Operators',
    short: '±×',
    items: [
      // Plain signs are typed, but someone building by dragging needs them too
      sym('plus', '+', 'Plus'),
      sym('minus', '-', 'Minus'),
      sym('plus-minus', '\\pm', 'Plus or minus'),
      sym('minus-plus', '\\mp', 'Minus or plus'),
      sym('times', '\\times', 'Times'),
      sym('cdot', '\\cdot', 'Dot (multiply)'),
      sym('div', '\\div', 'Divided by'),
      sym('infty', '\\infty', 'Infinity'),
      sym('percent', '\\%', 'Percent'),
      sym('factorial', '!', 'Factorial'),
      sym('ldots', '\\ldots', 'Dots'),
    ],
  },
  {
    id: 'relations',
    label: 'Relations',
    short: '≤',
    items: [
      sym('eq', '=', 'Equals'),
      sym('lt', '<', 'Less than'),
      sym('gt', '>', 'Greater than'),
      sym('ne', '\\ne', 'Not equal to'),
      sym('le', '\\le', 'Less than or equal to'),
      sym('ge', '\\ge', 'Greater than or equal to'),
      sym('approx', '\\approx', 'Approximately equal to'),
      sym('equiv', '\\equiv', 'Identical to'),
      sym('propto', '\\propto', 'Proportional to'),
      sym('to', '\\to', 'Tends to (arrow)'),
      sym('implies', '\\Rightarrow', 'Implies'),
      sym('iff', '\\Leftrightarrow', 'If and only if'),
    ],
  },
  {
    id: 'greek',
    label: 'Greek letters',
    short: 'αβ',
    items: [
      ...GREEK_LOWER.map(([n]) => sym(n, `\\${n}`, n)),
      ...GREEK_UPPER.map((n) => sym(n, `\\${n}`, `capital ${n.toLowerCase()}`)),
    ],
  },
  {
    id: 'functions',
    label: 'Functions',
    short: 'sin',
    items: [
      sym('sin', '\\sin', 'Sine'),
      sym('cos', '\\cos', 'Cosine'),
      sym('tan', '\\tan', 'Tangent'),
      { id: 'arcsin', label: 'Inverse sine', insert: '\\sin^{-1}' },
      sym('ln', '\\ln', 'Natural logarithm'),
      sym('log', '\\log', 'Logarithm'),
      { id: 'logb', label: 'Logarithm to a base', insert: '\\log_{#?}' },
      sym('exp-fn', '\\exp', 'Exponential function'),
      { id: 'fx', label: 'Function of x', insert: 'f\\left(x\\right)' },
    ],
  },
  {
    id: 'calculus',
    label: 'Calculus',
    short: '∫',
    items: [
      { id: 'int', label: 'Integral', insert: '\\int #0\\,\\differentialD #?' },
      { id: 'defint', label: 'Definite integral', insert: '\\int_{#?}^{#?}#0\\,\\differentialD #?' },
      { id: 'sum', label: 'Sum', insert: '\\sum_{#?}^{#?}#0' },
      { id: 'prod', label: 'Product', insert: '\\prod_{#?}^{#?}#0' },
      { id: 'lim', label: 'Limit', insert: '\\lim_{#?\\to#?}#0' },
      { id: 'deriv', label: 'Derivative', insert: '\\frac{\\differentialD #?}{\\differentialD #?}' },
      { id: 'deriv2', label: 'Second derivative', insert: '\\frac{\\differentialD^2#?}{\\differentialD #?^2}' },
      { id: 'partial', label: 'Partial derivative', insert: '\\frac{\\partial #?}{\\partial #?}' },
      { id: 'prime', label: 'Prime (derivative)', insert: "#@'" },
      sym('nabla', '\\nabla', 'Nabla'),
    ],
  },
  {
    id: 'matrices',
    label: 'Matrices',
    short: '[::]',
    items: [
      { id: 'pmatrix2', label: '2 by 2 matrix', insert: '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}' },
      { id: 'pmatrix3', label: '3 by 3 matrix', insert: '\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}' },
      { id: 'bmatrix2', label: '2 by 2 matrix, square brackets', insert: '\\begin{bmatrix}#?&#?\\\\#?&#?\\end{bmatrix}' },
      { id: 'det2', label: '2 by 2 determinant', insert: '\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}' },
      { id: 'colvec', label: 'Column vector', insert: '\\begin{pmatrix}#?\\\\#?\\end{pmatrix}' },
      { id: 'cases', label: 'Cases (piecewise)', insert: '\\begin{cases}#?&#?\\\\#?&#?\\end{cases}' },
      { id: 'vec', label: 'Vector arrow', insert: '\\vec{#0}' },
      { id: 'hat', label: 'Hat', insert: '\\hat{#0}' },
      { id: 'bar', label: 'Bar', insert: '\\bar{#0}' },
    ],
  },
  {
    id: 'sets',
    label: 'Sets and logic',
    short: '∈',
    items: [
      sym('in', '\\in', 'Element of'),
      sym('notin', '\\notin', 'Not an element of'),
      sym('subset', '\\subset', 'Subset of'),
      sym('subseteq', '\\subseteq', 'Subset of or equal to'),
      sym('cup', '\\cup', 'Union'),
      sym('cap', '\\cap', 'Intersection'),
      sym('emptyset', '\\emptyset', 'Empty set'),
      sym('naturals', '\\mathbb{N}', 'Natural numbers'),
      sym('integers', '\\mathbb{Z}', 'Integers'),
      sym('rationals', '\\mathbb{Q}', 'Rational numbers'),
      sym('reals', '\\mathbb{R}', 'Real numbers'),
      sym('forall', '\\forall', 'For all'),
      sym('exists', '\\exists', 'There exists'),
    ],
  },
  {
    id: 'geometry',
    label: 'Geometry',
    short: '∠',
    items: [
      sym('angle', '\\angle', 'Angle'),
      sym('triangle', '\\triangle', 'Triangle'),
      sym('perp', '\\perp', 'Perpendicular to'),
      sym('parallel', '\\parallel', 'Parallel to'),
      sym('cong', '\\cong', 'Congruent to'),
      sym('sim', '\\sim', 'Similar to'),
      sym('degree', '^{\\circ}', 'Degrees'),
      { id: 'segment', label: 'Line segment', insert: '\\overline{#0}' },
    ],
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    short: 'H₂O',
    items: [
      sym('ce-water', '\\ce{H2O}', 'Water, H 2 O'),
      sym('ce-forward', '\\ce{->}', 'Reaction arrow'),
      sym('ce-equilibrium', '\\ce{<=>}', 'Equilibrium arrows'),
      sym('ce-gas', '\\ce{^}', 'Gas given off'),
      sym('ce-precipitate', '\\ce{v}', 'Precipitate'),
      sym('ce-electron', '\\ce{e-}', 'Electron'),
    ],
    entry: {
      id: 'ce',
      label: 'Chemical formula or equation',
      placeholder: '2H2 + O2 -> 2H2O',
      // mhchem's own syntax: letters, digits, charges, arrows, states, dots
      toLatex: (text) => `\\ce{${plainText(text, /^[A-Za-z0-9 +\-=<>()[\].,*:;'/|^]+$/, 'chemical formula')}}`,
    },
  },
  {
    id: 'units',
    label: 'Units',
    short: 'm/s',
    items: [
      sym('u-m', '\\,\\mathrm{m}', 'metres'),
      sym('u-cm', '\\,\\mathrm{cm}', 'centimetres'),
      sym('u-km', '\\,\\mathrm{km}', 'kilometres'),
      sym('u-kg', '\\,\\mathrm{kg}', 'kilograms'),
      sym('u-g', '\\,\\mathrm{g}', 'grams'),
      sym('u-s', '\\,\\mathrm{s}', 'seconds'),
      sym('u-ms', '\\,\\mathrm{m}/\\mathrm{s}', 'metres per second'),
      sym('u-ms2', '\\,\\mathrm{m}/\\mathrm{s}^2', 'metres per second squared'),
      sym('u-N', '\\,\\mathrm{N}', 'newtons'),
      sym('u-J', '\\,\\mathrm{J}', 'joules'),
      sym('u-W', '\\,\\mathrm{W}', 'watts'),
      sym('u-ohm', '\\,\\Omega', 'ohms'),
      sym('u-degC', '\\,^{\\circ}\\mathrm{C}', 'degrees Celsius'),
      sym('u-mol', '\\,\\mathrm{mol}', 'moles'),
      sym('u-L', '\\,\\mathrm{L}', 'litres'),
    ],
    entry: {
      id: 'unit',
      label: 'Other unit',
      placeholder: 'kPa',
      toLatex: (text) => `\\,\\mathrm{${plainText(text, /^[A-Za-z]+$/, 'unit')}}`,
    },
  },
];

export const ALL_ITEMS: PaletteItem[] = CATEGORIES.flatMap((c) => c.items);

export function categoryOf(itemId: string): Category | undefined {
  return CATEGORIES.find((c) => c.items.some((i) => i.id === itemId));
}

/**
 * LaTeX for showing an item on a button or keycap, slots drawn as boxes.
 * Keycaps draw \placeholder{}; static rendering (<math-span>) draws nothing
 * for it, so the panel passes \square.
 */
export function displayLatex(item: PaletteItem, slot = '\\placeholder{}'): string {
  return (item.display ?? item.insert).replace(/#[?0@]/g, slot).replace(/^\\,/, '');
}
