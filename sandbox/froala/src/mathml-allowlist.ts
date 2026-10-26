// What Froala's sanitizer must let through for equations.
//
// Froala 5.5.0's default `htmlAllowedTags` has no MathML. With the defaults a
// pasted or loaded <math> is unwrapped: its text stays, so `a+b^2` plus the
// LaTeX annotation turns into visible text ("a+b2a+b^2") and the equation is
// lost (tests/sanitizer.test.ts). The editor itself only ever holds
// <math-eq data-mathml="…">, so MathML is needed only on the way in: stored
// content passed to html.set(), and pasted content, both of which are cleaned
// before the plugin can turn them into <math-eq>.

/** Presentation MathML elements (MathML Core plus the MathML 3 ones Wiris and Temml write) */
export const MATHML_TAGS = [
  'math', 'semantics', 'annotation', 'annotation-xml',
  'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext', 'mspace', 'mglyph',
  'mfrac', 'msqrt', 'mroot', 'mstyle', 'merror', 'mpadded', 'mphantom', 'menclose', 'mfenced',
  'msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover', 'mmultiscripts', 'mprescripts', 'none',
  'mtable', 'mtr', 'mtd', 'mlabeledtr', 'maligngroup', 'malignmark',
  'maction', 'mstack', 'msgroup', 'msrow', 'mscarries', 'mscarry', 'msline', 'mlongdiv',
];

/** MathML attributes (Froala's defaults already cover class, style, width, height, id, dir, data-*) */
export const MATHML_ATTRS = [
  'xmlns', 'display', 'encoding', 'definitionURL', 'altimg', 'alttext',
  'mathvariant', 'mathsize', 'mathcolor', 'mathbackground', 'displaystyle', 'scriptlevel',
  'stretchy', 'symmetric', 'largeop', 'movablelimits', 'accent', 'accentunder', 'fence', 'separator', 'separators',
  'form', 'lspace', 'rspace', 'minsize', 'maxsize', 'linethickness', 'bevelled', 'numalign', 'denomalign',
  'depth', 'voffset', 'notation', 'open', 'close', 'columnalign', 'rowalign', 'columnspacing', 'rowspacing',
  'columnlines', 'rowlines', 'frame', 'framespacing', 'equalrows', 'equalcolumns', 'columnspan', 'rowspan',
  'columnwidth', 'side', 'minlabelspacing', 'actiontype', 'selection', 'linebreak', 'indentalign',
  'subscriptshift', 'superscriptshift', 'align', 'charalign', 'stackalign', 'longdivstyle', 'position', 'shift',
  'location', 'crossout', 'scriptminsize', 'scriptsizemultiplier', 'lquote', 'rquote', 'href',
];

/** The editor's element for one equation (see math-eq-element.ts) */
export const EQ_TAG = 'math-eq';
