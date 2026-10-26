// Assertions behind findings/mathml-converters.md. The full per-case data is
// in findings/mathml-converters-raw.json (`pnpm compare`).
import { beforeAll, describe, expect, it } from 'vitest';
import temml from 'temml';
import { MathfieldElement } from 'mathlive';
import { loadTemmlMhchem, mathjaxConverter, mathliveConverter, temmlConverter, type Converter } from '../src/converters';
import { check } from '../src/check';
import { storageMathml, toStandardLatex } from '../src/pipeline';
import { cases, MACROS } from '../src/cases';

let mf: MathfieldElement;
beforeAll(async () => {
  await loadTemmlMhchem();
  mf = new MathfieldElement();
  document.body.append(mf);
  mf.macros = { ...mf.macros, ...MACROS };
});

describe.each([temmlConverter, mathjaxConverter])('$name through the storage pipeline', (conv: Converter) => {
  it.each(cases.map((c) => [c.id, c.latex]))('%s: clean MathML', (_id, latex) => {
    const r = storageMathml(mf, latex, conv);
    expect(r.error).toBeUndefined();
    const c = check(r.mathml!, latex);
    expect(c.wellFormed).toBe(true);
    expect(c.empty).toBe(false);
    expect(c.merror).toBe(false);
    expect(c.problems).toEqual([]);
    expect(c.missing).toEqual([]);
  });
});

describe('MathLive baseline (for contrast)', () => {
  it('fails the same checks on 14 of the 60 cases', () => {
    const failing = cases.filter((c) => {
      const r = storageMathml(mf, c.latex, mathliveConverter);
      const k = check(r.mathml!, c.latex);
      return !k.wellFormed || k.empty || k.problems.length > 0 || k.missing.length > 0;
    });
    expect(failing.map((c) => c.id)).toEqual([
      'binom', 'prime', 'relations', 'overline', 'overrightarrow', 'underbrace', 'overbrace',
      'xrightarrow', 'ce-water', 'ce-reaction', 'space-tilde', 'phantom', 'placeholder', 'prompt',
    ]);
  });
});

describe('Semantics the structural check cannot see', () => {
  const tml = (l: string) => temmlConverter.convert(l).mathml!;
  const mj = (l: string) => mathjaxConverter.convert(l).mathml!;

  it('decimal comma: Temml keeps one number, MathJax splits it', () => {
    expect(tml('3{,}14')).toContain('<mn>3,14</mn>');
    expect(mj('3{,}14')).toMatch(/<mn[^>]*>3<\/mn>[\s\S]*<mo[^>]*>,<\/mo>[\s\S]*<mn[^>]*>14<\/mn>/);
  });

  it('function names are <mi> in both (MathLive uses <mo>)', () => {
    expect(tml('\\sin x')).toContain('<mi>sin</mi>');
    expect(mj('\\sin x')).toMatch(/<mi[^>]*>sin<\/mi>/);
  });

  it('colour: Temml uses a style attribute, MathJax uses mathcolor', () => {
    expect(tml('\\textcolor{red}{x}')).toContain('style="color:#ff0000;"');
    expect(mj('\\textcolor{red}{x}')).toContain('mathcolor="red"');
  });

  it('\\mathbb: Temml emits the Unicode letter, MathJax mathvariant (ignored by Chromium)', () => {
    expect(tml('\\mathbb{R}')).toContain('<mi>ℝ</mi>');
    expect(mj('\\mathbb{R}')).toContain('mathvariant="double-struck"');
  });

  it('\\boxed: Temml draws it with inline CSS (no menclose), MathJax uses <menclose>', () => {
    expect(tml('\\boxed{x}')).toContain('style="padding:3pt;border:1px solid;"');
    expect(tml('\\boxed{x}')).not.toContain('menclose');
    expect(mj('\\boxed{x}')).toContain('<menclose notation="box"');
  });

  it('\\overline: Temml needs its stylesheet (class tml-overline on <menclose>)', () => {
    expect(tml('\\overline{AB}')).toContain('class="tml-overline"');
  });

  it('MathJax annotates every node with data-latex', () => {
    expect(mj('x+1')).toContain('data-latex="x+1"');
  });
});

describe('Storage format and safety', () => {
  it('Temml annotate:true produces our persisted shape, with the LaTeX escaped', () => {
    const xml = temml.renderToString('a<b', { xml: true, annotate: true });
    expect(xml).toBe(
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>a</mi><mo>&lt;</mo><mi>b</mi></mrow>' +
        '<annotation encoding="application/x-tex">a&lt;b</annotation></semantics></math>'
    );
  });

  it('neither converter accepts \\href (no javascript: URLs in stored content)', () => {
    expect(temmlConverter.convert('\\href{javascript:alert(1)}{x}').error).toMatch(/Unsupported function name: \\href/);
    expect(mathjaxConverter.convert('\\href{javascript:alert(1)}{x}').error).toMatch(/Undefined control sequence \\href/);
  });

  it('MathLive-only commands must be mapped first', () => {
    expect(temmlConverter.convert('\\placeholder{}').error).toMatch(/Unsupported function name/);
    expect(toStandardLatex('\\frac{\\placeholder{}}{\\placeholder[b]{2}}')).toBe('\\frac{\\square}{{2}}');
    expect(toStandardLatex('\\mleft(x\\mright)')).toBe('\\left(x\\right)');
    expect(temmlConverter.convert(toStandardLatex('\\mleft(x\\mright)')).error).toBeUndefined();
  });

  it('custom macros: the expanded LaTeX converts cleanly', () => {
    const r = storageMathml(mf, 'x\\in\\R', temmlConverter);
    expect(r.input).toBe('x\\in\\mathbb{R}');
    expect(r.mathml).toContain('<mi>ℝ</mi>');
  });
});
