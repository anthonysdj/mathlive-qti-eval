export { registerMathPlugin, withMathOptions, COMMAND, PLUGIN, type MathEquationApi } from './froala-math-plugin';
export { EquationDialog, type DialogContext, type DialogExtension, type DialogExtender } from './equation-dialog';
export { MathEqElement, defineMathEq } from './math-eq-element';
export { hydrate, toEditorHtml, toStoredHtml, canonicalMathml, createEq } from './math-html';
export { MATHML_TAGS, MATHML_ATTRS, EQ_TAG } from './mathml-allowlist';
export { safeXmlDecode } from './wiris';
