// Browser build only (Vite): MathJax loads rarer glyph ranges (double-struck ℝ,
// fraktur, …) on demand by importing a bare specifier such as
// '@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck'. Node resolves
// that; a browser cannot, and \mathbb{R} fails with "dynamic file
// 'double-struck' failed to load". Map each range to a Vite chunk instead, so
// it is still loaded only when a formula needs it. The font package must not be
// pre-bundled by Vite (see vite.config.ts), or the ranges register on a second
// copy of the font class.
import { mathjax } from '@mathjax/src/js/mathjax.js';

const ranges = import.meta.glob('/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js');
const byName = new Map(Object.entries(ranges).map(([path, load]) => [path.split('/').pop()!.replace(/\.js$/, ''), load]));

const fallback = mathjax.asyncLoad;
mathjax.asyncLoad = (name: string) => {
  const m = name.match(/mathjax-newcm-font\/js\/svg\/dynamic\/([\w-]+?)(\.js)?$/);
  const load = m && byName.get(m[1]);
  if (load) return load();
  if (fallback) return fallback(name);
  return Promise.reject(new Error(`MathJax asked for '${name}', which this build does not include`));
};
