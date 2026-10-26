// Loading content written by Wiris MathType and making it editable.
// The samples follow the formats in Wiris's own source (src/wiris.ts); real
// items from our database should be added here when we have them.
import { afterEach, describe, expect, it } from 'vitest';
import { fromPersistedMathml } from '@sandbox/basic/src/serialize';
import { safeXmlDecode, toEditorHtml } from '../src';
import { createEditor, destroyEditor, eqs, rendered, type Editor } from './helpers';

const NS = 'http://www.w3.org/1998/Math/MathML';
const xml = (html: string) =>
  new XMLSerializer().serializeToString(new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`, 'application/xml'));

// saveMode 'xml' (MathML in the HTML), no LaTeX: a formula built with the palette
const WIRIS_XML = `<math xmlns="${NS}"><mfrac><mrow><mi>a</mi><mo>+</mo><mn>1</mn></mrow><msqrt><mi>b</mi></msqrt></mfrac></math>`;
// typed as LaTeX in MathType: Wiris keeps it as encoding="LaTeX"
const WIRIS_LATEX = `<math xmlns="${NS}"><semantics><msup><mi>x</mi><mn>2</mn></msup><annotation encoding="LaTeX">x^2</annotation></semantics></math>`;
// what the Wiris plugin leaves in the editor, and saves in saveMode 'image'
const safe = `«math xmlns=¨${NS}¨»«mi»y«/mi»«mo»=«/mo»«mn»3«/mn»«mo»§#160;«/mo»«mi»π«/mi»«/math»`;
const WIRIS_IMG = `<img class="Wirisformula" src="https://www.wiris.net/demo/plugins/app/showimage?formula=0" data-mathml="${safe}" alt="y equals 3 pi" role="math" style="vertical-align:-4px" width="60" height="18" align="middle">`;
// saveMode 'safeXml': the formula is text in the HTML
const WIRIS_SAFEXML_TEXT = `«math xmlns=¨${NS}¨»«mi»n«/mi»«mo»!«/mo»«/math»`;
// handwritten: strokes in an application/json annotation
const WIRIS_HAND = `<math xmlns="${NS}"><semantics><mi>z</mi><annotation encoding="application/json">{"x":[[1,2,3]],"y":[[4,5,6]]}</annotation></semantics></math>`;

let ed: Editor | null = null;
afterEach(() => {
  if (ed) destroyEditor(ed);
  ed = null;
});

describe('safeXmlDecode', () => {
  it('maps « » ¨ § ` back to < > " & \'', () => {
    expect(safeXmlDecode('«mo»§lt;«/mo»«mi mathvariant=¨normal¨»`«/mi»')).toBe('<mo>&lt;</mo><mi mathvariant="normal">\'</mi>');
  });
  it('also reads the entity spellings &laquo; &raquo; &uml;', () => {
    expect(safeXmlDecode('&laquo;mi&raquo;x&laquo;/mi&raquo;')).toBe('<mi>x</mi>');
  });
});

describe('Wiris content in Froala', () => {
  it('hydrates every Wiris format and saves it as plain MathML', async () => {
    ed = await createEditor();
    ed.html.set(toEditorHtml(`<p>A ${WIRIS_XML} B ${WIRIS_LATEX} C ${WIRIS_IMG} D ${WIRIS_SAFEXML_TEXT} E ${WIRIS_HAND}</p>`));
    const found = eqs(ed);
    expect(found.map((e) => e.getAttribute('data-source'))).toEqual([null, null, 'wiris-image', 'wiris-safexml', null]);
    expect(ed.el.querySelector('img')).toBeNull();
    expect(ed.el.textContent).not.toContain('«');
    await rendered(ed);
    for (const eq of found) expect(eq.shadowRoot!.querySelector('svg path')).not.toBeNull();
    // Wiris MathML has no outer <mrow>; all five tokens of y = 3 U+00A0 π are drawn
    // (MathJax used to stop at the first operator, see prepareForSvg)
    expect(found[2].shadowRoot!.querySelectorAll('svg path')).toHaveLength(5);

    const out = ed.html.get();
    const doc = new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${out}</div>`, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const maths = Array.from(doc.getElementsByTagNameNS(NS, 'math'));
    expect(maths).toHaveLength(5);
    // Unedited Wiris MathML is kept as it was
    expect(xml(out)).toContain(xml(WIRIS_XML).replace(/^<div[^>]*>|<\/div>$/g, ''));
    expect(xml(out)).toContain(xml(WIRIS_LATEX).replace(/^<div[^>]*>|<\/div>$/g, ''));
    // The image becomes its MathML; the §#160; entity becomes U+00A0
    expect(new XMLSerializer().serializeToString(maths[2])).toBe(
      `<math xmlns="${NS}"><mi>y</mi><mo>=</mo><mn>3</mn><mo> </mo><mi>π</mi></math>`
    );
    expect(new XMLSerializer().serializeToString(maths[3])).toBe(`<math xmlns="${NS}"><mi>n</mi><mo>!</mo></math>`);
    // Handwriting strokes are dropped, like the Wiris plugin does on save
    expect(new XMLSerializer().serializeToString(maths[4])).toBe(`<math xmlns="${NS}"><semantics><mi>z</mi></semantics></math>`);
  });

  it('gets LaTeX for editing from the annotation, or by converting the MathML', async () => {
    ed = await createEditor();
    ed.html.set(toEditorHtml(`<p>${WIRIS_LATEX} ${WIRIS_XML} ${WIRIS_IMG}</p>`));
    const [withLatex, palette, img] = eqs(ed).map((e) => fromPersistedMathml(e.getAttribute('data-mathml')!));
    expect(withLatex).toEqual({ latex: 'x^2', source: 'annotation' });
    expect(palette).toEqual({ latex: '\\frac{a + 1}{\\sqrt{b}}', source: 'converted' });
    expect(img.source).toBe('converted');
    expect(img.latex).toContain('\\pi');
  });

  it('leaves an image that is not a formula alone', async () => {
    ed = await createEditor();
    const html = '<p><img src="https://example.com/a.png" alt="photo" class="fr-fic fr-dii"></p>';
    ed.html.set(toEditorHtml(html));
    expect(eqs(ed)).toHaveLength(0);
    expect(ed.el.querySelector('img')).not.toBeNull();
  });
});
