// Macros and inline shortcuts, and the MathLive 0.111.1 behaviour that
// shaped them (palette.ts, notation.ts). Pinned so an upgrade that changes
// it is noticed.
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import { storedMathml, latexOf } from '@sandbox/converters/src/render';
import { BuilderController, MACROS, PROFILES, SHORTCUTS } from '../src';
import { newField, setLatex, type } from './helpers';

let mf: MathfieldElement;
let b: BuilderController;
beforeEach(async () => {
  mf = await newField();
  b = new BuilderController(mf, { profile: PROFILES[0], keyboard: false });
});
afterEach(() => {
  b.detach();
  mf.remove();
});

test('our macros are expanded away: the stored LaTeX and MathML never contain them', () => {
  for (const name of Object.keys(MACROS)) {
    setLatex(mf, `x\\${name}`);
    const mathml = storedMathml(mf);
    expect(latexOf(mathml), name).not.toContain(`\\${name}`);
  }
  setLatex(mf, 'x\\in\\R');
  expect(latexOf(storedMathml(mf))).toBe('x\\in\\mathbb{R}');
});

test('every shortcut produces LaTeX that Temml converts', async () => {
  for (const [name, def] of Object.entries(SHORTCUTS)) {
    setLatex(mf, '2 ');
    await type(name);
    const latex = mf.getValue('latex');
    expect(latex, name).not.toBe(`2${name}`);
    mf.executeCommand(['insert', '1']); // fill a slot so Temml has content
    expect(() => storedMathml(mf), `${name} → ${latex}`).not.toThrow();
    void def;
  }
});

test('a typed sequence becomes notation', async () => {
  await type('5degC');
  expect(mf.getValue('latex')).toBe('5\\,{}^{\\circ}\\mathrm{C}');
  setLatex(mf, '');
  await type('abs');
  await type('x-1');
  expect(mf.getValue('latex')).toBe('\\left|x-1\\right|');
});

// --- MathLive behaviour behind the design choices ---------------------------

test('MathLive: text typed into a \\ce{} slot is lost', async () => {
  mf.insert('\\ce{#?}', { focus: true });
  await type('H2O');
  expect(mf.getValue('latex')).toBe('\\ce{\\placeholder{}}');
});

test('MathLive: typing into \\ce{#0} produces "undefined"', async () => {
  mf.insert('\\ce{#0}', { focus: true });
  await type('2H2 + O2 -> 2H2O');
  expect(mf.getValue('latex')).toContain('undefined');
});

test('MathLive: \\ce has no spoken text', () => {
  setLatex(mf, '\\ce{H2O}');
  expect(mf.getValue('spoken-text').trim()).toBe('');
});

test('MathLive: text typed into a \\mathrm{} slot does not stay in it', async () => {
  // Without our shortcuts it even becomes \operatorname{kg} (a function name)
  setLatex(mf, '');
  mf.insert('\\mathrm{#?}', { focus: true });
  await type('kg');
  expect(mf.getValue('latex')).not.toContain('\\mathrm{kg}');
});

test('MathLive: after a literal \\mathrm{d}, the variable goes into the same group', async () => {
  setLatex(mf, '');
  mf.insert('\\int x\\,\\mathrm{d}#?', { focus: true });
  await type('x');
  expect(mf.getValue('latex')).toBe('\\int x\\,\\mathrm{dx}');
});

test('MathLive: a macro with an argument keeps its empty slot in "latex"', async () => {
  mf.macros = { ...mf.macros, absm: { def: '\\left|#1\\right|', args: 1 } };
  mf.insert('\\absm{#?}', { focus: true });
  await type('x-1');
  expect(mf.getValue('latex')).toBe('\\absm{\\placeholder{}}');
  expect(mf.getValue('latex-expanded')).toBe('\\left|x-1\\right|');
  expect(mf.getValue('spoken-text').trim()).toBe('absm');
});
