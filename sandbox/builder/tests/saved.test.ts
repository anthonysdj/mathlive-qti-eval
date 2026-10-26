// Saving a built equation to reuse it: from "My equations" in the palette
// or by typing its shortcut. Real key presses into a real field.
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import { storedMathml } from '@sandbox/converters/src/render';
import {
  BuilderController,
  PROFILES,
  SavedEquations,
  localSavedStorage,
  memorySavedStorage,
  savedItem,
  shortcutProblem,
  type AllowedProfile,
  type Refusal,
} from '../src';
import { newField, setLatex, tick, type } from './helpers';

const SLOT = '\\placeholder{}';
const QUADRATIC = '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}';
const NO_FRACTIONS: AllowedProfile = { id: 'nofrac', label: 'No fractions', categories: ['roots', 'scripts', 'operators'] };

let mf: MathfieldElement;
let b: BuilderController;
let refusals: Refusal[];

beforeEach(async () => {
  refusals = [];
  mf = await newField();
  b = new BuilderController(mf, { profile: PROFILES[0], keyboard: false, onRefused: (r) => refusals.push(r) });
});
afterEach(() => {
  b.detach();
  mf.remove();
});

test('savedItem: empty boxes become slots', () => {
  expect(savedItem({ id: '1', name: 'Box over two', latex: `\\frac{${SLOT}}{2}` }).insert).toBe('\\frac{#?}{2}');
  expect(savedItem({ id: '1', name: 'x', latex: `x_{\\placeholder[a]{}}` }).insert).toBe('x_{#?}');
});

test('shortcutProblem: letters only, and not one the field already has', () => {
  expect(shortcutProblem('quadf', ['sqrt'])).toBeNull();
  expect(shortcutProblem('q', [])).toMatch(/2 to 16 letters/);
  expect(shortcutProblem('quad f', [])).toMatch(/2 to 16 letters/);
  expect(shortcutProblem('x2', [])).toMatch(/2 to 16 letters/);
  expect(shortcutProblem('\\frac', [])).toMatch(/2 to 16 letters/);
  expect(shortcutProblem('sqrt', b.takenShortcuts())).toBe('"sqrt" is already a shortcut. Choose other letters.');
  // MathLive's own and ours are both taken
  expect(b.takenShortcuts()).toEqual(expect.arrayContaining(['sin', 'pi', 'alpha', 'abs', 'cbrt']));
});

test('SavedEquations: validates, keeps its storage up to date, and survives a reload', () => {
  localStorage.removeItem('eb-test');
  const store = new SavedEquations(localSavedStorage('eb-test'));
  expect(() => store.add({ name: 'Nothing', latex: '' })).toThrow('Build an equation first');
  expect(() => store.add({ name: 'Only boxes', latex: `${SLOT} ${SLOT}` })).toThrow('Build an equation first');
  expect(() => store.add({ name: '  ', latex: 'x' })).toThrow('Give the equation a name.');
  const q = store.add({ name: 'Quadratic formula', latex: QUADRATIC, shortcut: 'quadf' }, b.takenShortcuts());
  expect(() => store.add({ name: 'quadratic FORMULA', latex: 'x' })).toThrow('already an equation called');
  expect(() => store.add({ name: 'Other', latex: 'x', shortcut: 'quadf' })).toThrow('"quadf" is already a shortcut');
  expect(() => store.add({ name: 'Sine', latex: 'x', shortcut: 'sin' }, b.takenShortcuts())).toThrow('"sin" is already a shortcut');
  store.add({ name: 'No shortcut', latex: 'E=mc^2', shortcut: '' });

  const reloaded = new SavedEquations(localSavedStorage('eb-test'));
  expect(reloaded.list.map((s) => [s.name, s.latex, s.shortcut])).toEqual([
    ['Quadratic formula', QUADRATIC, 'quadf'],
    ['No shortcut', 'E=mc^2', undefined],
  ]);
  reloaded.remove(q.id);
  expect(new SavedEquations(localSavedStorage('eb-test')).list.map((s) => s.name)).toEqual(['No shortcut']);

  // Whatever is in storage, only well-formed entries come back
  localStorage.setItem('eb-test', JSON.stringify([{ id: 1 }, 'x', { id: 'a', name: 'ok', latex: 'y' }, { id: 'b', name: 'bad', latex: 'z', shortcut: 'no way' }]));
  expect(new SavedEquations(localSavedStorage('eb-test')).list.map((s) => s.name)).toEqual(['ok']);
  localStorage.setItem('eb-test', '{not json');
  expect(new SavedEquations(localSavedStorage('eb-test')).list).toEqual([]);
  localStorage.removeItem('eb-test');
});

test('save what was built, then type its shortcut to get it back', async () => {
  // Built with the palette and typing (the drag tests build the same way)
  b.insert({ id: 'frac', label: 'Fraction', insert: '\\frac{#?}{#?}' });
  await type('-b');
  b.insert({ id: 'pm', label: '±', insert: '\\pm' });
  b.insert({ id: 'sqrt', label: 'Square root', insert: '\\sqrt{#0}' });
  await type('b^2-4ac{ArrowRight}{ArrowDown}2a'); // a digit typed in a power leaves it
  expect(mf.getValue('latex')).toBe(QUADRATIC);

  const store = new SavedEquations(memorySavedStorage());
  store.add({ name: 'Quadratic formula', latex: mf.getValue('latex'), shortcut: 'quadf' }, b.takenShortcuts());
  b.setSaved(store.list);
  expect(b.savedItems().map((i) => i.label)).toEqual(['Quadratic formula']);

  setLatex(mf, 'x=');
  await tick(30);
  await type('quadf');
  expect(mf.getValue('latex')).toBe(`x=${QUADRATIC}`);
  expect(refusals).toEqual([]);
  expect(storedMathml(mf)).toContain('<mfrac>');
});

test('an equation saved with empty boxes is a template: its shortcut leaves them to fill, Tab moves on', async () => {
  const store = new SavedEquations(memorySavedStorage());
  store.add({ name: 'Pythagoras', latex: `${SLOT}^2+${SLOT}^2=${SLOT}^2`, shortcut: 'pyth' }, b.takenShortcuts());
  b.setSaved(store.list);
  await type('pyth');
  expect(mf.getValue('latex')).toBe(`${SLOT}^2+${SLOT}^2=${SLOT}^2`);
  await type('a{Tab}b{Tab}c');
  expect(mf.getValue('latex')).toBe('a^2+b^2=c^2');
  expect(b.validate()).toBeNull();
});

test('clicking a saved piece inserts it at the caret, like any palette piece', async () => {
  const store = new SavedEquations(memorySavedStorage());
  store.add({ name: 'Mass–energy', latex: 'E=mc^2' });
  b.setSaved(store.list);
  b.insert(b.savedItems()[0]);
  expect(mf.getValue('latex')).toBe('E=mc^2');
});

test('a profile that refuses something in a saved equation hides it and turns its shortcut off', async () => {
  const store = new SavedEquations(memorySavedStorage());
  store.add({ name: 'Quadratic formula', latex: QUADRATIC, shortcut: 'quadf' }, b.takenShortcuts());
  store.add({ name: 'Square', latex: 'x^2', shortcut: 'sq' }, b.takenShortcuts());
  b.setSaved(store.list);
  b.setProfile(NO_FRACTIONS);
  expect(b.savedItems().map((i) => i.label)).toEqual(['Square']);
  await type('quadf');
  expect(mf.getValue('latex')).not.toContain('\\frac');
  setLatex(mf, '');
  b.reset();
  await type('sq');
  expect(mf.getValue('latex')).toBe('x^2');
  // And back
  b.setProfile(PROFILES[0]);
  expect(b.savedItems().map((i) => i.label)).toEqual(['Quadratic formula', 'Square']);
});

test('saved LaTeX the profile has never heard of is never offered', () => {
  // localStorage is the author's to edit: a hand-made entry with \href
  const store = new SavedEquations(memorySavedStorage([{ id: 'x', name: 'Link', latex: '\\href{https://example.com}{x}', shortcut: 'lnk' }]));
  b.setSaved(store.list);
  expect(b.savedItems()).toEqual([]);
  expect(Object.keys(mf.inlineShortcuts)).not.toContain('lnk');
});
