// The few MathType notations that MathLive and Temml both have, but under
// different names. MathLive writes \enclose{longdiv}{…} and
// \enclose{circle}{…}; Temml has no \enclose but has \longdiv{…} and
// \textcircled{…}, which give the same <menclose> MathML. So the stored LaTeX
// annotation uses Temml's names, and loading it back into the field maps them
// to MathLive's.
//
// This extends toStandardLatex() (sandbox/converters/src/pipeline.ts), which
// left \enclose unmapped. It lives here until the pipeline adopts it.

import { toStandardLatex } from '@sandbox/converters/src/pipeline';

/** Index just past the {…} group that starts at `i` (which must be '{'), or -1 */
function groupEnd(s: string, i: number): number {
  if (s[i] !== '{') return -1;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') j++;
    else if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return j + 1;
  }
  return -1;
}

/** Replace `\cmd{a}…{z}` (with `args` groups, optional [..] after the first ignored) using `fn` */
function replaceCommand(s: string, cmd: string, args: number, fn: (groups: string[]) => string | null): string {
  let out = '';
  let i = 0;
  for (;;) {
    const at = s.indexOf(cmd, i);
    if (at < 0) return out + s.slice(i);
    const after = at + cmd.length;
    if (/[a-zA-Z]/.test(s[after] ?? '')) {
      out += s.slice(i, after);
      i = after;
      continue;
    }
    let j = after;
    const groups: string[] = [];
    for (let g = 0; g < args; g++) {
      while (s[j] === ' ') j++;
      if (g === 1 && s[j] === '[') j = s.indexOf(']', j) + 1; // \enclose{…}[style]{…}
      while (s[j] === ' ') j++;
      const end = groupEnd(s, j);
      if (end < 0) break;
      groups.push(s.slice(j + 1, end - 1));
      j = end;
    }
    const rep = groups.length === args ? fn(groups) : null;
    if (rep === null) {
      out += s.slice(i, after);
      i = after;
    } else {
      out += s.slice(i, at) + rep;
      i = j;
    }
  }
}

/** MathLive LaTeX → LaTeX Temml accepts (for storage and the annotation) */
export function toStorageLatex(latex: string): string {
  const s = replaceCommand(toStandardLatex(latex), '\\enclose', 2, ([notation, body]) => {
    const n = notation.trim();
    if (n === 'longdiv') return `\\longdiv{${body}}`;
    if (n === 'circle') return `\\textcircled{${body}}`;
    if (n === 'roundedbox' || n === 'box') return `\\boxed{${body}}`;
    return null;
  });
  // MathLive accepts \overarc, Temml doesn't; \wideparen is the same arc in both
  return s.replace(/\\overarc(?![a-zA-Z])/g, '\\wideparen');
}

/** Stored LaTeX annotation → LaTeX for the field */
export function toFieldLatex(latex: string): string {
  let s = replaceCommand(latex, '\\longdiv', 1, ([body]) => `\\enclose{longdiv}{${body}}`);
  s = replaceCommand(s, '\\textcircled', 1, ([body]) => `\\enclose{circle}{${body}}`);
  return s;
}
