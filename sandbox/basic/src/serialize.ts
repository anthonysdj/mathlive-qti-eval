// Serialisation helpers for the round-trip experiments.
//
// The persisted shape we are testing is the one QTI 3.0 can carry as-is:
//
//   <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">
//     <semantics>
//       <mrow>…presentation MathML from MathLive…</mrow>
//       <annotation encoding="application/x-tex">…LaTeX source…</annotation>
//     </semantics>
//   </math>
//
// MathLive can *produce* MathML but cannot *read* it (there is no MathML
// parser in 0.111.1, see docs/01-how-mathfield-works.md). So the LaTeX
// annotation is what makes the content editable again; the MathML is what
// QTI delivery, screen readers and print use.

import { MathMLToLaTeX } from 'mathml-to-latex';

export const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
export const TEX_ENCODINGS = ['application/x-tex', 'latex', 'tex', 'text/x-latex'];

export type Display = 'inline' | 'block';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topLevelElementCount(fragment: string): number {
  const doc = new DOMParser().parseFromString(
    `<x xmlns="${MATHML_NS}">${fragment}</x>`,
    'application/xml'
  );
  if (doc.querySelector('parsererror')) return -1;
  const root = doc.documentElement;
  const hasText = Array.from(root.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== ''
  );
  return hasText ? -1 : root.children.length;
}

/**
 * Wrap the fragment returned by `getValue('math-ml')` (which has no `<math>`
 * element) into a standalone `<math>` with the LaTeX kept as an annotation.
 */
export function toPersistedMathml(
  mathmlFragment: string,
  latex: string,
  display: Display = 'inline'
): string {
  // <semantics> takes exactly one presentation child, so wrap in <mrow>
  // unless MathLive already returned a single element.
  const body =
    topLevelElementCount(mathmlFragment) === 1
      ? mathmlFragment
      : `<mrow>${mathmlFragment}</mrow>`;
  return (
    `<math xmlns="${MATHML_NS}" display="${display}">` +
    `<semantics>${body}` +
    `<annotation encoding="application/x-tex">${escapeXml(latex)}</annotation>` +
    `</semantics></math>`
  );
}

export type Recovered = {
  latex: string;
  /** Where the LaTeX came from: our annotation, or a MathML→LaTeX conversion */
  source: 'annotation' | 'converted';
};

/**
 * Recover editable LaTeX from a persisted `<math>` element (ours, or one
 * written by another editor such as Wiris).
 */
export function fromPersistedMathml(xml: string): Recovered {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`Invalid MathML: ${err.textContent}`);

  for (const ann of Array.from(doc.getElementsByTagNameNS('*', 'annotation'))) {
    const enc = (ann.getAttribute('encoding') ?? '').toLowerCase();
    if (TEX_ENCODINGS.includes(enc))
      return { latex: ann.textContent ?? '', source: 'annotation' };
  }

  // No LaTeX annotation: fall back to converting the presentation MathML.
  // Drop <semantics>/<annotation*> wrappers first so the converter only sees
  // presentation markup.
  for (const a of Array.from(doc.getElementsByTagNameNS('*', 'annotation-xml')))
    a.remove();
  for (const a of Array.from(doc.getElementsByTagNameNS('*', 'annotation')))
    a.remove();
  const serialised = new XMLSerializer().serializeToString(doc.documentElement);
  return { latex: MathMLToLaTeX.convert(serialised), source: 'converted' };
}

/** Normalise whitespace so LaTeX strings can be compared loosely. */
export function normaliseLatex(latex: string): string {
  return latex.replace(/\s+/g, ' ').replace(/\s*([{}^_&\\])\s*/g, '$1').trim();
}
