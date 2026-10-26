import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MathfieldElement } from 'mathlive';
import { corpus, knownDefects } from '../src/corpus';
import { isWellFormedXml, probe, type ProbeResult } from '../src/probe';

let mf: MathfieldElement;
const results = new Map<string, ProbeResult>();

beforeAll(() => {
  mf = new MathfieldElement();
  document.body.append(mf);
  for (const c of corpus) results.set(c.id, probe(mf, c.latex));
});
afterAll(() => mf.remove());

describe.each(corpus)('$category: $id  $latex', (c) => {
  const r = () => results.get(c.id)!;

  it('parses without errors', () => {
    expect(r().errors).toEqual([]);
  });

  it('keeps the LaTeX (setValue → getValue("latex") → setValue is stable)', () => {
    expect(r().latex).toBe(c.expect?.latex ?? c.latex);
    expect(r().latexStable).toBe(true);
  });

  if (c.expect?.mathml) it('emits the expected MathML', () => expect(r().mathml).toBe(c.expect!.mathml));
  for (const s of c.expect?.mathmlHas ?? []) it(`MathML contains ${s}`, () => expect(r().mathml).toContain(s));

  const defect = knownDefects[c.id];
  if (!defect) {
    it('emits non-empty, well-formed MathML', () => {
      expect(r().mathml).not.toBe('');
      expect(r().mathmlWellFormed).toBe(true);
    });
    it('recovers the exact LaTeX from the persisted <annotation>', () => {
      expect(r().annotationRoundTrip).toBe(true);
    });
  } else {
    // Pinned defects: these assertions fail once MathLive fixes the issue.
    it(`KNOWN DEFECT (${defect.defect}) is still present`, () => {
      const { mathml } = r();
      switch (defect.defect) {
        case 'malformed-xml':
          expect(isWellFormedXml(mathml)).toBe(false);
          break;
        case 'empty':
          expect(mathml).toBe('');
          break;
        case 'body-lost':
          if (c.id === 'phantom') expect(mathml).not.toContain('mphantom');
          else expect(mathml).not.toMatch(/<mi>(a|A)<\/mi>/);
          break;
        case 'invalid-structure':
          expect(mathml).toMatch(/\?\?|<msup><mi>f<\/mi><mo>&#x2061;<\/mo>|<mtr><mi>|<munderover >→/);
          break;
        case 'style-dropped':
          expect(mathml).not.toContain('mathcolor');
          break;
        case 'semantics-changed':
          expect(mathml).toMatch(/<mn>3\.14<\/mn>|<mo>730<\/mo>/);
          break;
      }
    });
  }
});

describe('MathML-only path (annotation-less content, e.g. from Wiris)', () => {
  // How much survives MathLive MathML → mathml-to-latex → MathLive when the
  // LaTeX annotation is missing. Recorded rather than required: the numbers
  // feed findings/roundtrip.md.
  it('reports how many cases give identical MathML after the trip', () => {
    const ok = corpus.filter((c) => {
      const v = results.get(c.id)!.viaMathml;
      return 'sameMathml' in v && v.sameMathml;
    });
    // 0.111.1 + mathml-to-latex 1.8.0: 36 of 58 (3 of those are empty both
    // ways because MathLive emits no MathML). Lower means a regression.
    expect(ok.length).toBeGreaterThanOrEqual(36);
  });

  it('loses function names like \\sin (emitted as <mo>, read back as letters)', () => {
    const v = results.get('trig')!.viaMathml;
    expect('latex' in v && v.latex).toContain('sin^{2}');
    expect('sameMathml' in v && v.sameMathml).toBe(false);
  });
});
