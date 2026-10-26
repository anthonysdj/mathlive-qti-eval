import { describe, expect, it } from 'vitest';
import { MathfieldElement } from 'mathlive';
import { fromPersistedMathml, toPersistedMathml, MATHML_NS } from '../src/serialize';

describe('toPersistedMathml', () => {
  it('wraps a multi-node fragment in <math><semantics><mrow>', () => {
    const xml = toPersistedMathml('<mi>x</mi><mo>+</mo><mn>1</mn>', 'x+1');
    expect(xml).toBe(
      `<math xmlns="${MATHML_NS}" display="inline"><semantics><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow>` +
        '<annotation encoding="application/x-tex">x+1</annotation></semantics></math>'
    );
  });

  it('does not double-wrap a single element', () => {
    expect(toPersistedMathml('<mfrac><mi>a</mi><mi>b</mi></mfrac>', '\\frac{a}{b}', 'block')).toContain(
      'display="block"><semantics><mfrac>'
    );
  });

  it('escapes LaTeX that contains XML special characters', () => {
    const latex = 'a<b \\text{&} c>d';
    const xml = toPersistedMathml('<mi>a</mi>', latex);
    expect(xml).toContain('a&lt;b \\text{&amp;} c&gt;d');
    expect(fromPersistedMathml(xml)).toEqual({ latex, source: 'annotation' });
  });

  it('is well-formed XML for real MathLive output', () => {
    const mf = new MathfieldElement();
    document.body.append(mf);
    mf.value = 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}';
    const xml = toPersistedMathml(mf.getValue('math-ml'), mf.value);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.namespaceURI).toBe(MATHML_NS);
    mf.remove();
  });
});

describe('fromPersistedMathml', () => {
  // The samples below are hand-written in the shapes Wiris MathType is known
  // to produce (namespaced <math>, optional LaTeX annotation). They are NOT
  // captured Wiris output: real samples come with the Wiris sandbox (M4).
  it('prefers a LaTeX annotation, whatever its encoding label', () => {
    for (const enc of ['application/x-tex', 'LaTeX', 'TeX']) {
      const xml = `<math xmlns="${MATHML_NS}"><semantics><mn>2</mn><annotation encoding="${enc}">\\frac{4}{2}</annotation></semantics></math>`;
      expect(fromPersistedMathml(xml)).toEqual({ latex: '\\frac{4}{2}', source: 'annotation' });
    }
  });

  it('ignores non-TeX annotations and converts the presentation MathML', () => {
    const xml = `<math xmlns="${MATHML_NS}"><semantics><mfrac><mn>1</mn><mn>2</mn></mfrac><annotation encoding="text/plain">1/2</annotation></semantics></math>`;
    expect(fromPersistedMathml(xml)).toEqual({ latex: '\\frac{1}{2}', source: 'converted' });
  });

  it('converts plain annotation-less MathML', () => {
    const xml = `<math xmlns="${MATHML_NS}"><msqrt><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>1</mn></msqrt></math>`;
    const { latex, source } = fromPersistedMathml(xml);
    expect(source).toBe('converted');
    const mf = new MathfieldElement();
    document.body.append(mf);
    mf.value = latex;
    expect(mf.getValue('math-ml')).toBe(
      '<msqrt><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>1</mn></mrow></msqrt>'
    );
    mf.remove();
  });

  it('rejects malformed XML (e.g. MathLive output containing &ne;)', () => {
    expect(() => fromPersistedMathml('<math><mo>&ne;</mo></math>')).toThrow(/Invalid MathML/);
  });
});
