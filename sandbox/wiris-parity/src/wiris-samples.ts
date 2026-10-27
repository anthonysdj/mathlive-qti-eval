// MathML as MathType writes it, one sample per notation that is written in a
// MathType-specific way. Shapes taken from MathType's output conventions
// (mathml-to-image service samples and the mathtype-html-integration-devkit
// 1.17.17 sources, as in sandbox/froala/src/wiris.ts): no outer <mrow>,
// mathvariant="normal" for upright letters, <mfenced> on older content,
// <mstyle> for colour and size, MathML elementary math for column arithmetic.
// Real items from our database should be added here when we have them.

export type WirisSample = {
  id: string;
  name: string;
  mathml: string;
  /** What must survive the trip into the editor (checked in the LaTeX we get back) */
  keep: RegExp[];
};

const M = (body: string, attrs = '') => `<math xmlns="http://www.w3.org/1998/Math/MathML"${attrs}>${body}</math>`;

export const WIRIS_SAMPLES: WirisSample[] = [
  {
    id: 'frac-sqrt',
    name: 'Fraction and root (palette)',
    mathml: M('<mfrac><mrow><mo>-</mo><mi>b</mi><mo>±</mo><msqrt><msup><mi>b</mi><mn>2</mn></msup><mo>-</mo><mn>4</mn><mi>a</mi><mi>c</mi></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac>'),
    keep: [/\\frac/, /\\sqrt/, /\\pm/],
  },
  {
    id: 'mfenced-matrix',
    name: 'Matrix in <mfenced> (older MathType content)',
    mathml: M('<mfenced><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>2</mn></mtd></mtr><mtr><mtd><mn>3</mn></mtd><mtd><mn>4</mn></mtd></mtr></mtable></mfenced>'),
    keep: [/\(|pmatrix/, /&/, /\\\\/],
  },
  {
    id: 'piecewise',
    name: 'Piecewise function, brace with no closing fence',
    mathml: M('<mi>f</mi><mfenced><mi>x</mi></mfenced><mo>=</mo><mfenced open="{" close=""><mtable columnalign="left"><mtr><mtd><mi>x</mi></mtd><mtd><mi>x</mi><mo>≥</mo><mn>0</mn></mtd></mtr><mtr><mtd><mo>-</mo><mi>x</mi></mtd><mtd><mi>x</mi><mo>&lt;</mo><mn>0</mn></mtd></mtr></mtable></mfenced>'),
    keep: [/\\\{|\\lbrace|cases/, /\\geq?|≥/],
  },
  {
    id: 'upright',
    name: 'Upright letters (mathvariant="normal") and units',
    mathml: M('<mn>9</mn><mo>.</mo><mn>8</mn><mo>&#xA0;</mo><mi mathvariant="normal">m</mi><mo>/</mo><msup><mi mathvariant="normal">s</mi><mn>2</mn></msup>'),
    keep: [/\\mathrm\{m\}|\\text\{m\}/, /\\mathrm\{s\}|\\text\{s\}/],
  },
  {
    id: 'color',
    name: 'Coloured part (<mstyle mathcolor>)',
    mathml: M('<mstyle mathcolor="#FF0000"><mi>x</mi></mstyle><mo>+</mo><mi>y</mi>'),
    keep: [/color/i],
  },
  {
    id: 'background',
    name: 'Background colour (mathbackground)',
    mathml: M('<mstyle mathbackground="#FFFF00"><mi>x</mi><mo>+</mo><mn>1</mn></mstyle>'),
    keep: [/colorbox|bgcolor|background/i],
  },
  {
    id: 'size',
    name: 'Font size (<mstyle mathsize>)',
    mathml: M('<mstyle mathsize="24px"><mi>x</mi></mstyle>'),
    keep: [/\\(large|Large|LARGE|huge|Huge)|fontsize|mathsize/],
  },
  {
    id: 'bold',
    name: 'Bold (mathvariant="bold")',
    mathml: M('<mi mathvariant="bold">v</mi><mo>+</mo><mi mathvariant="bold-italic">w</mi>'),
    keep: [/\\mathbf|\\boldsymbol|\\bm/],
  },
  {
    id: 'cancel',
    name: 'Cancel (<menclose notation="updiagonalstrike">)',
    mathml: M('<mfrac><mrow><menclose notation="updiagonalstrike"><mn>2</mn></menclose><mi>x</mi></mrow><menclose notation="updiagonalstrike"><mn>2</mn></menclose></mfrac>'),
    keep: [/\\cancel|enclose/],
  },
  {
    id: 'box',
    name: 'Boxed (<menclose notation="box">)',
    mathml: M('<menclose notation="box"><mi>x</mi><mo>=</mo><mn>2</mn></menclose>'),
    keep: [/\\boxed|\\fbox|enclose/],
  },
  {
    id: 'circle',
    name: 'Circled (<menclose notation="circle">)',
    mathml: M('<menclose notation="circle"><mn>5</mn></menclose>'),
    keep: [/circle|enclose/],
  },
  {
    id: 'vector',
    name: 'Vector arrow (<mover> with →)',
    mathml: M('<mover><mi>v</mi><mo>→</mo></mover>'),
    keep: [/\\vec|\\overrightarrow|\\overset\{→\}|\\overset\{\\rightarrow\}/],
  },
  {
    id: 'arc',
    name: 'Arc over letters (<mover> with ⌒)',
    mathml: M('<mover><mrow><mi>A</mi><mi>B</mi></mrow><mo>⌒</mo></mover>'),
    keep: [/overarc|wideparen|⌒/],
  },
  {
    id: 'isotope',
    name: 'Isotope (<mmultiscripts> with <mprescripts/>)',
    mathml: M('<mmultiscripts><mi mathvariant="normal">U</mi><mprescripts/><mn>92</mn><mn>235</mn></mmultiscripts>'),
    keep: [/235/, /92/, /U/],
  },
  {
    id: 'chem',
    name: 'ChemType formula and reaction',
    mathml: M('<mn>2</mn><msub><mi mathvariant="normal">H</mi><mn>2</mn></msub><mo>+</mo><msub><mi mathvariant="normal">O</mi><mn>2</mn></msub><mo>→</mo><mn>2</mn><msub><mi mathvariant="normal">H</mi><mn>2</mn></msub><mi mathvariant="normal">O</mi>', ' class="wrs_chemistry"'),
    keep: [/\\rightarrow|\\to|→/, /H/],
  },
  {
    id: 'linebreak',
    name: 'Manual line break (<mspace linebreak="newline">)',
    mathml: M('<mi>a</mi><mo>+</mo><mi>b</mi><mspace linebreak="newline"/><mo>=</mo><mi>c</mi>'),
    keep: [/\\\\|newline/],
  },
  {
    id: 'integral',
    name: 'Integral with differential',
    mathml: M('<msubsup><mo>∫</mo><mn>0</mn><mn>1</mn></msubsup><msup><mi>x</mi><mn>2</mn></msup><mo>&#x2009;</mo><mi>d</mi><mi>x</mi>'),
    keep: [/\\int/],
  },
  {
    id: 'stack-add',
    name: 'Column addition (<mstack>)',
    mathml: M('<mstack stackalign="right"><mn>123</mn><msrow><mo>+</mo><mn>456</mn></msrow><msline/><mn>579</mn></mstack>'),
    keep: [/123/, /456/, /579/],
  },
  {
    id: 'carries',
    name: 'Column addition with carries (<mscarries>)',
    mathml: M('<mstack stackalign="right"><mscarries crossout="none"><mn>1</mn><none/></mscarries><mn>58</mn><msrow><mo>+</mo><mn>67</mn></msrow><msline/><mn>125</mn></mstack>'),
    keep: [/58/, /67/, /125/],
  },
  {
    id: 'longdiv',
    name: 'Long division (<mlongdiv>)',
    mathml: M('<mlongdiv longdivstyle="left)(right"><mn>3</mn><mn>41</mn><mn>125</mn><msgroup><mn>12</mn><msline/></msgroup><msgroup><mn>5</mn><mn>3</mn><msline/><mn>2</mn></msgroup></mlongdiv>'),
    keep: [/125/, /41/],
  },
];
