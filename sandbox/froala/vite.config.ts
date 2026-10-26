import { defineConfig } from 'vite';

// Dev server and build for the Froala demo (index.html).
export default defineConfig({
  // MathJax and its font stay unbundled. Its on-demand font ranges (see
  // @sandbox/converters/src/mathjax-browser-fonts.ts) import @mathjax/src
  // themselves; if @mathjax/src were pre-bundled, they would get a second copy
  // of MathJax whose loader isn't the patched one, and \mathbb would fail.
  optimizeDeps: {
    include: ['mathlive', 'temml', 'froala-editor', 'mathml-to-latex'],
    exclude: ['@mathjax/src', '@mathjax/mathjax-newcm-font'],
  },
  // Keep MathLive's fonts as real files (a font-src 'self' CSP blocks data: URIs)
  build: { assetsInlineLimit: 0, target: 'es2022' },
});
