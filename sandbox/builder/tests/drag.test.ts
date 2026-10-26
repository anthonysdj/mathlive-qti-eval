// Building a formula by dragging palette pieces into the field and into the
// empty boxes of pieces dropped earlier. Driven with pointer events at the
// coordinates MathLive reports for each atom; the Angular check
// (apps/authoring/scripts/drag-check.mjs) does the same with a real mouse.
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import { storedMathml } from '@sandbox/converters/src/render';
import { BuilderController, PROFILES, PaletteDrag, dropInsert, dropTargetAt, type AllowedProfile, type PaletteItem, type Refusal } from '../src';
import { ALL_ITEMS } from '../src/palette';
import { newField, setLatex, tick, type } from './helpers';

const item = (id: string) => ALL_ITEMS.find((i) => i.id === id)!;
const SLOT = '\\placeholder{}';

let mf: MathfieldElement;
let b: BuilderController;
let drag: PaletteDrag;
let palette: HTMLElement;
let refusals: Refusal[];
let clicked: string[];

function attach(profile: AllowedProfile = PROFILES.find((p) => p.id === 'everything')!) {
  b?.detach();
  b = new BuilderController(mf, { profile, keyboard: false, onRefused: (r) => refusals.push(r) });
}

beforeEach(async () => {
  refusals = [];
  clicked = [];
  mf = await newField();
  mf.style.cssText = 'display:block; font-size:32px; width:520px; margin:120px 0 0 40px';
  attach();
  palette = document.createElement('div');
  palette.style.cssText = 'position:fixed; left:0; top:0; display:flex; gap:4px';
  for (const i of ALL_ITEMS.filter((i) => ['frac', 'sqrt', 'pi', 'plus', 'eq', 'square', 'power'].includes(i.id))) {
    const key = document.createElement('button');
    key.dataset.item = i.id;
    key.textContent = i.label;
    key.style.cssText = 'width:44px; height:44px; font-size:8px';
    key.addEventListener('click', () => clicked.push(i.id));
    palette.append(key);
  }
  document.body.append(palette);
  drag = new PaletteDrag(palette, { field: () => mf, item: (id) => ALL_ITEMS.find((i) => i.id === id), drop: (i, t) => b.drop(i, t.offset) });
});
afterEach(() => {
  drag.detach();
  b.detach();
  mf.remove();
  palette.remove();
});

const key = (id: string) => palette.querySelector<HTMLElement>(`[data-item="${id}"]`)!;
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
function pointer(type: string, target: EventTarget, { x, y }: { x: number; y: number }) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
}

/** Press on a palette key, move in steps to (x, y), release; then the click the browser sends */
async function dragTo(id: string, to: { x: number; y: number }) {
  const k = key(id);
  const from = center(k.getBoundingClientRect());
  pointer('pointerdown', k, from);
  for (let s = 1; s <= 4; s++) pointer('pointermove', document.body, { x: from.x + ((to.x - from.x) * s) / 4, y: from.y + ((to.y - from.y) * s) / 4 });
  pointer('pointerup', document.body, to);
  k.click();
  await tick(60); // MathLive renders the insert
}

/** Centres of the empty boxes in the field, in order */
function slots(): { x: number; y: number }[] {
  const out = [];
  for (let o = 0; o <= mf.lastOffset; o++) {
    const info = mf.getElementInfo(o);
    if (info?.latex === SLOT && info.bounds) out.push(center(info.bounds));
  }
  return out;
}
/** Just right of the last atom at the top level */
function end() {
  const r = mf.getBoundingClientRect();
  return { x: r.right - 6, y: r.top + r.height / 2 };
}

test('dropTargetAt: an empty box, a caret position, and outside the field', async () => {
  setLatex(mf, `\\frac{${SLOT}}{${SLOT}}+x`);
  await tick(50);
  const [num, den] = slots();
  expect(dropTargetAt(mf, num.x, num.y)).toMatchObject({ slot: true, offset: 2 });
  expect(dropTargetAt(mf, den.x, den.y)).toMatchObject({ slot: true, offset: 4 });
  const plus = mf.getElementInfo(6)!.bounds!;
  const t = dropTargetAt(mf, plus.right - 2, plus.top + plus.height / 2)!;
  expect(t).toMatchObject({ slot: false, offset: 6 });
  expect(t.rect.width).toBe(2);
  expect(t.rect.left).toBeCloseTo(plus.right - 1, 0);
  const r = mf.getBoundingClientRect();
  // Right of a power: the caret line is after the exponent (MathLive has no bounds for that atom)
  setLatex(mf, 'x^2');
  await tick(50);
  const two = mf.getElementInfo(3)!.bounds!; // the 2
  const after = dropTargetAt(mf, r.right - 6, r.top + r.height / 2)!;
  expect(after).toMatchObject({ slot: false, offset: mf.lastOffset });
  expect(after.rect.left).toBeCloseTo(two.right - 1, 0);
  expect(after.rect.height).toBeGreaterThan(two.height);
  // A tall atom's box reaches above the field; the mark stays inside it
  setLatex(mf, '\\frac{\\sqrt{\\frac14}}{\\pi}');
  await tick(50);
  const tall = dropTargetAt(mf, r.right - 6, r.top + r.height / 2)!;
  const rf = mf.getBoundingClientRect();
  expect(tall.rect.top).toBeGreaterThanOrEqual(rf.top);
  expect(tall.rect.bottom).toBeLessThanOrEqual(rf.bottom);
  expect(dropTargetAt(mf, r.right + 40, r.top)).toBeNull();
  expect(dropTargetAt(mf, r.left, r.bottom + 40)).toBeNull();
});

test('dropInsert: a piece placed by hand only takes the term before it when it attaches to it', () => {
  expect(dropInsert(item('frac'))).toBe('\\frac{#?}{#?}');
  expect(dropInsert(item('power'))).toBe('#@^{#?}');
  expect(dropInsert(item('square'))).toBe('#@^2');
  expect(dropInsert(item('sqrt'))).toBe('\\sqrt{#0}');
});

test('build a nested formula by dragging pieces into empty boxes', async () => {
  const r = mf.getBoundingClientRect();
  await dragTo('frac', center(r));
  expect(mf.getValue('latex')).toBe(`\\frac{${SLOT}}{${SLOT}}`);

  await dragTo('sqrt', slots()[0]); // into the numerator
  expect(mf.getValue('latex')).toBe(`\\frac{\\sqrt{${SLOT}}}{${SLOT}}`);

  await dragTo('frac', slots()[0]); // a fraction under the root
  expect(mf.getValue('latex')).toBe(`\\frac{\\sqrt{\\frac{${SLOT}}{${SLOT}}}}{${SLOT}}`);

  await dragTo('pi', slots().at(-1)!); // the outer denominator
  await dragTo('plus', end());
  await dragTo('power', end()); // after a +: an empty base and exponent
  expect(mf.getValue('latex')).toBe(`\\frac{\\sqrt{\\frac{${SLOT}}{${SLOT}}}}{\\pi}+${SLOT}^{${SLOT}}`);
  expect(b.validate()).toBe('Fill in the 4 empty boxes, or delete them.');

  // A drop selects the piece's first box, so typing fills it; Tab moves on
  await type('x{Tab}2');
  expect(mf.getValue('latex')).toBe(`\\frac{\\sqrt{\\frac{${SLOT}}{${SLOT}}}}{\\pi}+x^2`);
  for (const [i, text] of ['1', '4'].entries()) {
    mf.focus();
    mf.position = 0;
    await tick(30);
    mf.executeCommand('moveToNextPlaceholder');
    await type(text);
    expect(slots().length).toBe(1 - i);
  }
  expect(mf.getValue('latex')).toBe('\\frac{\\sqrt{\\frac14}}{\\pi}+x^2');
  expect(b.validate()).toBeNull();
  // Out through the usual pipeline
  const mathml = storedMathml(mf);
  expect(mathml).toContain('<msqrt>');
  expect(mathml.match(/<mfrac>/g)?.length).toBe(2);
  expect(mathml).toContain('π');
  expect(refusals).toEqual([]);
  // Each drop is one undo step
  mf.executeCommand('undo');
  expect(mf.getValue('latex')).not.toBe('\\frac{\\sqrt{\\frac14}}{\\pi}+x^2');
});

test('a power dropped after a term attaches to it; a fraction does not swallow it', async () => {
  setLatex(mf, '3x');
  await tick(50);
  await dragTo('square', end());
  expect(mf.getValue('latex')).toBe('3x^2');
  await dragTo('frac', end());
  expect(mf.getValue('latex')).toBe(`3x^2\\frac{${SLOT}}{${SLOT}}`);
});

test('dropping between two pieces inserts there', async () => {
  setLatex(mf, 'a=b');
  await tick(50);
  const a = mf.getElementInfo(1)!.bounds!;
  await dragTo('plus', { x: a.right - 1, y: a.top + a.height / 2 });
  expect(mf.getValue('latex')).toBe('a+=b');
});

test('a press without a move is a click; a drag is not', async () => {
  const k = key('pi');
  const at = center(k.getBoundingClientRect());
  pointer('pointerdown', k, at);
  pointer('pointerup', k, at);
  k.click();
  expect(clicked).toEqual(['pi']);
  await dragTo('pi', center(mf.getBoundingClientRect()));
  expect(clicked).toEqual(['pi']);
  expect(mf.getValue('latex')).toBe('\\pi');
});

test('nothing is dropped outside the field, or after Escape', async () => {
  const r = mf.getBoundingClientRect();
  await dragTo('frac', { x: r.right + 60, y: r.bottom + 60 });
  expect(mf.getValue('latex')).toBe('');
  expect(document.querySelector('.eb-drag-ghost, .eb-drop-mark')).toBeNull();

  const k = key('frac');
  const from = center(k.getBoundingClientRect());
  pointer('pointerdown', k, from);
  pointer('pointermove', document.body, center(r));
  expect(drag.dragging).toBe(true);
  expect(document.querySelector<HTMLElement>('.eb-drop-mark')!.style.display).toBe('block');
  expect(mf.classList.contains('eb-drop-over')).toBe(true);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(drag.dragging).toBe(false);
  pointer('pointerup', document.body, center(r));
  await tick(30);
  expect(mf.getValue('latex')).toBe('');
  expect(mf.classList.contains('eb-drop-over')).toBe(false);
});

test('a drop the profile refuses is undone like any other change', async () => {
  attach({ id: 'nofrac', label: 'No fractions', categories: ['roots', 'operators'] });
  await dragTo('frac', center(mf.getBoundingClientRect()));
  await tick(30);
  expect(mf.getValue('latex')).toBe('');
  expect(refusals.map((r) => r.message)).toEqual(["Fraction isn't allowed in this assessment."]);
});
