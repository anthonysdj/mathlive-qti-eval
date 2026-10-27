// Runs one formula through every step of our pipeline and reports what each
// step did. This is what decides "reproduced" for a MathType feature: the
// author can build it in <math-field>, we can store it as MathML, we can draw
// it for print, and MathLive can speak it.

import '@sandbox/converters/src/mathjax-browser-fonts';
import { convertLatexToMarkup, validateLatex, type MathfieldElement } from 'mathlive';
import { mathmlToSvg } from '@sandbox/converters/src/print';
import { toStorageLatex } from './compat';
import { temmlConverter } from '@sandbox/converters/src/converters';
import { check } from '@sandbox/converters/src/check';
import type { Stage } from './features';

export type StageResult = { ok: boolean; detail?: string };
export type RunResult = { stages: Record<Stage, StageResult>; mathml?: string; spokenText: string; svgPaths: number };

/** The formula drawn by MathJax from a <math> string; fails on MathJax errors or an empty drawing. */
export async function svgOf(mathml: string): Promise<StageResult & { paths: number }> {
  try {
    const svg = await mathmlToSvg(mathml);
    const paths = (svg.match(/<path\b/g) ?? []).length;
    if (/data-mjx-error|merror/.test(svg)) return { ok: false, detail: 'MathJax error', paths };
    if (!paths) return { ok: false, detail: 'nothing drawn', paths };
    return { ok: true, paths };
  } catch (e) {
    return { ok: false, detail: String(e).slice(0, 200), paths: 0 };
  }
}

export async function run(mf: MathfieldElement, latex: string): Promise<RunResult> {
  // 1. MathLive: parses without errors, renders without error boxes, and the
  //    field gives the formula back.
  const errors = validateLatex(latex).map((e) => `${e.code}${e.arg ? ' ' + e.arg : ''}`);
  const markupError = convertLatexToMarkup(latex).includes('ML__error');
  mf.setValue(latex);
  const back = mf.getValue('latex');
  const mathlive: StageResult =
    errors.length || markupError || !back
      ? { ok: false, detail: errors.join(', ') || (markupError ? 'error box in the rendering' : 'empty value') }
      : { ok: true };

  // 2. Spoken text, MathLive's own rules
  const spoken = mf.getValue('spoken').trim();
  const spokenStage: StageResult = spoken ? { ok: true } : { ok: false, detail: 'no spoken text' };

  // 3. Storage: the same path as the Froala dialog (latex-expanded → standard LaTeX → Temml),
  //    plus the \enclose and \overarc mappings in compat.ts
  const input = toStorageLatex(mf.getValue('latex-expanded'));
  const r = temmlConverter.convert(input);
  let temml: StageResult;
  if (r.error !== undefined) temml = { ok: false, detail: r.error.slice(0, 200) };
  else {
    const c = check(r.mathml, latex);
    temml = c.wellFormed && !c.merror && !c.empty && !c.problems.length
      ? { ok: true }
      : { ok: false, detail: [...c.problems, c.merror ? 'merror' : '', c.empty ? 'empty' : ''].filter(Boolean).join(', ') };
  }

  // 4. Print: MathJax SVG from the stored MathML
  const svg = r.mathml ? await svgOf(r.mathml) : { ok: false, detail: 'no MathML', paths: 0 };

  return {
    stages: { mathlive, temml, svg: { ok: svg.ok, detail: svg.detail }, spoken: spokenStage },
    mathml: r.mathml,
    spokenText: spoken,
    svgPaths: svg.paths,
  };
}
