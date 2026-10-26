// Three ways to turn LaTeX into the MathML we would store in QTI items.
// Each returns a complete <math> element as a string, or an error.

import { convertLatexToMathMl } from 'mathlive';

import temml from 'temml';

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { SerializedMmlVisitor } from '@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js';
import { STATE } from '@mathjax/src/js/core/MathItem.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js';

export type Result = { mathml: string; error?: undefined } | { mathml?: undefined; error: string };
export type Converter = {
  name: string;
  convert: (latex: string, macros?: Record<string, string>) => Result;
};

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

// --- MathLive ------------------------------------------------------------
// convertLatexToMathMl() is the same generator as mf.getValue('math-ml'). It
// has no macros option, so custom macros must be expanded by the field first
// (getValue('latex-expanded')); see sandbox/basic/tests/lifecycle.test.ts.
export const mathliveConverter: Converter = {
  name: 'MathLive 0.111.1',
  convert(latex) {
    try {
      return { mathml: `<math xmlns="${MATHML_NS}">${convertLatexToMathMl(latex)}</math>` };
    } catch (e) {
      return { error: String(e) };
    }
  },
};

// --- Temml ---------------------------------------------------------------
// \ce needs Temml's mhchem extension: call loadTemmlMhchem() once first.
export { loadTemmlMhchem } from './temml-mhchem';

export const temmlConverter: Converter = {
  name: 'Temml 0.14.0',
  convert(latex, macros) {
    try {
      // xml: true makes Temml emit XML-safe output (self-closed empty elements).
      // A fresh macros object per call: Temml writes \gdef'd macros into it.
      const mathml = temml.renderToString(latex, {
        xml: true,
        throwOnError: true,
        macros: { ...macros },
      });
      return { mathml };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
};

// --- MathJax -------------------------------------------------------------
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
let mjMacros: Record<string, string> = {};
function mathjaxDocument(macros: Record<string, string>) {
  const tex = new TeX({
    packages: ['base', 'ams', 'mhchem', 'color', 'newcommand', 'gensymb', 'cancel', 'enclose', 'boldsymbol', 'mathtools'],
    macros,
    // Throw instead of rendering an <merror> so failures are visible
    formatError: (_jax: unknown, err: Error) => {
      throw err;
    },
  });
  return mathjax.document('', { InputJax: tex });
}
let mjDoc = mathjaxDocument(mjMacros);
const visitor = new SerializedMmlVisitor();

export const mathjaxConverter: Converter = {
  name: 'MathJax 4.1.3',
  convert(latex, macros = {}) {
    if (JSON.stringify(macros) !== JSON.stringify(mjMacros)) {
      mjMacros = macros;
      mjDoc = mathjaxDocument(macros);
    }
    try {
      const node = mjDoc.convert(latex, { display: false, end: STATE.CONVERT });
      return { mathml: visitor.visitTree(node) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
};

export const converters = [mathliveConverter, temmlConverter, mathjaxConverter];
