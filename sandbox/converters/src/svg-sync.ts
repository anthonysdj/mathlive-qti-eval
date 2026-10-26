// MathML → SVG for a backend that is not Node (Java via GraalJS, see
// sandbox/java-temml). Built into one self-contained script by
// vite.svg-sync.config.ts, which then defines a global `mathmlToSvg(string)`.
//
// Same MathJax, font, options and prepareForSvg() as src/print.ts, so the SVG
// is byte-identical. The difference is loading: print.ts imports the rarer
// glyph ranges (double-struck, fraktur, …) on demand (print-node.ts in Node),
// which needs a module loader and Promises. Here every range is compiled into the script, and
// MathJax is told its loader is synchronous, so a conversion is one plain
// function call with no event loop.
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { MathML } from '@mathjax/src/js/input/mathml.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/mjs/svg.js';
import { prepareForSvg } from './prepare-svg';

// Importing a range registers its glyphs with the font class; MathJax applies
// them the first time a formula needs one (FontData.loadDynamicFileSync).
const ranges = import.meta.glob('/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js', { eager: true });
const included = new Set(Object.keys(ranges).map((p) => p.split('/').pop()!.replace(/\.js$/, '')));

mathjax.asyncIsSynchronous = true;
mathjax.asyncLoad = (name: string) => {
  const m = name.match(/mathjax-newcm-font\/js\/svg\/dynamic\/([\w-]+?)(\.js)?$/);
  if (!m || !included.has(m[1])) throw new Error(`MathJax asked for '${name}', which this bundle does not include`);
};

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {
  InputJax: new MathML(),
  OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: 'none' }),
});

export function mathmlToSvg(mathml: string): string {
  const node = doc.convert(prepareForSvg(mathml), { display: false });
  return adaptor.serializeXML(adaptor.firstChild(node) as any);
}

(globalThis as any).mathmlToSvg = mathmlToSvg;
