// Demo: MathLive for editing, Temml MathML for storage, MathJax SVG for display
// (the same SVG as print). See src/render.ts.
import 'mathlive/fonts.css';
import { MathfieldElement } from 'mathlive';
import { loadTemmlMhchem } from '../src/temml-mhchem';
import { EQ_CSS, latexOf, renderEquation, storedMathml, toStoredHtml } from '../src/render';

MathfieldElement.soundsDirectory = null;
await loadTemmlMhchem();

const style = document.createElement('style');
style.textContent = EQ_CSS;
document.head.append(style);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const mf = $<MathfieldElement>('mf');
const docEl = $('doc');
const status = $('status');
let editing: HTMLElement | null = null; // equation being edited, if any
let lastRange: Range | null = null; // caret in the text, so Insert goes where the author was

document.addEventListener('selectionchange', () => {
  const sel = getSelection();
  if (sel?.rangeCount && docEl.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
});

function showStored() {
  $('stored').textContent = toStoredHtml(docEl);
}

$('insert').addEventListener('click', async () => {
  let mathml: string;
  try {
    mathml = storedMathml(mf);
  } catch (e) {
    status.textContent = `Not inserted: ${(e as Error).message}`;
    status.className = 'bad';
    return;
  }
  const t0 = performance.now();
  const eq = await renderEquation(mathml);
  status.textContent = `Rendered in ${(performance.now() - t0).toFixed(1)} ms`;
  status.className = '';

  if (editing) {
    editing.replaceWith(eq);
    editing = null;
    $('insert').textContent = 'Insert';
  } else if (lastRange) {
    lastRange.collapse(false);
    lastRange.insertNode(eq);
    lastRange.setStartAfter(eq);
  } else {
    docEl.append(eq);
  }
  eq.after(document.createTextNode(' '));
  showStored();
});

// Click an equation to load its LaTeX back into the field
docEl.addEventListener('click', (e) => {
  const eq = (e.target as Element).closest<HTMLElement>('.eq');
  if (!eq) return;
  editing?.classList.remove('editing');
  editing = eq;
  eq.classList.add('editing');
  mf.setValue(latexOf(eq.querySelector('.eq-sr')!.outerHTML));
  $('insert').textContent = 'Update';
  mf.focus();
});

docEl.addEventListener('input', showStored);
showStored();
