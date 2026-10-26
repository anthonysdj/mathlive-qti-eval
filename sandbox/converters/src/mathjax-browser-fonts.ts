// Browser builds only: MathJax loads rarer glyph ranges (double-struck ℝ,
// fraktur, …) on demand by importing a bare specifier such as
// '@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck'. Node resolves
// that; a browser cannot, and \mathbb{R} fails with "dynamic file
// 'double-struck' failed to load". Map each range to a static import() that
// the bundler turns into a lazy chunk, so it is still loaded only when a
// formula needs it. Plain import() calls (not Vite's import.meta.glob) work
// with both Vite and the Angular CLI's esbuild. In Vite the font package must
// not be pre-bundled (see vite.config.ts), or the ranges register on a second
// copy of the font class.
// The list is the 40 files in mjs/svg/dynamic/ of @mathjax/mathjax-newcm-font 4.1.3.
import { mathjax } from '@mathjax/src/js/mathjax.js';

const ranges: Record<string, () => Promise<unknown>> = {
  'PUA': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/PUA.js'),
  'accents': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/accents.js'),
  'accents-b-i': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/accents-b-i.js'),
  'arabic': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/arabic.js'),
  'arrows': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/arrows.js'),
  'braille': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/braille.js'),
  'braille-d': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/braille-d.js'),
  'calligraphic': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/calligraphic.js'),
  'cherokee': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/cherokee.js'),
  'cyrillic': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/cyrillic.js'),
  'cyrillic-ss': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/cyrillic-ss.js'),
  'devanagari': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/devanagari.js'),
  'double-struck': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/double-struck.js'),
  'fraktur': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/fraktur.js'),
  'greek': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/greek.js'),
  'greek-ss': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/greek-ss.js'),
  'hebrew': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/hebrew.js'),
  'latin': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/latin.js'),
  'latin-b': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/latin-b.js'),
  'latin-bi': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/latin-bi.js'),
  'latin-i': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/latin-i.js'),
  'marrows': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/marrows.js'),
  'math': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/math.js'),
  'monospace': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/monospace.js'),
  'monospace-ex': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/monospace-ex.js'),
  'monospace-l': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/monospace-l.js'),
  'mshapes': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/mshapes.js'),
  'phonetics': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/phonetics.js'),
  'phonetics-ss': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/phonetics-ss.js'),
  'sans-serif': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif.js'),
  'sans-serif-b': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif-b.js'),
  'sans-serif-bi': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif-bi.js'),
  'sans-serif-ex': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif-ex.js'),
  'sans-serif-i': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif-i.js'),
  'sans-serif-r': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/sans-serif-r.js'),
  'script': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/script.js'),
  'shapes': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/shapes.js'),
  'symbols': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/symbols.js'),
  'symbols-b-i': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/symbols-b-i.js'),
  'variants': () => import('@mathjax/mathjax-newcm-font/mjs/svg/dynamic/variants.js'),
};

const fallback = mathjax.asyncLoad;
mathjax.asyncLoad = (name: string) => {
  const m = name.match(/mathjax-newcm-font\/js\/svg\/dynamic\/([\w-]+?)(\.js)?$/);
  const load = m && ranges[m[1]];
  if (load) return load();
  if (fallback) return fallback(name);
  return Promise.reject(new Error(`MathJax asked for '${name}', which this build does not include`));
};
