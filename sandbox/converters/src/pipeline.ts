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
 * Built-in MathLive macros such as `\differentialD` are already expanded by
 * `latex-expanded`. Other MathLive-only commands (`\enclose`, `\bbox`,
 * `\displaylines`, `\unicode` …) are not mapped: the equation builder's
 * allow-list should keep them out of authored content.
 */
export function toStandardLatex(latex: string): string {
  return latex
    .replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, (_m, body: string) =>
      body.trim() ? `{${body}}` : '\\square'
    )
    .replace(/\\m(left|right)(?![a-zA-Z])/g, '\\$1')
    .replace(/\\doubleprime(?![a-zA-Z])/g, '\\prime\\prime')
    .replace(/\\tripleprime(?![a-zA-Z])/g, '\\prime\\prime\\prime');
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
