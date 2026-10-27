// Every MathType toolbar feature in src/features.ts, through the whole
// pipeline: MathLive parses and draws it, Temml stores it as MathML, MathJax
// draws it for print, MathLive speaks it. Known failures are asserted, so a
// fix upstream shows up as a failing test.
import { beforeAll, describe, expect, it } from 'vitest';
import 'mathlive/fonts.css';
import { MathfieldElement } from 'mathlive';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';
import { FEATURES, type Stage } from '../src/features';
import { run } from '../src/run';
import { toFieldLatex, toStorageLatex } from '../src/compat';

let mf: MathfieldElement;
beforeAll(async () => {
  await loadTemmlMhchem();
  mf = new MathfieldElement();
  document.body.append(mf);
});

const STAGES: Stage[] = ['mathlive', 'temml', 'svg', 'spoken'];

describe('MathType toolbar features', () => {
  it.each(FEATURES.map((f) => [`${f.tab}: ${f.name}`, f] as const))('%s', async (_n, f) => {
    const r = await run(mf, f.latex);
    for (const stage of STAGES) {
      const want = f.expect?.[stage] === 'fails' ? false : true;
      expect({ stage, ok: r.stages[stage].ok, detail: r.stages[stage].detail }).toMatchObject({ stage, ok: want });
    }
  });

  it('covers every MathType tab and ChemType', () => {
    expect(new Set(FEATURES.map((f) => f.tab))).toEqual(
      new Set(['General', 'Symbols', 'Arrows', 'Greek', 'Matrices', 'Scripts and layouts', 'Decorations', 'Big operators', 'Calculus', 'Format', 'Elementary math', 'ChemType'])
    );
  });
});

describe('compat: MathLive-only names stored under the names Temml knows', () => {
  it('maps \\enclose{longdiv} and \\enclose{circle} to Temml, and back for editing', () => {
    // MathLive adds the default style in brackets to latex-expanded
    const stored = toStorageLatex('3\\enclose{longdiv}[shadow="none"]{12\\frac{1}{2}}+\\enclose{circle}{5}');
    expect(stored).toBe('3\\longdiv{12\\frac{1}{2}}+\\textcircled{5}');
    expect(toFieldLatex(stored)).toBe('3\\enclose{longdiv}{12\\frac{1}{2}}+\\enclose{circle}{5}');
  });
  it('maps \\overarc to \\wideparen and leaves other \\enclose notations alone', () => {
    expect(toStorageLatex('\\overarc{AB}')).toBe('\\wideparen{AB}');
    expect(toStorageLatex('\\enclose{phasorangle}{x}')).toBe('\\enclose{phasorangle}{x}');
    expect(toStorageLatex('\\enclosed{x}')).toBe('\\enclosed{x}');
  });
});
