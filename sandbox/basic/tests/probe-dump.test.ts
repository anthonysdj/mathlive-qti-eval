// Not an assertion test: dumps the raw behaviour of every corpus entry to
// findings/roundtrip-raw.json so findings/roundtrip.md can be written from
// data rather than memory. Run with `pnpm probe`.
import { test } from 'vitest';
import { commands } from 'vitest/browser';
import { MathfieldElement } from 'mathlive';
import { corpus } from '../src/corpus';
import { probe } from '../src/probe';

test.runIf(import.meta.env.VITE_PROBE)('dump round-trip behaviour', async () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  const out = corpus.map((c) => ({ id: c.id, category: c.category, ...probe(mf, c.latex) }));
  await commands.writeFile('../../findings/roundtrip-raw.json', JSON.stringify(out, null, 2));
});
