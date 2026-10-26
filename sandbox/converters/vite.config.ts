import { defineConfig } from 'vite';

// Dev server and build for the insert-equation demo (index.html).
export default defineConfig({
  // The font stays unbundled so its on-demand ranges (src/mathjax-browser-fonts.ts)
  // share one MathJaxNewcmFont instance with it.
  optimizeDeps: { include: ['mathlive', 'temml', '@mathjax/src'], exclude: ['@mathjax/mathjax-newcm-font'] },
  // Keep MathLive's fonts as real files (a font-src 'self' CSP blocks data: URIs)
  build: { assetsInlineLimit: 0, target: 'es2022' },
});
