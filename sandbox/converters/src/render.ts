// Front-end display of a stored equation: the same MathJax SVG as print
// (src/print.ts), plus the stored MathML kept in the DOM for screen readers.
//
// Stored (QTI item body):   <math>…<annotation encoding="application/x-tex">…</annotation></math>
// Displayed (built here):   <span class="eq" contenteditable="false">
//                             <svg aria-hidden="true">…</svg>      what sighted users see
//                             <math class="eq-sr">…</math>           what screen readers read
//                           </span>
// Only the <math> is ever saved; the wrapper and the SVG are rebuilt on load.

import './mathjax-browser-fonts'; // before print.ts: on-demand glyph ranges in the browser
import type { MathfieldElement } from 'mathlive';
import temml from 'temml';
import { mathmlToSvg } from './print';
import { toFieldLatex, toStandardLatex } from './pipeline';

const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/**
 * The MathML we store for what is in the field: Temml output with the LaTeX
 * annotation. `latex-expanded` has already replaced our custom macros, so
 * Temml needs none (and the stored item doesn't depend on them).
 */
export function storedMathml(mf: MathfieldElement): string {
  const latex = toStandardLatex(mf.getValue('latex-expanded'));
  return temml.renderToString(latex, { xml: true, annotate: true, throwOnError: true });
}

/** The LaTeX annotation of a stored equation, to load it back into the field for editing. */
export function latexOf(mathml: string): string {
  const doc = new DOMParser().parseFromString(mathml, 'application/xml');
  return toFieldLatex(doc.getElementsByTagNameNS(MATHML_NS, 'annotation')[0]?.textContent ?? '');
}

/** Build the element that displays a stored equation. */
export async function renderEquation(mathml: string): Promise<HTMLElement> {
  const wrapper = document.createElement('span');
  wrapper.className = 'eq';
  wrapper.contentEditable = 'false'; // one unit inside a rich-text editor

  const svgDoc = new DOMParser().parseFromString(await mathmlToSvg(mathml), 'image/svg+xml');
  const svg = document.importNode(svgDoc.documentElement, true);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.removeAttribute('role');

  const math = document.importNode(new DOMParser().parseFromString(mathml, 'application/xml').documentElement, true);
  math.setAttribute('class', 'eq-sr');

  wrapper.append(svg, math);
  return wrapper;
}

/** Visually hide the screen-reader MathML without removing it from the accessibility tree. */
export const EQ_CSS = `
.eq { display: inline-block; cursor: pointer; }
.eq-sr { position: absolute !important; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
`;

/**
 * What gets saved for a document that contains rendered equations: each
 * wrapper becomes its <math>. Serialised as XML, not innerHTML: the HTML
 * serialiser writes `&nbsp;` (from `\ `, `~`, `\text{a b}`), which is not
 * defined in XML and would break a QTI item body.
 */
export function toStoredHtml(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement;
  for (const eq of Array.from(copy.querySelectorAll('.eq'))) {
    const math = eq.querySelector('.eq-sr')!;
    math.removeAttribute('class');
    eq.replaceWith(math);
  }
  const xml = new XMLSerializer();
  return Array.from(copy.childNodes, (n) => xml.serializeToString(n)).join('');
}
