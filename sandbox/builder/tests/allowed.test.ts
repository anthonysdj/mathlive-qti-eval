import { expect, test } from 'vitest';
import { describeToken, latexTokens, PROFILES, resolveAllowed, refusalMessage, keyboardLayouts, CATEGORIES } from '../src';

const profile = (id: string) => resolveAllowed(PROFILES.find((p) => p.id === id)!);

test('tokens: commands, environments, powers and subscripts', () => {
  expect([...latexTokens('\\frac{x^2}{y_1}+\\sqrt{2}')]).toEqual(['\\frac', '^', '_', '\\sqrt']);
  expect([...latexTokens('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}')]).toEqual(['\\begin{pmatrix}', '\\\\']);
  expect([...latexTokens('\\left\\lbrace x\\right\\rbrace')]).toEqual(['\\left', '\\lbrace', '\\right', '\\rbrace']);
  expect([...latexTokens('5\\,\\mathrm{kg}')]).toEqual(['\\,', '\\mathrm']);
  // Inside \ce{} is mhchem syntax: ^ there is "gas given off", not a power
  expect([...latexTokens('\\ce{CO2 ^}+x')]).toEqual(['\\ce']);
  expect([...latexTokens('\\ce{H2O}x')]).toEqual(['\\ce']);
  expect([...latexTokens('2+3=5')]).toEqual([]);
  // Primes aren't powers
  expect([...latexTokens("f^{\\prime}+g^{\\doubleprime}+h^\\prime")]).toEqual(['\\prime', '\\doubleprime']);
});

test('primary arithmetic: no roots, powers, Greek or infinity', () => {
  const a = profile('arithmetic');
  expect(a.categories.map((c) => c.id)).toEqual(['fractions', 'brackets', 'operators', 'relations']);
  expect(a.refused('\\frac{1}{2}+3\\times4\\le\\left(5\\right)')).toEqual([]);
  expect(a.refused('\\sqrt{2}+x^2+\\pi+\\infty')).toEqual(['\\sqrt', '^', '\\pi', '\\infty']);
  // Blocked commands also take their palette buttons away
  const ops = a.categories.find((c) => c.id === 'operators')!.items.map((i) => i.id);
  expect(ops).not.toContain('infty');
  expect(ops).toContain('times');
  const brackets = a.categories.find((c) => c.id === 'brackets')!.items.map((i) => i.id);
  expect(brackets).toEqual(['paren', 'square-br', 'brace', 'abs']);
});

test('extra commands without the whole category', () => {
  const a = profile('algebra');
  expect(a.categories.map((c) => c.id)).not.toContain('greek');
  expect(a.refused('\\pi r^2+\\theta')).toEqual([]);
  expect(a.refused('\\omega')).toEqual(['\\omega']);
});

test('chemistry allows \\ce and \\mathrm units, not calculus', () => {
  const c = profile('chemistry');
  expect(c.refused('\\ce{2H2 + O2 -> 2H2O}')).toEqual([]);
  expect(c.refused('25\\,{}^{\\circ}\\mathrm{C}')).toEqual([]);
  expect(c.refused('\\int x')).toEqual(['\\int']);
  expect(c.categories.find((x) => x.id === 'chemistry')!.entry).toBeDefined();
});

test('messages name what was refused in words', () => {
  expect(describeToken('\\frac')).toBe('Fraction');
  expect(describeToken('^')).toBe('Powers');
  expect(describeToken('\\sqrt')).toBe('Square root');
  expect(describeToken('\\begin{pmatrix}')).toBe('Matrices');
  expect(refusalMessage(['\\frac'])).toBe("Fraction isn't allowed in this assessment.");
  expect(refusalMessage(['\\sqrt', '^', '\\pi'])).toBe("Square root, Powers and pi aren't allowed in this assessment.");
});

test('keyboard layouts follow the profile', () => {
  const all = keyboardLayouts(profile('everything'));
  const ids = (ls: ReturnType<typeof keyboardLayouts>) => ls.map((l) => (typeof l === 'string' ? l : l.id));
  expect(ids(all)).toEqual(['eb-basic', ...CATEGORIES.map((c) => `eb-${c.id}`), 'alphabetic']);
  const arith = profile('arithmetic');
  const layouts = keyboardLayouts(arith);
  expect(ids(layouts)).toEqual(['eb-basic', 'eb-fractions', 'eb-brackets', 'eb-operators', 'eb-relations', 'alphabetic']);
  // Every keycap a layout offers inserts only what the profile allows
  for (const l of layouts.filter((x) => typeof x !== 'string'))
    for (const row of (l as { rows: unknown[][] }).rows)
      for (const k of row) {
        const insert = typeof k === 'string' ? (k.startsWith('[') ? '' : k) : ((k as { insert?: string; latex?: string }).insert ?? (k as { latex?: string }).latex ?? '');
        expect(arith.refused(insert.replace(/#[?0@]/g, '')), `${l.id}: ${insert}`).toEqual([]);
      }
  // The basic layout leaves out the power key when powers aren't allowed
  expect(JSON.stringify(layouts[0])).not.toContain('^');
  expect(JSON.stringify(all[0])).toContain('^');
});
