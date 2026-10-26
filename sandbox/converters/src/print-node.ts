// The print path in Node: MathJax's own loader imports the font ranges it
// needs on demand (e.g. double-struck) by package name, which Node resolves.
// Browsers use mathjax-browser-fonts.ts instead (see print.ts).
import '@mathjax/src/js/util/asyncLoad/esm.js';

export * from './print';
