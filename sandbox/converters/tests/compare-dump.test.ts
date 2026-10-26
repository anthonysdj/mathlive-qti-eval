// Runs every case through every converter and writes the results to
// findings/mathml-converters-raw.json, so
// findings/mathml-converters.md is written from data. Run with `pnpm compare`.
import { test } from 'vitest';
import { commands } from 'vitest/browser';
import { MathfieldElement } from 'mathlive';
import { converters, loadTemmlMhchem } from '../src/converters';
import { check } from '../src/check';
import { storageMathml } from '../src/pipeline';
import { cases, MACROS } from '../src/cases';

test.runIf(import.meta.env.VITE_PROBE)('compare converters', async () => {
  await loadTemmlMhchem();
  const mf = new MathfieldElement();
  document.body.append(mf);
  mf.macros = { ...mf.macros, ...MACROS };

  const rows = [];
  for (const c of cases) {
    const row: any = { id: c.id, category: c.category, latex: c.latex, results: {} };
    for (const conv of converters) {
      const t0 = performance.now();
      const r = storageMathml(mf, c.latex, conv);
      const ms = performance.now() - t0;
      row.results[conv.name] = r.error !== undefined
        ? { input: r.input, error: r.error.slice(0, 200), ms }
        : { input: r.input, mathml: r.mathml, ms, ...check(r.mathml, c.latex) };
    }
    rows.push(row);
  }
  await commands.writeFile('../../findings/mathml-converters-raw.json', JSON.stringify(rows, null, 2));

  // Pure conversion speed: every case's prepared input, 20 rounds, after a warm-up round
  const timing: Record<string, number> = {};
  for (const conv of converters) {
    const inputs = rows.map((r) => r.results[conv.name].input as string);
    inputs.forEach((i) => conv.convert(i));
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) inputs.forEach((i) => conv.convert(i));
    timing[conv.name] = (performance.now() - t0) / (20 * inputs.length);
  }
  await commands.writeFile('../../findings/mathml-converters-timing.json', JSON.stringify(timing, null, 2));

  // Rendered comparison: scripts/gallery.mjs builds it from this file.
});
