// Front-end display of an inserted equation (src/render.ts, demo/main.ts):
// field → stored Temml MathML → MathJax SVG in the page, MathML kept for
// screen readers, and only the <math> saved.
import { beforeAll, describe, expect, it } from 'vitest';
import { MathfieldElement } from 'mathlive';
import { loadTemmlMhchem } from '../src/temml-mhchem';
import { EQ_CSS, latexOf, renderEquation, storedMathml, toStoredHtml } from '../src/render';
import { mathmlToSvg } from '../src/print';
import { cases, MACROS } from '../src/cases';

let mf: MathfieldElement;
beforeAll(async () => {
  await loadTemmlMhchem();
  mf = new MathfieldElement();
  document.body.append(mf);
  mf.macros = { ...mf.macros, ...MACROS };
  const style = document.createElement('style');
  style.textContent = EQ_CSS;
  document.head.append(style);
});

describe('every corpus formula renders as an SVG in the page', () => {
  it.each(cases.map((c) => [c.id, c.latex]))('%s', async (_id, latex) => {
    mf.setValue(latex);
    const mathml = storedMathml(mf);
    const eq = await renderEquation(mathml);
    document.body.append(eq);

    const svg = eq.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const box = svg.getBoundingClientRect();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(svg.querySelector('path')).not.toBeNull(); // glyphs drawn, no font needed

    // The stored MathML is still in the DOM for screen readers, with its LaTeX
    const sr = eq.querySelector('math.eq-sr')!;
    expect(sr.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML');
    expect(sr.querySelector('annotation')?.getAttribute('encoding')).toBe('application/x-tex');
    eq.remove();
  });
});

describe('screen shows the print SVG', () => {
  it('the SVG in the page is the one print gets', async () => {
    mf.setValue('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
    const mathml = storedMathml(mf);
    const eq = await renderEquation(mathml);
    const printSvg = document.importNode(
      new DOMParser().parseFromString(await mathmlToSvg(mathml), 'image/svg+xml').documentElement,
      true
    );
    const shown = eq.querySelector('svg')!;
    expect(shown.getAttribute('viewBox')).toBe(printSvg.getAttribute('viewBox'));
    expect(shown.innerHTML).toBe(printSvg.innerHTML);
  });

  it('loads rarer glyphs on demand in the browser (double-struck ℝ)', async () => {
    mf.setValue('x\\in\\mathbb{R}');
    const eq = await renderEquation(storedMathml(mf));
    expect(eq.querySelector('svg path[data-c="211D"]')).not.toBeNull();
  });

  it('draws the whole formula, not just its first symbol (stored <semantics> unwrapped)', async () => {
    mf.setValue('a+b');
    const eq = await renderEquation(storedMathml(mf));
    expect(eq.querySelectorAll('svg path')).toHaveLength(3);
  });

  it('scales with the surrounding text (sized in ex, aligned to the baseline)', async () => {
    mf.setValue('x^2');
    const eq = await renderEquation(storedMathml(mf));
    const svg = eq.querySelector('svg')!;
    expect(svg.getAttribute('width')).toMatch(/ex$/);
    expect(svg.getAttribute('style')).toMatch(/vertical-align: ?-?[\d.]+ex/);
    const host = document.createElement('p');
    host.append(eq);
    document.body.append(host);
    host.style.fontSize = '10px';
    const small = svg.getBoundingClientRect().height;
    host.style.fontSize = '40px';
    expect(svg.getBoundingClientRect().height).toBeCloseTo(small * 4, 0);
    host.remove();
  });

  it('the screen-reader MathML takes no space', async () => {
    mf.setValue('\\frac{a}{b}');
    const eq = await renderEquation(storedMathml(mf));
    document.body.append(eq);
    expect(eq.querySelector('.eq-sr')!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    eq.remove();
  });
});

describe('editing and saving', () => {
  it('the LaTeX comes back out of a rendered equation for editing', async () => {
    mf.setValue('\\sqrt[3]{x}+\\vecb{v}');
    const mathml = storedMathml(mf);
    const eq = await renderEquation(mathml);
    const latex = latexOf(eq.querySelector('.eq-sr')!.outerHTML);
    expect(latex).toContain('\\sqrt[3]{x}');
    expect(latex).toContain('\\mathbf{v}'); // macros are expanded before storage
  });

  it('only the <math> is saved, not the SVG or the wrapper', async () => {
    mf.setValue('x^2');
    const mathml = storedMathml(mf);
    const doc = document.createElement('div');
    doc.append('Solve ', await renderEquation(mathml), '.');
    const saved = toStoredHtml(doc);
    expect(saved).toMatch(/^Solve <math [^>]*>.*<\/math>\.$/);
    expect(saved).not.toContain('<svg');
    expect(saved).not.toMatch(/class="eq/);
    expect(saved).toContain('<annotation encoding="application/x-tex">x^2</annotation>');
    // and the page itself is untouched
    expect(doc.querySelector('.eq svg')).not.toBeNull();
  });

  it('what is saved is well-formed XML, even with spaces in the formula', async () => {
    mf.setValue('a\\ b+\\text{and so on}');
    const doc = document.createElement('div');
    doc.append('Text\u00a0with spaces ', await renderEquation(storedMathml(mf)));
    const saved = toStoredHtml(doc);
    expect(saved).not.toContain('&nbsp;');
    const parsed = new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${saved}</div>`, 'application/xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
  });

  it('a command the converter does not know is refused, not stored broken', () => {
    // (\enclose{circle} and \enclose{longdiv} are mapped to Temml's names, see pipeline.ts)
    mf.setValue('\\enclose{phasorangle}{x}');
    expect(() => storedMathml(mf)).toThrow();
  });
});
