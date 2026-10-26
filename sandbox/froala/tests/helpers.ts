import FroalaEditor from 'froala-editor';
import 'froala-editor/css/froala_editor.pkgd.min.css';
import 'mathlive/fonts.css';
import { MathfieldElement } from 'mathlive';
import { storedMathml } from '@sandbox/converters/src/render';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';
import { MACROS } from '@sandbox/converters/src/cases';
import { registerMathPlugin, COMMAND, type MathEquationApi } from '../src';
import type { MathEqElement } from '../src/math-eq-element';

registerMathPlugin(FroalaEditor);

export type Editor = InstanceType<typeof FroalaEditor> & { mathEquation: MathEquationApi } & Record<string, any>;

/** A Froala editor in a fresh element, resolved once 'initialized' has fired. */
export function createEditor(opts: Record<string, unknown> = {}, initialHtml = ''): Promise<Editor> {
  const el = document.createElement('div');
  el.innerHTML = initialHtml;
  document.body.append(el);
  return new Promise((resolve) => {
    const ed: Editor = new (FroalaEditor as any)(el, {
      toolbarButtons: ['bold', 'italic', COMMAND, 'undo', 'redo'],
      ...opts,
      events: { initialized: () => resolve(ed) },
    });
  });
}

export function destroyEditor(ed: Editor) {
  const el = ed.$oel?.get(0) as HTMLElement | undefined;
  ed.destroy();
  el?.remove();
}

let mf: MathfieldElement | null = null;
/** The stored MathML for a LaTeX string, made exactly as the dialog makes it. */
export async function stored(latex: string): Promise<string> {
  await loadTemmlMhchem();
  if (!mf) {
    mf = new MathfieldElement();
    mf.style.position = 'absolute';
    mf.style.left = '-9999px';
    document.body.append(mf);
    mf.macros = { ...mf.macros, ...MACROS };
  }
  mf.setValue(latex);
  return storedMathml(mf);
}

export const eqs = (ed: Editor) => Array.from(ed.el.querySelectorAll('math-eq')) as MathEqElement[];

/** Wait until every equation in the editor is drawn. */
export async function rendered(ed: Editor) {
  await Promise.all(eqs(ed).map((e) => e.ready));
}

/** Parse stored HTML as XML (it must be well-formed for a QTI item body). */
export function parseStored(html: string): Document {
  return new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`, 'application/xml');
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
