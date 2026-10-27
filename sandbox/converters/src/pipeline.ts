import type { MathfieldElement } from 'mathlive';
import type { Converter, Result } from './converters';

/**
 * Map the few MathLive-only commands to standard LaTeX before handing the
 * content to an external converter.
 * - `\placeholder[id]{x}` / `\placeholder{}` (template slots, answer blanks)
 *   become their content, or `\square` when empty.
 * - `\mleft` / `\mright` (from the mleftright package; MathLive parses them and they can
 *   arrive in pasted or loaded LaTeX) become `\left` / `\right`.
 * - `\doubleprime` / `\tripleprime`, which MathLive writes for a typed `y''`
 *   (`y^{\doubleprime}`) and Temml doesn't know, become repeated `\prime`.
 * - `\enclose{longdiv}{…}` and `\enclose{circle}{…}` (MathLive's long
 *   division and circle; `latex-expanded` adds the default style in brackets)
 *   become Temml's `\longdiv{…}` and `\textcircled{…}`, which give the same
 *   `<menclose>`; `\enclose{box|roundedbox}` becomes `\boxed`. `\overarc`
 *   becomes `\wideparen`, the same arc. `toFieldLatex()` maps the first two
 *   back when a stored equation is loaded into the field.
 * Built-in MathLive macros such as `\differentialD` are already expanded by
 * `latex-expanded`. Other MathLive-only commands (other `\enclose` notations,
 * `\bbox`, `\displaylines`, `\unicode` …) are not mapped: the equation
 * builder's allow-list should keep them out of authored content.
 */
export function toStandardLatex(latex: string): string {
  const s = latex
    .replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, (_m, body: string) =>
      body.trim() ? `{${body}}` : '\\square'
    )
    .replace(/\\m(left|right)(?![a-zA-Z])/g, '\\$1')
    .replace(/\\doubleprime(?![a-zA-Z])/g, '\\prime\\prime')
    .replace(/\\tripleprime(?![a-zA-Z])/g, '\\prime\\prime\\prime')
    .replace(/\\overarc(?![a-zA-Z])/g, '\\wideparen');
  return replaceCommand(s, '\\enclose', 2, ([notation, body]) => {
    const n = notation.trim();
    if (n === 'longdiv') return `\\longdiv{${body}}`;
    if (n === 'circle') return `\\textcircled{${body}}`;
    if (n === 'box' || n === 'roundedbox') return `\\boxed{${body}}`;
    return null;
  });
}

/** Stored LaTeX annotation → LaTeX for the field: Temml's long division and circle back to MathLive's */
export function toFieldLatex(latex: string): string {
  const s = replaceCommand(latex, '\\longdiv', 1, ([body]) => `\\enclose{longdiv}{${body}}`);
  return replaceCommand(s, '\\textcircled', 1, ([body]) => `\\enclose{circle}{${body}}`);
}

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

/**
 * Replace each `\cmd{a}…{z}` (`args` groups; an optional `[…]` after the
 * first is skipped, as in `\enclose{longdiv}[style]{…}`) with what `fn`
 * returns, or leave it when `fn` returns null.
 */
function replaceCommand(s: string, cmd: string, args: number, fn: (groups: string[]) => string | null): string {
  let out = '';
  let i = 0;
  for (;;) {
    const at = s.indexOf(cmd, i);
    if (at < 0) return out + s.slice(i);
    const after = at + cmd.length;
    let j = after;
    const groups: string[] = [];
    if (!/[a-zA-Z]/.test(s[after] ?? '')) {
      for (let g = 0; g < args; g++) {
        while (s[j] === ' ') j++;
        if (g === 1 && s[j] === '[') j = s.indexOf(']', j) + 1;
        while (s[j] === ' ') j++;
        const end = groupEnd(s, j);
        if (end < 0) break;
        groups.push(s.slice(j + 1, end - 1));
        j = end;
      }
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

/**
 * The storage pipeline being evaluated: the field gives macro-expanded LaTeX
 * (so stored MathML never depends on our macro definitions), MathLive-only
 * commands are mapped to standard LaTeX, then the converter makes MathML.
 */
export function storageMathml(mf: MathfieldElement, latex: string, converter: Converter): Result & { input: string } {
  mf.setValue(latex);
  const expanded = mf.getValue('latex-expanded');
  const input = converter.name.startsWith('MathLive') ? expanded : toStandardLatex(expanded);
  return { ...converter.convert(input), input };
}
