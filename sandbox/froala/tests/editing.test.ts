// The equation as an atomic island in Froala: insert, edit, cancel, undo/redo,
// caret movement, delete, copy/paste. Driven with real key presses and clicks
// (Playwright) wherever the behaviour depends on the browser.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { MathfieldElement } from 'mathlive';
import { toEditorHtml } from '../src';
import { createEditor, destroyEditor, eqs, rendered, stored, tick, type Editor } from './helpers';

let ed: Editor;
let X2: string; // stored MathML for x^2
beforeEach(async () => {
  X2 = await stored('x^2');
  ed = await createEditor();
});
afterEach(() => destroyEditor(ed));

const dialog = () => ed.mathEquation.dialog();
const field = () => dialog().field as MathfieldElement;
const latexOut = (html: string) =>
  Array.from(new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`, 'application/xml').getElementsByTagName('annotation'), (a) => a.textContent);

/** Put the caret `offset` characters into the text of `el` (after focusing, which can split text nodes). */
function caretAt(el: Element, offset: number) {
  ed.events.focus();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    if (offset <= t.length) {
      const r = document.createRange();
      r.setStart(t, offset);
      r.collapse(true);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(r);
      return;
    }
    offset -= t.length;
  }
  throw new Error('offset past the end of the text');
}

/** Select from one character before `node` to one character after it. */
function selectAcross(node: Node) {
  ed.events.focus();
  const r = document.createRange();
  r.setStartBefore(node);
  r.setEndAfter(node);
  const prev = node.previousSibling;
  const next = node.nextSibling;
  if (prev?.nodeType === Node.TEXT_NODE && prev.nodeValue) r.setStart(prev, prev.nodeValue.length - 1);
  if (next?.nodeType === Node.TEXT_NODE && next.nodeValue) r.setEnd(next, 1);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(r);
}

function caretBeside(node: Node, side: 'before' | 'after') {
  ed.events.focus();
  const r = document.createRange();
  if (side === 'before') r.setStartBefore(node);
  else r.setStartAfter(node);
  r.collapse(true);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(r);
}

/** Wait for the dialog's promise chain after a confirm/cancel. */
async function settle() {
  await tick(50);
  await rendered(ed);
}

describe('insert', () => {
  it('toolbar button → dialog → Enter inserts the equation at the caret', async () => {
    ed.html.set('<p>Solve  now.</p>');
    caretAt(ed.el.querySelector('p')!, 6);
    await userEvent.click(ed.$tb.get(0).querySelector('[data-cmd="insertEquation"]'));
    expect(dialog().isOpen).toBe(true);
    expect(dialog().dialog.querySelector('h2')!.textContent).toBe('Insert equation');
    await tick(100); // MathLive's focus() completes on a timer
    await userEvent.keyboard('x^2');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(dialog().isOpen).toBe(false);
    expect(eqs(ed)).toHaveLength(1);
    const out = ed.html.get();
    expect(out.startsWith('<p>Solve <math')).toBe(true);
    expect(latexOut(out)).toEqual(['x^2']);
    expect(ed.el.querySelector('.fr-marker')).toBeNull();
  });

  it('Ctrl+Shift+M opens the dialog too', async () => {
    ed.html.set('<p>abc</p>');
    caretAt(ed.el.querySelector('p')!, 3);
    await userEvent.keyboard('{Control>}{Shift>}M{/Shift}{/Control}');
    await tick();
    expect(dialog().isOpen).toBe(true);
    dialog().cancel();
  });

  it('Cancel and Escape change nothing and leave no caret markers behind', async () => {
    ed.html.set('<p>abc</p>');
    caretAt(ed.el.querySelector('p')!, 1);
    const before = ed.html.get();
    void ed.mathEquation.open();
    await tick(100);
    await userEvent.keyboard('y');
    await userEvent.click(dialog().dialog.querySelector('[data-action="cancel"]')!);
    await settle();
    expect(ed.html.get()).toBe(before);
    expect(ed.el.querySelector('.fr-marker')).toBeNull();

    void ed.mathEquation.open();
    await tick(100);
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(dialog().isOpen).toBe(false);
    expect(ed.html.get()).toBe(before);
  });

  it('Escape while typing a LaTeX command is left to MathLive', async () => {
    void ed.mathEquation.open();
    await tick(100);
    await userEvent.keyboard('\\fr');
    expect(field().mode).toBe('latex');
    await userEvent.keyboard('{Escape}');
    expect(dialog().isOpen).toBe(true);
    expect(field().mode).not.toBe('latex');
    await userEvent.keyboard('{Escape}');
    expect(dialog().isOpen).toBe(false);
  });

  it('refuses an empty equation and stays open', async () => {
    void ed.mathEquation.open();
    await tick(100);
    await dialog().confirm();
    expect(dialog().isOpen).toBe(true);
    expect(dialog().dialog.querySelector('.error')!.textContent).toBe('The equation is empty.');
    dialog().cancel();
  });
});

describe('edit', () => {
  it('click opens the equation with its LaTeX; Update replaces it in place', async () => {
    ed.html.set(toEditorHtml(`<p>a ${X2} b</p>`));
    await rendered(ed);
    await userEvent.click(eqs(ed)[0]);
    expect(dialog().isOpen).toBe(true);
    expect(dialog().dialog.querySelector('h2')!.textContent).toBe('Edit equation');
    expect(field().getValue('latex')).toBe('x^2');
    field().setValue('y^3');
    await dialog().confirm();
    await settle();
    expect(eqs(ed)).toHaveLength(1);
    expect(latexOut(ed.html.get())).toEqual(['y^3']);
    await eqs(ed)[0].ready;
    expect(eqs(ed)[0].shadowRoot!.querySelector('math annotation')!.textContent).toBe('y^3');
  });

  it('opening and cancelling leaves no trace in the HTML or the undo stack', async () => {
    ed.html.set(toEditorHtml(`<p>a ${X2} b</p>`));
    ed.undo.reset();
    ed.undo.saveStep();
    const html = ed.el.innerHTML;
    await userEvent.click(eqs(ed)[0]);
    expect(eqs(ed)[0].editing).toBe(true); // highlighted with a custom state, not a class
    expect(ed.el.innerHTML).toBe(html);
    dialog().cancel();
    await settle();
    expect(eqs(ed)[0].editing).toBe(false);
    expect(ed.undo.canDo()).toBe(false);
  });

  it('a converted (Wiris) equation shows a warning note', async () => {
    ed.html.set(toEditorHtml('<p><math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math></p>'));
    await userEvent.click(eqs(ed)[0]);
    const note = dialog().dialog.querySelector<HTMLElement>('.note')!;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('converted from MathML');
    expect(field().getValue('latex')).toBe('\\frac{1}{2}');
    dialog().cancel();
  });
});

describe('undo / redo', () => {
  it('undoes and redoes an insert and an edit', async () => {
    ed.html.set('<p>abc</p>');
    ed.undo.reset();
    ed.undo.saveStep();
    caretAt(ed.el.querySelector('p')!, 3);
    void ed.mathEquation.open();
    field().setValue('x^2');
    await dialog().confirm();
    await settle();
    expect(latexOut(ed.html.get())).toEqual(['x^2']);

    await userEvent.click(eqs(ed)[0]);
    field().setValue('z');
    await dialog().confirm();
    await settle();
    expect(latexOut(ed.html.get())).toEqual(['z']);

    ed.commands.undo();
    await settle();
    expect(latexOut(ed.html.get())).toEqual(['x^2']);
    expect(eqs(ed)[0].shadowRoot!.querySelector('svg')).not.toBeNull(); // re-rendered from the cache
    ed.commands.undo();
    await settle();
    expect(eqs(ed)).toHaveLength(0);
    ed.commands.redo();
    ed.commands.redo();
    await settle();
    expect(latexOut(ed.html.get())).toEqual(['z']);
  });
});

describe('caret and deletion around the island', () => {
  beforeEach(async () => {
    ed.html.set(toEditorHtml(`<p>ab${X2}cd</p>`));
    await rendered(ed);
  });
  const p = () => ed.el.querySelector('p')!;

  // Text on each side of the equation
  const sides = () => {
    const eq = eqs(ed)[0];
    const before = document.createRange();
    before.setStart(p(), 0);
    before.setEndBefore(eq);
    const after = document.createRange();
    after.setStartAfter(eq);
    after.setEnd(p(), p().childNodes.length);
    return [before.toString(), after.toString()];
  };

  it('ArrowRight steps over the equation in one press', async () => {
    caretBeside(eqs(ed)[0], 'before');
    await userEvent.keyboard('{ArrowRight}Z');
    expect(sides()).toEqual(['ab', 'Zcd']);
  });

  it('ArrowLeft steps back over it', async () => {
    caretBeside(eqs(ed)[0], 'after');
    await userEvent.keyboard('{ArrowLeft}Z');
    expect(sides()).toEqual(['abZ', 'cd']);
  });

  it('typing next to it never goes inside it', async () => {
    caretBeside(eqs(ed)[0], 'after');
    await userEvent.keyboard('QQ');
    expect(eqs(ed)[0].childNodes).toHaveLength(0);
    expect(latexOut(ed.html.get())).toEqual(['x^2']);
  });

  it('Backspace after it removes the whole equation, and undo brings it back', async () => {
    ed.undo.saveStep();
    caretBeside(eqs(ed)[0], 'after');
    await userEvent.keyboard('{Backspace}');
    expect(eqs(ed)).toHaveLength(0);
    expect(ed.html.get()).toBe('<p>abcd</p>');
    await tick(600); // Froala saves the undo step on a timer after the key
    ed.commands.undo();
    await settle();
    expect(eqs(ed)).toHaveLength(1);
    expect(latexOut(ed.html.get())).toEqual(['x^2']);
  });

  it('Delete before it removes the whole equation', async () => {
    caretBeside(eqs(ed)[0], 'before');
    await userEvent.keyboard('{Delete}');
    expect(eqs(ed)).toHaveLength(0);
    expect(ed.html.get()).toBe('<p>abcd</p>');
    ed.commands.undo();
    await settle();
    expect(eqs(ed)).toHaveLength(1);
  });

  it('selecting across it and typing replaces it with the text', async () => {
    selectAcross(eqs(ed)[0]);
    await userEvent.keyboard('Q');
    expect(eqs(ed)).toHaveLength(0);
    expect(p().textContent).toBe('aQd');
  });
});

describe('copy / paste', () => {
  function paste(html: string) {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', 'x');
    ed.el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }

  it('Ctrl+C / Ctrl+V of an equation in the editor gives a second editable equation', async () => {
    ed.html.set(toEditorHtml(`<p>ab${X2}cd</p>`));
    selectAcross(eqs(ed)[0]);
    await userEvent.keyboard('{Control>}c{/Control}');
    const caret = document.createRange();
    caret.selectNodeContents(ed.el.querySelector('p')!);
    caret.collapse(false);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(caret);
    await userEvent.keyboard('{Control>}v{/Control}');
    await settle();
    expect(eqs(ed)).toHaveLength(2);
    expect(latexOut(ed.html.get())).toEqual(['x^2', 'x^2']);
  });

  it('pasting a copied equation gives an editable equation', async () => {
    ed.html.set('<p>abcd</p>');
    caretAt(ed.el.querySelector('p')!, 2);
    const copied = toEditorHtml(`<p>${X2}</p>`).replace(/^<p>|<\/p>$/g, '');
    paste(copied);
    await settle();
    expect(eqs(ed)).toHaveLength(1);
    expect(latexOut(ed.html.get())).toEqual(['x^2']);
  });

  it('pasting MathML from another page gives an editable equation', async () => {
    ed.html.set('<p>abcd</p>');
    caretAt(ed.el.querySelector('p')!, 2);
    paste(`<span>see ${X2}</span>`);
    await settle();
    expect(eqs(ed)).toHaveLength(1);
    expect(latexOut(ed.html.get())).toEqual(['x^2']);
  });

  it('pasting a Wiris formula image gives an editable equation', async () => {
    ed.html.set('<p>abcd</p>');
    caretAt(ed.el.querySelector('p')!, 2);
    paste('<img class="Wirisformula" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-mathml="«math xmlns=¨http://www.w3.org/1998/Math/MathML¨»«mi»k«/mi»«/math»">');
    await settle();
    expect(eqs(ed)).toHaveLength(1);
    expect(eqs(ed)[0].getAttribute('data-source')).toBe('wiris-image');
  });
});

// The virtual keyboard inside the modal dialog is checked in
// scripts/demo-check.mjs: Vitest runs tests in an iframe, where MathLive's
// keyboard is a proxy to the top window and cannot be moved.
