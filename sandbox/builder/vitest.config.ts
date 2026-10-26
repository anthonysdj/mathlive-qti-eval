import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// MathLive needs a real browser, so tests run in Chromium (as in the other
// sandboxes). MathJax stays out of pre-bundling for the same reason as in
// sandbox/froala: its on-demand font ranges must share one copy of it.
export default defineConfig({
  optimizeDeps: {
    include: ['mathlive', 'temml'],
    exclude: ['@mathjax/src', '@mathjax/mathjax-newcm-font'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
