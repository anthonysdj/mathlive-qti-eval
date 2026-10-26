// Stored HTML (database, QTI item body) <-> editor HTML (inside Froala).
//
// Stored:  <p>Solve <math xmlns="…MathML"><semantics>…<annotation encoding="application/x-tex">…</annotation></semantics></math>.</p>
// Editor:  <p>Solve <math-eq data-mathml="&lt;math …" contenteditable="false" class="fr-deletable"></math-eq>.</p>
//
// In the editor each equation is one empty element that carries its MathML in
// an attribute, so Froala's cleaning, space normalising and undo never touch
// the MathML itself, and the SVG it shows lives in the element's shadow root
// (math-eq-element.ts), out of the editor's HTML. Saving puts the <math> back.

import { EQ_TAG } from './mathml-allowlist';
import { SAFE_XML_FORMULA, isWirisImage, safeXmlDecode, wirisImageMathml } from './wiris';

/** Where an equation in the editor came from (kept on the element as data-source) */
export type EqSource = 'mathml' | 'wiris-image' | 'wiris-safexml';

/** Parse MathML leniently: the HTML parser accepts named entities (&nbsp;, &InvisibleTimes;) that XML rejects. */
function parseMath(markup: string, doc: Document): Element | null {
  const t = doc.createElement('template');
  t.innerHTML = markup;
  return t.content.querySelector('math');
}

/**
 * The stored form of one equation: well-formed XML in the MathML namespace.
 * Wiris's handwriting strokes (annotation encoding="application/json") are
 * dropped, as the Wiris plugin itself does on save unless saveHandTraces is on.
 */
export function canonicalMathml(math: Element): string {
  const copy = math.cloneNode(true) as Element;
  for (const a of Array.from(copy.querySelectorAll('annotation[encoding="application/json"]'))) a.remove();
  return new XMLSerializer().serializeToString(copy);
}

export function createEq(doc: Document, mathml: string, source: EqSource = 'mathml'): HTMLElement {
  const eq = doc.createElement(EQ_TAG);
  eq.setAttribute('data-mathml', mathml);
  if (source !== 'mathml') eq.setAttribute('data-source', source);
  eq.setAttribute('contenteditable', 'false'); // one unit for the caret
  eq.className = 'fr-deletable'; // Froala's Backspace/Delete removes it whole
  return eq;
}

/**
 * Turn every equation under `root` into a <math-eq>: plain <math> (ours, or
 * Wiris `xml` save mode), Wiris formula images, and Wiris `safeXml` text.
 * Returns how many were converted.
 */
export function hydrate(root: ParentNode & Node): number {
  const doc = root.ownerDocument ?? (root as Document);
  let n = 0;
  for (const math of Array.from(root.querySelectorAll('math'))) {
    if (math.closest(EQ_TAG)) continue;
    math.replaceWith(createEq(doc, canonicalMathml(math)));
    n++;
  }
  for (const img of Array.from(root.querySelectorAll('img'))) {
    if (!isWirisImage(img)) continue;
    const math = parseMath(wirisImageMathml(img) ?? '', doc);
    if (!math) continue; // not a formula after all: leave the image alone
    img.replaceWith(createEq(doc, canonicalMathml(math), 'wiris-image'));
    n++;
  }
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let t = walker.nextNode(); t; t = walker.nextNode()) if (t.nodeValue!.includes('«math')) texts.push(t as Text);
  for (const text of texts) {
    const parts: (string | Node)[] = [];
    let last = 0;
    for (const m of text.nodeValue!.matchAll(SAFE_XML_FORMULA)) {
      const math = parseMath(safeXmlDecode(m[0]), doc);
      if (!math) continue;
      parts.push(text.nodeValue!.slice(last, m.index), createEq(doc, canonicalMathml(math), 'wiris-safexml'));
      last = m.index! + m[0].length;
      n++;
    }
    if (parts.length) text.replaceWith(...parts, text.nodeValue!.slice(last));
  }
  return n;
}

/**
 * Stored HTML → editor HTML, before Froala sees it. Passing stored HTML
 * straight to html.set() works too (the plugin hydrates it afterwards), but
 * Froala first runs its own cleaning over the MathML text, which collapses
 * runs of spaces, e.g. inside a LaTeX annotation. Converting first means
 * Froala only ever sees the attribute.
 */
export function toEditorHtml(storedHtml: string, doc: Document = document): string {
  const t = doc.createElement('template');
  t.innerHTML = storedHtml;
  hydrate(t.content);
  return t.innerHTML;
}

/**
 * The stored form of editor HTML (what Froala's html.get() returns once the
 * plugin is loaded): each <math-eq> becomes its <math>, and the whole thing is
 * serialised as XML. The browser's HTML serialiser writes `&nbsp;` (Froala
 * puts one after most inserts) and `<br>`, neither of which is valid in a
 * QTI item body; the XML serialiser writes U+00A0 and `<br />` instead, and
 * the result still parses the same as HTML.
 */
export function toStoredHtml(editorHtml: string, doc: Document = document): string {
  const body = doc.implementation.createHTMLDocument('').body;
  body.innerHTML = editorHtml;
  for (const eq of Array.from(body.querySelectorAll(EQ_TAG))) {
    const math = new DOMParser().parseFromString(eq.getAttribute('data-mathml') ?? '', 'application/xml').documentElement;
    // Chromium reports XML errors as a <parsererror> inside the partial result
    if (math.localName !== 'math' || math.getElementsByTagName('parsererror').length) {
      eq.remove(); // never store a broken equation as if it were one
      continue;
    }
    eq.replaceWith(body.ownerDocument.importNode(math, true));
  }
  // Serialising <body> rather than each child keeps the XHTML namespace
  // declaration on the wrapper only, which is then cut off.
  const xml = new XMLSerializer().serializeToString(body);
  return xml.replace(/^<body[^>]*>/, '').replace(/<\/body>$|^<body[^>]*\/>$/, '');
}
