// Measures what each LaTeX→MathML converter costs after Vite bundling and
// minification. Usage: node scripts/bundle-size.mjs
import { build } from 'vite';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';

const MJ = '@mathjax/src/js';
const entries = {
  'MathLive (whole package)': "export { convertLatexToMathMl } from 'mathlive';",
  'MathLive SSR build (converters only)': "export { convertLatexToMathMl } from 'mathlive/ssr';",
  'Temml': "export { default } from 'temml';",
  'Temml + mhchem': "import temml from 'temml'; globalThis.temml = temml; await import('temml/contrib/mhchem/mhchem.js'); export default temml;",
  'MathJax TeX→MathML (packages used here)': [
    'mathjax.js', 'input/tex.js', 'adaptors/liteAdaptor.js', 'handlers/html.js',
    'core/MmlTree/SerializedMmlVisitor.js',
    ...['base/Base', 'ams/Ams', 'mhchem/Mhchem', 'color/Color', 'newcommand/Newcommand', 'gensymb/Gensymb',
        'cancel/Cancel', 'enclose/Enclose', 'boldsymbol/Boldsymbol', 'mathtools/Mathtools'].map((p) => `input/tex/${p}Configuration.js`),
  ].map((f, i) => `export * as m${i} from '${MJ}/${f}';`).join('\n'),
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
