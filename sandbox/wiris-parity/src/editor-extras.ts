// MathType behaviours MathLive and our Froala plugin don't have yet:
//
// 1. Copying a formula as MathML. MathLive's copy puts LaTeX (text/plain,
//    application/x-latex) and its own JSON on the clipboard, no MathML.
//    MathType copies MathML, which Word and other editors paste as a
//    formula. A listener after MathLive's adds the stored MathML as
//    text/html (browsers only pass text/plain, text/html and images to the
//    system clipboard, so application/mathml+xml would not leave the page).
// 2. Pasting MathML into the formula editor. MathType's editor accepts
//    MathML on the clipboard; MathLive only reads LaTeX (and its own JSON), so
//    pasted MathML arrives as text. A capture listener on the field converts
//    it first, with the same importer used for stored MathType content.
// 3. LaTeX written in the text between $$…$$ (MathType's "LaTeX parse" mode in
//    its Froala plugin turns it into formulas). Done here as a pass over the
//    content before hydrate() (sandbox/froala/src/math-html.ts).

import type { MathfieldElement } from 'mathlive';
import temml from 'temml';
import { importMathml } from './wiris-import';
import { toStorageLatex } from './compat';

/** Add the formula's MathML to what MathLive copies. Returns a function that removes the listener. */
export function enableMathmlCopy(mf: MathfieldElement): () => void {
  const onCopy = (ev: ClipboardEvent) => {
    const latex = ev.clipboardData?.getData('application/x-latex');
    if (!latex) return;
    try {
      const mathml = temml.renderToString(toStorageLatex(latex), { xml: true, annotate: true, throwOnError: true });
      ev.clipboardData!.setData('text/html', mathml);
      ev.clipboardData!.setData('application/mathml+xml', mathml); // for paste within the page
    } catch {
      // LaTeX Temml rejects: the clipboard keeps MathLive's LaTeX
    }
  };
  // MathLive handles copy on its keyboard sink inside the shadow root; this
  // runs after it, as the composed event bubbles to the host.
  mf.addEventListener('copy', onCopy);
  return () => mf.removeEventListener('copy', onCopy);
}

const MATHML_TYPES = ['application/mathml+xml', 'application/mathml-presentation+xml', 'text/plain', 'text/html'];

/** Let MathML pasted into `mf` become a formula. Returns a function that removes the listener. */
export function enableMathmlPaste(mf: MathfieldElement): () => void {
  const onPaste = (ev: ClipboardEvent) => {
    const data = ev.clipboardData;
    if (!data) return;
    for (const type of MATHML_TYPES) {
      const text = data.getData(type).trim();
      const m = /<math\b[\s\S]*<\/math>/.exec(text);
      if (!m) continue;
      let xml = m[0];
      // MathML copied from a web page often has no namespace
      if (!/xmlns=/.test(xml)) xml = xml.replace(/^<math\b/, '<math xmlns="http://www.w3.org/1998/Math/MathML"');
      try {
        const { latex } = importMathml(xml);
        ev.preventDefault();
        ev.stopImmediatePropagation(); // MathLive's own handler would insert the text
        mf.insert(latex, { format: 'latex', selectionMode: 'after' });
        return;
      } catch {
        // not well-formed: let MathLive have it
      }
    }
  };
  mf.addEventListener('paste', onPaste, { capture: true });
  return () => mf.removeEventListener('paste', onPaste, { capture: true });
}

const LATEX_IN_TEXT = /\$\$([\s\S]+?)\$\$/g;

/**
 * Replace every $$…$$ in the text under `root` with the stored MathML for it
 * (Temml, with the LaTeX annotation). LaTeX that Temml rejects stays as text.
 * Text inside <code>, <pre> and existing <math> is left alone.
 */
export function parseLatexInText(root: ParentNode & Node): number {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('code, pre, math, math-eq') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const texts: Text[] = [];
  for (let t = walker.nextNode(); t; t = walker.nextNode()) if (t.nodeValue!.includes('$$')) texts.push(t as Text);
  let n = 0;
  for (const text of texts) {
    const parts: (string | Node)[] = [];
    let last = 0;
    for (const m of text.nodeValue!.matchAll(LATEX_IN_TEXT)) {
      let mathml: string;
      try {
        mathml = temml.renderToString(toStorageLatex(m[1].trim()), { xml: true, annotate: true, throwOnError: true });
      } catch {
        continue;
      }
      const tpl = doc.createElement('template');
      tpl.innerHTML = mathml;
      parts.push(text.nodeValue!.slice(last, m.index), tpl.content.firstElementChild!);
      last = m.index! + m[0].length;
      n++;
    }
    if (parts.length) text.replaceWith(...parts, text.nodeValue!.slice(last));
  }
  return n;
}
