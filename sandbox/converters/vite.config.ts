import { defineConfig } from 'vite';

// Dev server and build for the insert-equation demo (index.html).
export default defineConfig({
  // MathJax and its font stay unbundled: the on-demand font ranges
  // (src/mathjax-browser-fonts.ts) import @mathjax/src themselves, and with a
  // pre-bundled copy they would register on a MathJax whose loader isn't the
  // patched one (\mathbb fails).
  optimizeDeps: { include: ['mathlive', 'temml'], exclude: ['@mathjax/src', '@mathjax/mathjax-newcm-font'] },
  // Keep MathLive's fonts as real files (a font-src 'self' CSP blocks data: URIs)
  build: { assetsInlineLimit: 0, target: 'es2022' },
});
