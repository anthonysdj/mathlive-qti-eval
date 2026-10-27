import { defineConfig } from 'vite';

// MathJax stays unbundled for the same reason as in sandbox/froala: its
// on-demand font ranges need the patched loader from @sandbox/converters.
export default defineConfig({
  optimizeDeps: {
    include: ['mathlive', 'temml', 'mathml-to-latex', 'froala-editor'],
    exclude: ['@mathjax/src', '@mathjax/mathjax-newcm-font'],
  },
  build: { assetsInlineLimit: 0, target: 'es2022' },
});
