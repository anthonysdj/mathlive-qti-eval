import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Two projects:
// - browser: real Chromium (DOMParser, native MathML), same as sandbox/basic
// - node: the server-side print path (MathJax SVG loads font ranges with
//   dynamic import(), which is simplest in Node)
export default defineConfig({
  // MathJax and its font stay unbundled: the on-demand font ranges
  // (src/mathjax-browser-fonts.ts) import @mathjax/src themselves, and with a
  // pre-bundled copy they would register on a MathJax whose loader isn't the
  // patched one (\mathbb fails).
  optimizeDeps: { include: ['mathlive', 'temml'], exclude: ['@mathjax/src', '@mathjax/mathjax-newcm-font'] },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.node.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        test: { name: 'node', include: ['tests/**/*.node.test.ts'], environment: 'node' },
      },
    ],
  },
});
