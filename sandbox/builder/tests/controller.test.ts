// The allowed-symbols profile holds whichever way content arrives: palette,
// typing, inline shortcuts, paste. Driven with real key presses.
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import { storedMathml } from '@sandbox/converters/src/render';
import { BuilderController, CATEGORIES, PROFILES, type AllowedProfile, type Refusal } from '../src';
import { newField, setLatex, tick, type } from './helpers';

const NONE: AllowedProfile = { id: 'none', label: 'Nothing but the basics', categories: [] };
const NO_FRACTIONS: AllowedProfile = { id: 'nofrac', label: 'No fractions', categories: ['roots', 'scripts', 'operators'] };
const profile = (id: string) => PROFILES.find((p) => p.id === id)!;
const item = (id: string) => CATEGORIES.flatMap((c) => c.items).find((i) => i.id === id)!;

let mf: MathfieldElement;
let refusals: Refusal[];
let b: BuilderController | undefined;
const attach = (p: AllowedProfile) => {
  b?.detach();
  b = new BuilderController(mf, { profile: p, keyboard: false, onRefused: (r) => refusals.push(r) });
};

beforeEach(async () => {
  refusals = [];
  mf = await newField();
});
afterEach(() => {
  b?.detach();
  b = undefined;
  mf.remove();
});

test('ASCII typing is never refused, even with no categories', async () => {
  attach(NONE);
  await type("2+3-(4)=x, y<z>1! f'+g''.*b");
  expect(refusals).toEqual([]);
  const latex = mf.getValue('latex');
  expect(latex).toContain('\\cdot'); // * → \cdot
  expect(latex).toContain('f^{\\prime}');
  expect(latex).toContain('g^{\\doubleprime}');
  // ...and it can be stored (\doubleprime is mapped for Temml)
  expect(storedMathml(mf)).toContain('′');
});

test('a typed / becomes a fraction, which a profile without fractions undoes', async () => {
  attach(NO_FRACTIONS);
  await type('a/');
  expect(mf.getValue('latex')).toBe('a');
  expect(refusals.map((r) => r.message)).toEqual(["Fraction isn't allowed in this assessment."]);
  // The caret is back where it was: typing carries on after the a
  await type('+b');
  expect(mf.getValue('latex')).toBe('a+b');
});

test('a refused change in the middle restores the caret there', async () => {
  attach(NO_FRACTIONS);
  await type('ab');
  await type('{ArrowLeft}');
  await type('/');
  expect(mf.getValue('latex')).toBe('ab');
  await type('c');
  expect(mf.getValue('latex')).toBe('acb');
});

test('powers can be refused too (^ key)', async () => {
  attach({ ...NONE, categories: ['fractions'] });
  await type('x^');
  expect(mf.getValue('latex')).toBe('x');
  expect(refusals[0].tokens).toEqual(['^']);
  await type('2');
  expect(mf.getValue('latex')).toBe('x2');
});

test('keys typed in one burst: only the refused one is undone', async () => {
  attach({ ...NONE, categories: ['fractions'] });
  await type('ab^c');
  expect(refusals[0].tokens).toEqual(['^']);
  expect(mf.getValue('latex')).toBe('abc');
});

test('inline shortcuts the profile refuses are switched off, not undone afterwards', async () => {
  attach(profile('arithmetic'));
  expect(mf.inlineShortcuts).not.toHaveProperty('sqrt');
  expect(mf.inlineShortcuts).not.toHaveProperty('alpha');
  expect(mf.inlineShortcuts).toHaveProperty('xx'); // × is allowed
  await type('sqrt');
  expect(mf.getValue('latex')).toBe('sqrt');
  expect(refusals).toEqual([]);
  attach(profile('everything'));
  setLatex(mf, '');
  await type('sqrt');
  expect(mf.getValue('latex')).toBe('\\sqrt{\\placeholder{}}');
});

test('pasted LaTeX is checked like anything else', async () => {
  attach(profile('arithmetic'));
  mf.executeCommand(['insert', '\\int_0^1 x\\,dx']); // what a paste runs
  await tick();
  // insert() from code fires input too
  expect(mf.getValue('latex')).toBe('');
  expect(refusals[0].tokens).toEqual(['\\int', '_', '^']);
});

test('the palette inserts with slots and Tab moves through them', async () => {
  attach(profile('everything'));
  b!.insert(item('defint'));
  expect(b!.emptySlots()).toBe(4);
  await type('0{Tab}1{Tab}x^2{ArrowRight}{Tab}x');
  expect(mf.getValue('latex')).toBe('\\int_0^1x^2\\,\\differentialD x');
  expect(mf.getValue('latex-expanded')).toBe('\\int_0^1x^2\\,\\mathrm{d}x');
  expect(b!.validate()).toBeNull();
});

test('a template wraps the selection (#0) or takes the term before the caret (#@)', async () => {
  attach(profile('everything'));
  setLatex(mf, 'a+b');
  mf.executeCommand('selectAll');
  b!.insert(item('sqrt'));
  expect(mf.getValue('latex')).toBe('\\sqrt{a+b}');
  setLatex(mf, '3x');
  b!.insert(item('power'));
  await type('2');
  expect(mf.getValue('latex')).toBe('3x^2');
});

test('empty slots stop the save, with a count', async () => {
  attach(profile('everything'));
  b!.insert(item('pmatrix2'));
  expect(b!.validate()).toBe('Fill in the 4 empty boxes, or delete them.');
  await type('1');
  expect(b!.validate()).toBe('Fill in the 3 empty boxes, or delete them.');
});

test('an older equation that breaks the profile stays editable, but cannot be saved as is', async () => {
  attach(profile('arithmetic'));
  setLatex(mf, '\\sqrt{2}+1');
  b!.reset(); // what the dialog does after loading an equation
  await type('+3');
  expect(mf.getValue('latex')).toBe('\\sqrt{2}+1+3');
  expect(refusals).toEqual([]);
  expect(b!.validate()).toBe("Square root isn't allowed in this assessment.");
  // New refused content is still refused
  await type('^');
  expect(refusals[0].tokens).toEqual(['^']);
});

test('chemistry and units go in through a text entry', async () => {
  attach(profile('chemistry'));
  const chem = CATEGORIES.find((c) => c.id === 'chemistry')!.entry!;
  const unit = CATEGORIES.find((c) => c.id === 'units')!.entry!;
  b!.insertEntry(chem, '2H2 + O2 -> 2H2O');
  expect(mf.getValue('latex')).toBe('\\ce{2H2 + O2 -> 2H2O}');
  expect(storedMathml(mf)).toContain('→</mo>');
  setLatex(mf, '101');
  b!.insertEntry(unit, 'kPa');
  expect(mf.getValue('latex')).toBe('101\\,\\mathrm{kPa}');
  // What would break out of the group is refused with a message
  expect(() => b!.insertEntry(chem, 'H2O} \\int')).toThrow("A chemical formula can't contain \"}\".");
  expect(() => b!.insertEntry(unit, 'm/s')).toThrow("A unit can't contain");
  expect(() => b!.insertEntry(unit, ' ')).toThrow('Type a unit first.');
});

test('context menu: editing commands only, matrix rows and columns when matrices are allowed', () => {
  attach(profile('arithmetic'));
  const ids = () => mf.menuItems.filter((m) => m.type !== 'divider').map((m) => ('id' in m ? m.id : m.type));
  expect(ids()).toEqual(['cut', 'copy', 'paste', 'select-all']);
  attach(profile('calculus'));
  expect(ids()).toEqual(expect.arrayContaining(['add-row-above', 'delete-column', 'cut']));
  expect(ids()).not.toContain('color');
  expect(ids()).not.toContain('insert-matrix');
});

test('detach puts the field back as it was', () => {
  const before = { shortcuts: Object.keys(mf.inlineShortcuts).length, menu: mf.menuItems.length };
  attach(profile('arithmetic'));
  expect(Object.keys(mf.inlineShortcuts).length).toBeLessThan(before.shortcuts);
  b!.detach();
  expect(Object.keys(mf.inlineShortcuts).length).toBe(before.shortcuts);
  expect(mf.menuItems.length).toBe(before.menu);
});
