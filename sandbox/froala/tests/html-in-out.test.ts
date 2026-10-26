// Stored HTML in and out of Froala: html.set(stored) then html.get() must give
// the stored HTML back, the equations must show, and nothing may leak.
import { afterEach, describe, expect, it } from 'vitest';
import { cases } from '@sandbox/converters/src/cases';
import FroalaEditor from 'froala-editor';
import { toEditorHtml, withMathOptions } from '../src';
import { createEditor, destroyEditor, eqs, parseStored, stored, type Editor } from './helpers';

// Same XML? Temml writes <mspace></mspace>, the XML serialiser <mspace/>.
const xml = (html: string) =>
  new XMLSerializer().serializeToString(
    new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`, 'application/xml')
  );

let ed: Editor | null = null;
afterEach(() => {
  if (ed) destroyEditor(ed);
  ed = null;
});

describe('without the plugin, Froala 5.5.0 destroys MathML', () => {
  it('unwraps <math> and leaves its text, annotation included, as visible text', async () => {
    ed = await createEditor({ pluginsEnabled: [] });
    const mathml = await stored('a+b^2');
    ed.html.set(`<p>Hello ${mathml} world</p>`);
    expect(ed.html.get()).toBe('<p>Hello a+b2a+b^2 world</p>');
  });
});

describe('with the plugin, every corpus formula survives load → save', () => {
  it.each(cases.map((c) => [c.id, c.latex]))('%s', async (_id, latex) => {
    ed ??= await createEditor();
    const mathml = await stored(latex);
    const input = `<p>Before ${mathml} after.</p>`;
    ed.html.set(toEditorHtml(input));

    // In the editor: one atomic element, no MathML or SVG in Froala's own HTML
    const [eq] = eqs(ed);
    expect(eqs(ed)).toHaveLength(1);
    expect(eq.getAttribute('contenteditable')).toBe('false');
    expect(ed.el.querySelector('math, svg')).toBeNull();
    await eq.ready;
    expect(eq.shadowRoot!.querySelector('svg path')).not.toBeNull();
    expect(eq.shadowRoot!.querySelector('.eq-error')).toBeNull();

    // Out: the same XML as went in
    expect(xml(ed.html.get())).toBe(xml(input));
  });
});

describe('stored HTML passed straight to html.set()', () => {
  it('is hydrated, but Froala collapses runs of spaces in the MathML text first', async () => {
    ed = await createEditor();
    const mathml = await stored('\\begin{aligned}a&=b+c\\\\ &=d\\end{aligned}');
    expect(mathml).toContain('\\\\  &amp;'); // MathLive's serialisation has two spaces here
    ed.html.set(`<p>${mathml}</p>`);
    expect(eqs(ed)).toHaveLength(1);
    const out = ed.html.get();
    expect(out).toContain('\\\\ &amp;');
    expect(xml(out)).toBe(xml(`<p>${mathml.replace('\\\\  &amp;', '\\\\ &amp;')}</p>`));
  });
});

describe('stored HTML is well-formed XML', () => {
  it('turns Froala\'s &nbsp; and <br> into U+00A0 and <br />', async () => {
    ed = await createEditor();
    const mathml = await stored('\\text{a b}~x');
    ed.html.set(toEditorHtml(`<p>One&nbsp;two<br>${mathml}</p>`));
    const out = ed.html.get();
    expect(out).not.toContain('&nbsp;');
    expect(out).toContain('One two<br />');
    expect(parseStored(out).querySelector('parsererror')).toBeNull();
    expect(parseStored(out).getElementsByTagNameNS('http://www.w3.org/1998/Math/MathML', 'math')).toHaveLength(1);
  });

  it('keeps formatting, lists and tables around equations', async () => {
    ed = await createEditor();
    const m = await stored('x^2');
    const input =
      `<p><strong>Bold ${m}</strong> and <em>${m}</em></p>` +
      `<ul><li>Item ${m}</li></ul>` +
      `<table><tbody><tr><td>${m}</td><td>cell</td></tr></tbody></table>`;
    ed.html.set(toEditorHtml(input));
    expect(eqs(ed)).toHaveLength(4);
    expect(xml(ed.html.get())).toBe(xml(input));
  });

  it('drops an equation whose MathML is broken instead of storing junk', async () => {
    ed = await createEditor();
    ed.html.set('<p>a <math-eq data-mathml="&lt;math&gt;&lt;mi&gt;x" contenteditable="false"></math-eq> b</p>');
    expect(ed.html.get()).toBe('<p>a  b</p>');
  });
});

describe('content already in the element when Froala starts', () => {
  it('loses its MathML: Froala cleans it before plugins start', async () => {
    const mathml = await stored('\\sqrt{2}');
    ed = await createEditor({}, `<p>Root: ${mathml}</p>`);
    expect(eqs(ed)).toHaveLength(0);
    expect(ed.html.get()).toBe('<p>Root: 2\\sqrt2</p>'); // MathLive writes \sqrt2
  });

  it('is kept and hydrated with withMathOptions()', async () => {
    const mathml = await stored('\\sqrt{2}');
    ed = await createEditor(withMathOptions({}, FroalaEditor.DEFAULTS), `<p>Root: ${mathml}</p>`);
    expect(eqs(ed)).toHaveLength(1);
    expect(xml(ed.html.get())).toBe(xml(`<p>Root: ${mathml}</p>`));
  });
});
