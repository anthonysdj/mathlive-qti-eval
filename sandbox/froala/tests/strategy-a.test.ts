// Evidence for the (a) vs (b) decision: the same content held as inline
// <math-field read-only> elements (strategy a) instead of <math-eq> (b).
// Writes findings/froala-strategies.json. Run on its own:
//   VITE_PROBE=1 pnpm exec vitest run tests/strategy-a.test.ts
import { describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import FroalaEditor from 'froala-editor';
import { MathfieldElement } from 'mathlive';
import { cases } from '@sandbox/converters/src/cases';
import { toEditorHtml, withMathOptions } from '../src';
import { createEditor, destroyEditor, eqs, stored, tick } from './helpers';

const N = 100; // equations on one page (a long item or a worksheet)
const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const latexes = Array.from({ length: N }, (_, i) => cases[i % cases.length].latex);
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// (a): what the editor would hold
const aHtml = latexes.map((l) => `<p>Q: <math-field read-only class="fr-deletable" contenteditable="false">${escape(l)}</math-field> end</p>`).join('');

async function measureB() {
  const stores = await Promise.all(latexes.map(stored));
  const html = toEditorHtml(stores.map((m) => `<p>Q: ${m} end</p>`).join(''));
  const ed = await createEditor();
  const t0 = performance.now();
  ed.html.set(html);
  await Promise.all(eqs(ed).map((e) => e.ready));
  await frames();
  const load = performance.now() - t0;
  ed.undo.reset();
  ed.undo.saveStep();
  ed.el.querySelector('p')!.append(' x');
  ed.undo.saveStep();
  const t1 = performance.now();
  ed.commands.undo();
  await Promise.all(eqs(ed).map((e) => e.ready));
  await frames();
  const undo = performance.now() - t1;
  const snapshotBytes = ed.el.innerHTML.length;
  destroyEditor(ed);
  return { loadMs: Math.round(load), undoMs: Math.round(undo), snapshotBytes };
}

async function measureA() {
  const ed = await createEditor(withMathOptions({}, FroalaEditor.DEFAULTS));
  ed.opts.htmlAllowedTags.push('math-field');
  ed.opts.htmlAllowedAttrs.push('read-only');
  ed.opts.htmlAllowedEmptyTags.push('math-field');
  const t0 = performance.now();
  ed.html.set(aHtml);
  await frames();
  const load = performance.now() - t0;
  const fields = Array.from(ed.el.querySelectorAll('math-field')) as MathfieldElement[];
  const mounted = fields.filter((f) => f.shadowRoot?.querySelector('.ML__latex')).length;
  ed.undo.reset();
  ed.undo.saveStep();
  ed.el.querySelector('p')!.append(' x');
  ed.undo.saveStep();
  const t1 = performance.now();
  ed.commands.undo();
  await frames();
  const undo = performance.now() - t1;
  const first = ed.el.querySelector('math-field') as MathfieldElement;
  const out = {
    loadMs: Math.round(load),
    undoMs: Math.round(undo),
    mounted,
    snapshotBytes: ed.el.innerHTML.length,
    // MathLive sets contenteditable="true" on the host (an NVDA workaround),
    // overriding the island's "false"
    hostContentEditable: first.getAttribute('contenteditable'),
    hostTabIndex: first.tabIndex,
    // What Froala's html.get() gives without extra code: LaTeX, not MathML
    htmlGet: ed.html.get().slice(0, 160),
  };
  // Can the caret step over it, and does Backspace remove it?
  const p = ed.el.querySelector('p')!;
  ed.events.focus();
  const r = document.createRange();
  r.setStartAfter(first);
  r.collapse(true);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(r);
  await userEvent.keyboard('{ArrowLeft}');
  const sel = getSelection()!;
  (out as any).arrowLeftLandsIn = first.contains(sel.anchorNode) || document.activeElement === first ? 'the math-field' : 'the text';
  (out as any).activeAfterArrow = document.activeElement?.tagName.toLowerCase();
  caretAfter(first);
  await userEvent.keyboard('{Backspace}');
  await tick(50);
  (out as any).backspaceRemoves = !p.contains(first);
  destroyEditor(ed);
  return out;

  function caretAfter(n: Node) {
    ed.events.focus();
    const rr = document.createRange();
    rr.setStartAfter(n);
    rr.collapse(true);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(rr);
  }
}

describe.skipIf(!import.meta.env.VITE_PROBE)('strategy (a) vs (b), measured', () => {
  it(`${N} equations in one editor`, async () => {
    // First run: fonts load, and (b) renders each distinct equation once.
    // Second run: what undo/redo and reopening the same item cost.
    const bCold = await measureB();
    const bWarm = await measureB();
    const aCold = await measureA();
    const a = await measureA();
    const result = {
      equations: N,
      distinct: new Set(latexes).size,
      a: { ...a, coldLoadMs: aCold.loadMs },
      b: { coldLoadMs: bCold.loadMs, ...bWarm },
    };
    await commands.writeFile('../../findings/froala-strategies.json', JSON.stringify(result, null, 2) + '\n');
    expect(a.mounted).toBe(N);
  }, 120_000);
});
