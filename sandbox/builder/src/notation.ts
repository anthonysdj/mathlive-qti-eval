// Custom macros and inline shortcuts for frequently used notation.
//
// Both only change how LaTeX gets *into* the field. What is stored is the
// field's `latex-expanded` output converted by Temml, so the stored MathML
// (and its LaTeX annotation) never contains our macros.
//
// Macros are zero-argument only. A macro with arguments is one atom in
// MathLive: typing into its slot works, but `getValue('latex')` keeps the
// empty slot (`\abs{\placeholder{}}` while `latex-expanded` has the typed
// `\left|x-1\right|`), and the spoken text is the macro's name ("abs").
// Templates with arguments are inline shortcuts instead, which insert plain
// LaTeX (tests/notation.test.ts).

import type { InlineShortcutDefinitions } from 'mathlive';

export const MACROS: Record<string, string> = {
  // Number sets, as authors write them in LaTeX
  R: '\\mathbb{R}',
  N: '\\mathbb{N}',
  Z: '\\mathbb{Z}',
  Q: '\\mathbb{Q}',
  C: '\\mathbb{C}',
  // Units: \degC, \ohm
  degC: '{}^{\\circ}\\mathrm{C}',
  ohm: '\\Omega',
};

/**
 * Typed sequences that become notation. MathLive already has ~260 (sqrt,
 * int, sum, lim, alpha…, <=, !=, ->, xx for ×, deg after a digit); these add
 * the ones its defaults lack for school maths and science.
 */
export const SHORTCUTS: InlineShortcutDefinitions = {
  abs: '\\left|#?\\right|',
  cbrt: '\\sqrt[3]{#?}',
  nroot: '\\sqrt[#?]{#?}',
  vec: '\\vec{#?}',
  hat: '\\hat{#?}',
  degC: { after: 'digit+space', value: '\\,{}^{\\circ}\\mathrm{C}' },
  ohm: '\\Omega',
  '=>': '\\Rightarrow',
  '<=>': '\\Leftrightarrow',
  '~~': '\\approx',
  perp: '\\perp',
  para: '\\parallel',
  ang: '\\angle',
  mat2: '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}',
};

/** The value a shortcut definition inserts */
export function shortcutValue(def: InlineShortcutDefinitions[string]): string {
  return typeof def === 'string' ? def : def.value;
}
