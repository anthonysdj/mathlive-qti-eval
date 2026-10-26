import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config.ts';

// Froala, MathLive and MathJax all need a real browser (layout, selection,
// contenteditable, custom elements), so every test runs in Chromium.
export default mergeConfig(
  viteConfig,
  defineConfig({
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
  })
);
