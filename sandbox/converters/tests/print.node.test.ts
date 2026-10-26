// Print path: Temml MathML → MathJax SVG, server-side. Uses the Temml output
// recorded in findings/mathml-converters-raw.json (`pnpm compare`), so this
// test checks exactly what the converter spike stored.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import temml from 'temml';
import { mathmlToSvg, prepareForSvg } from '../src/print';

type Row = { id: string; latex: string; results: Record<string, { mathml: string }> };
const rows: Row[] = JSON.parse(
  readFileSync(new URL('../../../findings/mathml-converters-raw.json', import.meta.url), 'utf8')
);

describe('every stored formula becomes a self-contained SVG', () => {
  it.each(rows.map((r) => [r.id, r.results['Temml 0.14.0'].mathml]))('%s', async (_id, mathml) => {
    const svg = await mathmlToSvg(mathml);
    expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).not.toMatch(/data-mjx-error|merror/);
    expect(svg).toMatch(/<path /); // glyphs are inlined, no font needed
    expect(svg).not.toContain('<use '); // fontCache: 'none' → no shared defs
    expect(svg).not.toContain('class="tml-');
  });
});

describe('prepareForSvg', () => {
  it('drops Temml column padding on <mtd> (it makes MathJax overlap matrix entries)', () => {
    const tml = temml.renderToString('\\begin{pmatrix}1&2\\end{pmatrix}', { xml: true });
    expect(tml).toMatch(/<mtd style="padding/);
    expect(prepareForSvg(tml)).not.toMatch(/<mtd[^>]*style=/);
  });

  it('keeps the inline styles MathJax honours (colour, \\boxed border)', () => {
    const tml = temml.renderToString('\\boxed{\\textcolor{red}{x}}', { xml: true });
    expect(prepareForSvg(tml)).toContain('border:1px solid');
    expect(prepareForSvg(tml)).toContain('color:#ff0000');
  });

  it('\\cancel survives as a strike-through', async () => {
    const svg = await mathmlToSvg(temml.renderToString('\\cancel{x}', { xml: true }));
    expect(svg).toContain('data-mml-node="menclose"');
  });
});
