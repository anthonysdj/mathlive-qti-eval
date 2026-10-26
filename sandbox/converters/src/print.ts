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

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {
  InputJax: new MathML(),
  // fontCache 'none': every SVG carries its own glyph paths, so each one is a
  // self-contained image file.
  OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: 'none' }),
});

/**
 * Adapt Temml's MathML for MathJax:
 * - Temml spaces table columns with `style="padding-…"` on each <mtd>, which
 *   MathJax misreads: matrix entries overlap their brackets and `cases` is
 *   clipped. Without it MathJax uses its own (TeX-like) column spacing.
 * - Temml's `class="tml-…"` hooks only mean something with Temml's CSS.
 *   MathJax copies them onto the SVG, where that CSS (if present on the same
 *   page) would restyle the glyphs, so drop them.
 * - Our stored format wraps the formula in <semantics> with a LaTeX
 *   <annotation>. MathJax 4.1.3's SVG output then draws only the first child
 *   of the formula's <mrow> (`a+b` comes out as `a`), so unwrap it: the
 *   annotation is for editing, not for the image.
 * Other inline styles (colour, the \boxed border) are kept: MathJax honours them.
 */
export function prepareForSvg(mathml: string): string {
  return mathml
    .replace(/<annotation(-xml)?\b[^>]*>[\s\S]*?<\/annotation\1>/g, '')
    .replace(/<\/?semantics\b[^>]*>/g, '')
    .replace(/(<mtd\b[^>]*?) style="[^"]*"/g, '$1')
    .replace(/ class="[^"]*"/g, '');
}

export async function mathmlToSvg(mathml: string): Promise<string> {
  // convertPromise waits for any font ranges the formula needs
  const node = await doc.convertPromise(prepareForSvg(mathml), { display: false });
  return adaptor.serializeXML(adaptor.firstChild(node) as any);
}
