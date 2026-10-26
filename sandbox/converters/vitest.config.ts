import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Same setup as sandbox/basic: real Chromium (DOMParser, native MathML).
export default defineConfig({
  optimizeDeps: { include: ['mathlive', 'temml', '@mathjax/src'] },
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
