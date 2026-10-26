// Print path: stored MathML → standalone SVG images, for a PDF pipeline that
// embeds formulas as images (e.g. RenderX XEP via XSL-FO). Runs in Node or a
// browser; MathJax does the layout with its bundled New Computer Modern font.

import { mathjax } from '@mathjax/src/js/mathjax.js';
import { MathML } from '@mathjax/src/js/input/mathml.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/mjs/svg.js';
// Lets MathJax import the font ranges it loads on demand (e.g. double-struck)
import '@mathjax/src/js/util/asyncLoad/esm.js';
import { prepareForSvg } from './prepare-svg';

export { prepareForSvg };

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {
  InputJax: new MathML(),
  // fontCache 'none': every SVG carries its own glyph paths, so each one is a
  // self-contained image file.
  OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: 'none' }),
});

export async function mathmlToSvg(mathml: string): Promise<string> {
  // convertPromise waits for any font ranges the formula needs
  const node = await doc.convertPromise(prepareForSvg(mathml), { display: false });
  return adaptor.serializeXML(adaptor.firstChild(node) as any);
}
