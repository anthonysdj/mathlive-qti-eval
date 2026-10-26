import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// MathLive needs a real browser (layout, FontFace, custom elements,
// adoptedStyleSheets), so tests run in Chromium rather than jsdom.
// PW_CHROMIUM lets a machine with a pre-installed Chromium skip
// `playwright install` (e.g. the Claude Code cloud container).
export default defineConfig({
  optimizeDeps: { include: ['mathlive', 'mathml-to-latex'] },
  test: {
    include: ['tests/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: process.env.PW_CHROMIUM
          ? { executablePath: process.env.PW_CHROMIUM }
          : {},
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
