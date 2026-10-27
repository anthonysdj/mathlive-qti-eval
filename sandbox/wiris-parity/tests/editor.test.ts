// MathType editor behaviours, done with MathLive: styling a selection (the
// Format tab), undo/redo, copy, pasting MathML, the editor's UI languages, and
// $$…$$ LaTeX in the text of a Froala document.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import 'mathlive/fonts.css';
import { MathfieldElement } from 'mathlive';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';
import { toEditorHtml } from '@sandbox/froala';
import { createEditor, destroyEditor, eqs, rendered, type Editor } from '../../froala/tests/helpers';
import { enableMathmlCopy, enableMathmlPaste, parseLatexInText } from '../src/editor-extras';
import { run } from '../src/run';

let mf: MathfieldElement;
beforeAll(async () => {
  await loadTemmlMhchem();
  mf = new MathfieldElement();
  document.body.append(mf);
});

const NS = 'http://www.w3.org/1998/Math/MathML';

function paste(target: MathfieldElement, type: string, text: string) {
  const dt = new DataTransfer();
  dt.setData(type, text);
  const sink = target.shadowRoot!.querySelector('[part=keyboard-sink], textarea, [contenteditable]') as HTMLElement;
  sink.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, composed: true, cancelable: true }));
}

describe('Format tab on a selection', () => {
  it.each([
    ['colour', { color: '#ff0000' }, /\\textcolor\{#ff0000\}\{b\}|\\color\{#ff0000\}/],
    ['background', { backgroundColor: '#ffff00' }, /\\colorbox\{#ffff00\}/],
    ['size', { fontSize: 7 as const }, /\\(large|Large|huge|LARGE)/],
    ['bold', { variantStyle: 'bold' as const }, /\\mathbf|\\boldsymbol/],
  ])('%s', async (_n, style, re) => {
    mf.setValue('a+b+c');
    mf.selection = { ranges: [[2, 3]] }; // the b
    mf.applyStyle(style as any);
    const latex = mf.getValue('latex');
    expect(latex).toMatch(re);
    const r = await run(mf, latex); // and it stores and prints
    expect(r.stages.temml).toEqual({ ok: true });
    expect(r.stages.svg).toEqual({ ok: true });
  });
});

describe('editing', () => {
  it('undo and redo', async () => {
    mf.setValue('');
    mf.focus();
    await new Promise((r) => setTimeout(r, 100)); // focus() is async (M1)
    mf.executeCommand(['insert', 'x^2']);
    mf.executeCommand(['insert', '+1']);
    expect(mf.getValue('latex')).toBe('x^2+1');
    mf.executeCommand('undo');
    expect(mf.getValue('latex')).toBe('x^2');
    mf.executeCommand('redo');
    expect(mf.getValue('latex')).toBe('x^2+1');
  });

  function copy() {
    mf.setValue('\\frac{1}{2}');
    mf.selection = { ranges: [[0, mf.lastOffset]] };
    const dt = new DataTransfer();
    const sink = mf.shadowRoot!.querySelector('[part=keyboard-sink], textarea, [contenteditable]') as HTMLElement;
    sink.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, composed: true, cancelable: true }));
    return dt;
  }
  it('MathLive copies LaTeX, not MathML', () => {
    const dt = copy();
    expect(dt.getData('application/x-latex')).toBe('\\frac{1}{2}');
    expect(dt.types).not.toContain('text/html');
    expect(dt.types).not.toContain('application/mathml+xml');
  });
  it('with enableMathmlCopy the clipboard also has the stored MathML', () => {
    const off = enableMathmlCopy(mf);
    try {
      const dt = copy();
      expect(dt.getData('text/html')).toMatch(/^<math xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"[^>]*>.*<mfrac>/);
      expect(dt.getData('text/html')).toContain('<annotation encoding="application/x-tex">\\frac{1}{2}</annotation>');
      expect(dt.getData('application/x-latex')).toBe('\\frac{1}{2}');
    } finally {
      off();
    }
  });

  it('the editor UI has 15 languages', () => {
    expect(Object.keys(MathfieldElement.strings).sort()).toEqual(
      ['ar', 'de', 'el', 'en', 'es', 'fr', 'he', 'it', 'ja', 'ko', 'pl', 'pt', 'uk', 'zh-cn', 'zh-tw']
    );
  });
});

describe('pasting MathML into the field', () => {
  const MATHML = `<math xmlns="${NS}"><mfrac><mn>1</mn><msqrt><mi>x</mi></msqrt></mfrac></math>`;
  it('MathLive alone does not turn it into a formula', () => {
    mf.setValue('');
    paste(mf, 'text/plain', MATHML);
    expect(mf.getValue('latex')).not.toMatch(/\\frac\{1\}\{\\sqrt\{x\}\}/);
  });
  it('with enableMathmlPaste it does, also from text/html and without a namespace', () => {
    const off = enableMathmlPaste(mf);
    try {
      mf.setValue('');
      paste(mf, 'text/plain', MATHML);
      expect(mf.getValue('latex')).toBe('\\frac{1}{\\sqrt{x}}');
      mf.setValue('');
      paste(mf, 'text/html', '<p>copied: <math><msup><mi>x</mi><mn>2</mn></msup></math></p>');
      expect(mf.getValue('latex')).toBe('x^{2}');
      // plain LaTeX still goes through MathLive
      mf.setValue('');
      paste(mf, 'text/plain', '\\sqrt{2}');
      expect(mf.getValue('latex')).toBe('\\sqrt{2}');
    } finally {
      off();
    }
  });
});

describe('$$…$$ LaTeX in the text of a document', () => {
  let ed: Editor | null = null;
  afterEach(() => {
    if (ed) destroyEditor(ed);
    ed = null;
  });

  it('becomes stored MathML, then editable equations in Froala', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<p>Solve $$x^2-4=0$$ and $$\\frac{a}{b}$$. Price: $5, not $$\\notacommand$$. <code>$$x$$</code></p>';
    expect(parseLatexInText(host)).toBe(2);
    expect(host.querySelectorAll('math')).toHaveLength(2);
    expect(host.querySelector('math annotation')!.textContent).toBe('x^2-4=0');
    expect(host.textContent).toContain('$$\\notacommand$$'); // Temml rejects it: left as text
    expect(host.querySelector('code')!.textContent).toBe('$$x$$');

    ed = await createEditor();
    ed.html.set(toEditorHtml(host.innerHTML));
    expect(eqs(ed)).toHaveLength(2);
    await rendered(ed);
    const out = new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${ed.html.get()}</div>`, 'application/xml');
    expect(Array.from(out.getElementsByTagNameNS(NS, 'math'))).toHaveLength(2);
  });
});
