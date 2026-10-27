// MathType MathML into the field. Plain mathml-to-latex (what the Froala
// plugin uses today) against src/wiris-import.ts, and what happens when
// MathType's MathML is displayed as it is stored.
import { beforeAll, describe, expect, it } from 'vitest';
import 'mathlive/fonts.css';
import { MathfieldElement } from 'mathlive';
import temml from 'temml';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';
import { fromPersistedMathml } from '@sandbox/basic/src/serialize';
import { WIRIS_SAMPLES } from '../src/wiris-samples';
import { importMathml } from '../src/wiris-import';
import { run, svgOf } from '../src/run';

let mf: MathfieldElement;
beforeAll(async () => {
  await loadTemmlMhchem();
  mf = new MathfieldElement();
  document.body.append(mf);
});

const ELEMENTARY = ['stack-add', 'carries', 'longdiv'];
const byId = (id: string) => WIRIS_SAMPLES.find((s) => s.id === id)!;

describe('MathType MathML → editable LaTeX with src/wiris-import.ts', () => {
  it.each(WIRIS_SAMPLES.map((s) => [s.name, s] as const))('%s', async (_n, s) => {
    const imp = importMathml(s.mathml);
    expect(imp.source).toBe('converted');
    for (const k of s.keep) expect(imp.latex).toMatch(k);
    const r = await run(mf, imp.latex);
    expect(r.stages.mathlive).toEqual({ ok: true }); // the field takes it
    expect(r.stages.temml).toEqual({ ok: true }); // and it can be stored again
    expect(r.stages.svg).toEqual({ ok: true }); // and printed
    expect(imp.approximations.length > 0).toBe(ELEMENTARY.includes(s.id));
  });

  it('keeps a LaTeX annotation as it is', () => {
    const xml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi>x</mi><annotation encoding="LaTeX">x</annotation></semantics></math>';
    expect(importMathml(xml)).toEqual({ latex: 'x', source: 'annotation', approximations: [] });
  });

  it('notes a European long division style it can only draw the US way', () => {
    const s = byId('longdiv').mathml.replace('left)(right', 'stackedrightright');
    expect(importMathml(s).approximations).toContain('long division style "stackedrightright" drawn in the US style');
  });
});

describe('what plain mathml-to-latex 1.8.0 loses (the current fallback)', () => {
  // [sample, what is lost]
  const LOSSES: [string, string][] = [
    ['mfenced-matrix', 'parentheses become square brackets'],
    ['piecewise', 'invalid LaTeX: \\right with no delimiter'],
    ['upright', 'units turn italic'],
    ['chem', 'element symbols turn italic'],
    ['color', 'colour dropped'],
    ['background', 'background dropped'],
    ['size', 'size dropped'],
    ['circle', 'circle becomes a box'],
    ['linebreak', 'line break becomes \\\\ outside any environment (MathLive rejects it)'],
    ['stack-add', 'column layout lost: the digits in one row'],
    ['carries', 'column layout lost'],
    ['longdiv', 'division layout lost'],
  ];
  it.each(LOSSES)('%s: %s', (id) => {
    const s = byId(id);
    const plain = fromPersistedMathml(s.mathml).latex;
    const imported = importMathml(s.mathml).latex;
    expect(plain).not.toBe(imported);
    const lossy =
      id === 'upright' || id === 'chem' ? !/\\mathrm/.test(plain)
      : id === 'mfenced-matrix' ? /bmatrix/.test(plain)
      : id === 'piecewise' ? /\\right$/.test(plain)
      : id === 'circle' ? /\\boxed/.test(plain)
      : id === 'linebreak' ? /^[^\\]*\\\\/.test(plain) && !/begin/.test(plain)
      : ELEMENTARY.includes(id) ? !/begin\{array\}/.test(plain)
      : !s.keep.every((k) => k.test(plain));
    expect(lossy, plain).toBe(true);
  });
});

describe('MathType elementary math as stored', () => {
  it.each(ELEMENTARY)('%s: MathJax (our display and print renderer) cannot draw it', async (id) => {
    const r = await svgOf(byId(id).mathml);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/Unknown node type "(mstack|mlongdiv)"/);
  });

  it('Chromium native MathML draws <mstack> on one line (MathML Core has no elementary math)', () => {
    const host = document.createElement('div');
    host.innerHTML = byId('stack-add').mathml + '<br>' + importedNative();
    document.body.append(host);
    const [stack, table] = Array.from(host.querySelectorAll('math')).map((m) => m.getBoundingClientRect().height);
    host.remove();
    // the three rows of the converted table are at least twice as tall as the one line <mstack> gives
    expect(table).toBeGreaterThan(stack * 2);
  });
});

/** The converted column addition as Temml MathML, for the native-rendering comparison */
function importedNative() {
  return temml.renderToString(importMathml(byId('stack-add').mathml).latex, { xml: true });
}
