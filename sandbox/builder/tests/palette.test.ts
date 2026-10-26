// Every palette item inserts, takes typed content in each of its slots (Tab
// between them), and converts to stored MathML that loads back unchanged.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import { storedMathml, latexOf } from '@sandbox/converters/src/render';
import { ALL_ITEMS, CATEGORIES, displayLatex, itemTokens, resolveAllowed, PROFILES, BuilderController } from '../src';
import { newField, setLatex, type } from './helpers';

let mf: MathfieldElement;
let builder: BuilderController;
beforeAll(async () => {
  mf = await newField();
  builder = new BuilderController(mf, { profile: PROFILES[0], keyboard: false });
});
afterAll(() => {
  builder.detach();
  mf.remove();
});

test('ids are unique and every item has a label', () => {
  const ids = ALL_ITEMS.map((i) => i.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const i of ALL_ITEMS) expect(i.label.length, i.id).toBeGreaterThan(1);
});

test('every category has items and a short label', () => {
  for (const c of CATEGORIES) {
    expect(c.items.length, c.id).toBeGreaterThan(0);
    expect(c.short.length, c.id).toBeGreaterThan(0);
  }
  expect(CATEGORIES.map((c) => c.id)).toEqual(expect.arrayContaining(['fractions', 'roots', 'scripts', 'matrices', 'calculus', 'brackets', 'greek', 'operators', 'chemistry', 'units']));
});

test("the 'everything' profile allows every item", () => {
  const all = resolveAllowed(PROFILES[0]);
  for (const i of ALL_ITEMS) expect([...itemTokens(i)].filter((t) => !all.isAllowed(t)), i.id).toEqual([]);
  expect(all.categories.flatMap((c) => c.items).length).toBe(ALL_ITEMS.length);
});

describe('each item: insert, fill every slot with Tab, store, reload', () => {
  for (const item of ALL_ITEMS) {
    test(item.id, async () => {
      // A term before the caret, for items that take one (#@)
      setLatex(mf, item.insert.includes('#@') ? 'y' : '');
      builder.reset();
      mf.focus();
      builder.insert(item);
      const slots = builder.emptySlots();
      expect(slots, 'slots after insert').toBe(item.insert.match(/#[?0]/g)?.length ?? 0);
      // The first slot is selected; type into it, Tab to the next
      for (let i = 0; i < slots; i++) await type(i < slots - 1 ? `${i + 1}{Tab}` : `${i + 1}`);
      expect(builder.emptySlots(), mf.getValue('latex')).toBe(0);
      expect(builder.validate()).toBeNull();

      const mathml = storedMathml(mf);
      expect(mathml).toMatch(/^<math xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML">/);
      expect(mathml).not.toContain('□');
      // Reload: the annotation is what the editor gets back, and it converts to the same MathML
      const latex = latexOf(mathml);
      setLatex(mf, latex);
      expect(storedMathml(mf), latex).toBe(mathml);
    });
  }
});

test('button and keycap labels draw slots as boxes and drop a leading thin space', () => {
  expect(displayLatex({ id: 'x', label: 'x', insert: '\\frac{#@}{#?}' })).toBe('\\frac{\\placeholder{}}{\\placeholder{}}');
  expect(displayLatex({ id: 'x', label: 'x', insert: '\\,\\mathrm{kg}' })).toBe('\\mathrm{kg}');
});
