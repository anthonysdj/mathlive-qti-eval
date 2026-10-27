import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config.ts';

// Two projects, as in sandbox/converters:
// - browser: MathLive (layout, fonts, custom elements) and Froala need a real
//   browser, so these run in Chromium
// - node: spoken text and braille from stored MathML with speech-rule-engine,
//   which is how alt text would be made on a server
export default mergeConfig(
  viteConfig,
  defineConfig({
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
  })
);
