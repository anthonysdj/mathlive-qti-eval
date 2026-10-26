// Measures what each way of importing MathLive costs after Vite bundling and
// minification. Usage: node scripts/bundle-size.mjs
import { build } from 'vite';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';

const entries = {
  "import 'mathlive' (element + keyboard)": "import 'mathlive';",
  'convertLatexToMathMl from mathlive': "export { convertLatexToMathMl } from 'mathlive';",
  'convertLatexToMathMl from mathlive/ssr': "export { convertLatexToMathMl } from 'mathlive/ssr';",
  'mathml-to-latex': "export { MathMLToLaTeX } from 'mathml-to-latex';",
};

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log('| Import | Minified | gzip | brotli |\n|---|---|---|---|');
for (const [name, code] of Object.entries(entries)) {
  const dir = mkdtempSync(join(process.cwd(), 'node_modules/.cache/size-'));
  const entry = join(dir, 'entry.js');
  writeFileSync(entry, code);
  const out = join(dir, 'out');
  await build({
    configFile: false,
    mode: 'production',
    logLevel: 'silent',
    root: process.cwd(),
    resolve: { conditions: ['browser', 'production'] },
    build: {
      outDir: out,
      minify: true,
      // App-style build (lib mode keeps whitespace in ES output)
      rolldownOptions: { input: entry, preserveEntrySignatures: 'strict' },
    },
  });
  let raw = 0, gz = 0, br = 0;
  for (const f of readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'))) {
    const d = readFileSync(join(out, 'assets', f));
    raw += d.length; gz += gzipSync(d, { level: 9 }).length; br += brotliCompressSync(d).length;
  }
  console.log(`| ${name} | ${kb(raw)} | ${kb(gz)} | ${kb(br)} |`);
}
