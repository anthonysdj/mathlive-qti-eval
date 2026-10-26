import { defineConfig } from 'vite';

// Fonts come from `import 'mathlive/fonts.css'` in src/main.ts, which Vite
// bundles as hashed assets. No copy step is needed.
export default defineConfig({
  build: {
    // Keep every font a real file: Vite would inline small ones (KaTeX_Size3)
    // as data: URIs, which a `font-src 'self'` CSP blocks.
    assetsInlineLimit: 0,
    rolldownOptions: { input: ['index.html', 'trusted-types.html'] },
  },
});
