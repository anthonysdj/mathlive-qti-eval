import type { MathfieldElement } from 'mathlive';
import { fromPersistedMathml, toPersistedMathml } from './serialize';

export type ProbeResult = {
  input: string;
  latex: string;
  errors: string[];
  mathml: string;
  mathmlWellFormed: boolean;
  spoken: string;
  ascii: string;
  /** LaTeX stable when fed back into the field */
  latexStable: boolean;
  /** LaTeX recovered from our persisted <annotation> */
  annotationRoundTrip: boolean;
  /** MathML → LaTeX (mathml-to-latex) → MathLive, as for annotation-less (e.g. Wiris) content */
  viaMathml: { latex: string; mathml: string; sameMathml: boolean } | { error: string };
};

export function isWellFormedXml(fragment: string): boolean {
  const doc = new DOMParser().parseFromString(
    `<math xmlns="http://www.w3.org/1998/Math/MathML">${fragment}</math>`,
    'application/xml'
  );
  return !doc.querySelector('parsererror');
}

export function probe(mf: MathfieldElement, input: string): ProbeResult {
  mf.setValue(input, { silenceNotifications: true });
  const latex = mf.getValue('latex');
  const errors = mf.errors.map((e) => `${e.code}${e.arg ? ' ' + e.arg : ''}`);
  const mathml = mf.getValue('math-ml');
  const spoken = mf.getValue('spoken-text');
  const ascii = mf.getValue('ascii-math');

  mf.setValue(latex, { silenceNotifications: true });
  const latexStable = mf.getValue('latex') === latex;

  const mathmlWellFormed = isWellFormedXml(mathml);
  let annotationRoundTrip = false;
  let viaMathml: ProbeResult['viaMathml'];
  try {
    const persisted = toPersistedMathml(mathml, latex);
    annotationRoundTrip = fromPersistedMathml(persisted).latex === latex;
    const bare = persisted.replace(/<annotation[\s\S]*<\/annotation>/, '');
    const back = fromPersistedMathml(bare).latex;
    mf.setValue(back, { silenceNotifications: true });
    const mathml2 = mf.getValue('math-ml');
    viaMathml = { latex: back, mathml: mathml2, sameMathml: mathml2 === mathml };
  } catch (e) {
    viaMathml = { error: (e as Error).message.split('\n')[0] };
  }
  return { input, latex, errors, mathml, mathmlWellFormed, spoken, ascii, latexStable, annotationRoundTrip, viaMathml };
}
