// Writes findings/wiris-parity-raw.json (every MathType toolbar feature through
// every pipeline step) and findings/wiris-import-raw.json (MathType MathML into
// the field, with plain mathml-to-latex and with src/wiris-import.ts).
// Run with `pnpm dump`.
import { it } from 'vitest';
import { commands } from 'vitest/browser';
import 'mathlive/fonts.css';
import { MathfieldElement, validateLatex } from 'mathlive';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';
import { fromPersistedMathml } from '@sandbox/basic/src/serialize';
import { FEATURES } from '../src/features';
import { run, svgOf } from '../src/run';
import { WIRIS_SAMPLES } from '../src/wiris-samples';
import { importMathml } from '../src/wiris-import';

it.runIf(import.meta.env.VITE_DUMP)('dump', async () => {
  await loadTemmlMhchem();
  const mf = new MathfieldElement();
  document.body.append(mf);

  const features = [];
  for (const f of FEATURES) features.push({ id: f.id, tab: f.tab, name: f.name, latex: f.latex, ...(await run(mf, f.latex)) });
  await commands.writeFile(
    '../../findings/wiris-parity-raw.json',
    JSON.stringify({ mathlive: '0.111.1', temml: '0.14.0', rows: features }, null, 1)
  );

  const samples = [];
  for (const s of WIRIS_SAMPLES) {
    const plain = fromPersistedMathml(s.mathml).latex;
    const imp = importMathml(s.mathml);
    const r = await run(mf, imp.latex);
    samples.push({
      id: s.id,
      name: s.name,
      mathml: s.mathml,
      displayAsStored: await svgOf(s.mathml),
      plain: { latex: plain, mathliveErrors: validateLatex(plain).map((e) => e.code), kept: s.keep.map((k) => k.test(plain)) },
      imported: { latex: imp.latex, approximations: imp.approximations, kept: s.keep.map((k) => k.test(imp.latex)), ...r },
    });
  }
  await commands.writeFile('../../findings/wiris-import-raw.json', JSON.stringify(samples, null, 1));
}, 120_000);
