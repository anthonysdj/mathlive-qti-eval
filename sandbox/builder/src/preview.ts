// The live preview: what is in the field, side by side in the three forms
// that matter. LaTeX is what the author would type; MathML is exactly what
// gets stored (the same storedMathml() the dialog saves with); spoken is
// MathLive's speech for the field, as a check on reading order.

import type { MathfieldElement } from 'mathlive';
import { storedMathml } from '@sandbox/converters/src/render';

export interface Preview {
  latex: string;
  /** Stored MathML, or null when Temml refuses the LaTeX (see `error`) */
  mathml: string | null;
  error: string | null;
  spoken: string;
}

export function previewOf(field: MathfieldElement): Preview {
  let mathml: string | null = null;
  let error: string | null = null;
  try {
    mathml = field.getValue('latex').trim() ? storedMathml(field) : '';
  } catch (e) {
    error = (e as Error).message;
  }
  return { latex: field.getValue('latex'), mathml, error, spoken: field.getValue('spoken-text').trim() };
}

/** Indent MathML for reading: one element per line, text kept inline */
export function prettyMathml(mathml: string): string {
  const root = new DOMParser().parseFromString(mathml, 'application/xml').documentElement;
  const xml = new XMLSerializer();
  const lines: string[] = [];
  const walk = (el: Element, depth: number) => {
    const pad = '  '.repeat(depth);
    const attrs = Array.from(el.attributes, (a) => ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    const kids = Array.from(el.children);
    if (!kids.length) {
      const text = Array.from(el.childNodes, (n) => xml.serializeToString(n)).join('');
      lines.push(text ? `${pad}<${el.localName}${attrs}>${text}</${el.localName}>` : `${pad}<${el.localName}${attrs}/>`);
      return;
    }
    lines.push(`${pad}<${el.localName}${attrs}>`);
    for (const k of kids) walk(k, depth + 1);
    lines.push(`${pad}</${el.localName}>`);
  };
  walk(root, 0);
  return lines.join('\n');
}
