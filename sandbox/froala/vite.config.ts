import { defineConfig } from 'vite';

// Dev server and build for the Froala demo (index.html).
export default defineConfig({
  // The MathJax font stays unbundled so its on-demand ranges (see
  // @sandbox/converters/src/mathjax-browser-fonts.ts) share one font instance.
  optimizeDeps: {
    include: ['mathlive', 'temml', '@mathjax/src', 'froala-editor', 'mathml-to-latex'],
    exclude: ['@mathjax/mathjax-newcm-font'],
  },
  // Keep MathLive's fonts as real files (a font-src 'self' CSP blocks data: URIs)
  build: { assetsInlineLimit: 0, target: 'es2022' },
});
