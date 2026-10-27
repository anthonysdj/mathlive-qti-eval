// Per-assessment "allowed symbols": which palette categories an author (or a
// candidate) gets, and which LaTeX may end up in the field at all.
//
// The palette decides what is offered; the token check decides what is
// accepted. Typing (`/` makes \frac, `sin` makes \sin), inline shortcuts and
// paste all bypass the palette, so the controller checks every change against
// the same token set (controller.ts).

import { CATEGORIES, type Category, type CategoryId, type PaletteItem } from './palette';

export interface AllowedProfile {
  id: string;
  label: string;
  /** Palette categories offered; every command their items use is allowed */
  categories: CategoryId[];
  /** Commands allowed on top of the categories, e.g. '\\pi' without all of Greek */
  extra?: string[];
  /** Commands refused even if a category uses them, e.g. '\\frac' in a "no fractions" item */
  blocked?: string[];
}

/**
 * Always allowed: grouping, spacing, slots and plain text. Letters, digits
 * and ASCII punctuation (+ - = < > ( ) [ ] | , . : ! ') aren't tokens at all.
 * Some ASCII keys come out as commands, so those are here too: `*` becomes
 * \cdot, `'` becomes \prime and `''` \doubleprime (tests/controller.test.ts
 * types them all).
 */
export const BASE_TOKENS = [
  '\\left', '\\right', '\\mleft', '\\mright', '\\placeholder', '\\text', '\\cdot', '\\prime', '\\doubleprime', '\\tripleprime',
  '\\,', '\\;', '\\:', '\\!', '\\ ', '\\quad', '\\qquad', '\\\\',
];

/**
 * The tokens a piece of LaTeX uses: each command (`\frac`), each
 * environment (`\begin{pmatrix}`), and `^` / `_` (powers and subscripts are
 * something an assessment may want to rule out). A `\left`/`\right`
 * delimiter that is a command counts as that command (`\lbrace`). The
 * inside of `\ce{…}` is mhchem's syntax, not LaTeX, so only `\ce` counts.
 * A prime is `f^{\prime}` to MathLive; that's \prime, not a power. (If
 * the `''` shortcut were switched off for lack of `^`, MathLive would
 * write `g^{\prime}^{\prime}`, a double superscript Temml refuses.)
 * Unicode characters aren't tokens: MathLive turns typed or pasted symbols
 * into their commands (π → \pi), which are.
 */
export function latexTokens(latex: string): Set<string> {
  const tokens = new Set<string>();
  const re = /\\begin\{([a-zA-Z*]+)\}|\\end\{[a-zA-Z*]+\}|\\[a-zA-Z]+|\\[^a-zA-Z]|[\^_]/g;
  const plain = latex.replace(/\\ce\{[^{}]*\}/g, '\\ce{}').replace(/\^\{?(\\(?:double|triple)?prime)\}?/g, '$1');
  for (const m of plain.matchAll(re)) {
    if (m[0].startsWith('\\end{')) continue;
    tokens.add(m[1] ? `\\begin{${m[1]}}` : m[0]);
  }
  return tokens;
}

/**
 * MathLive's own macros a template uses, as `latex-expanded` writes them.
 * The field's content is checked in that form.
 */
const EXPANDS: Record<string, string> = { '\\differentialD': '\\mathrm{d}' };

/** Tokens of a template, without MathLive's insert-syntax slots */
export function itemTokens(item: PaletteItem): Set<string> {
  let latex = item.insert.replace(/#[?0@]/g, '');
  for (const [macro, expanded] of Object.entries(EXPANDS)) latex = latex.replaceAll(macro, expanded);
  return latexTokens(latex);
}

/** Every token a palette entry can produce, for each category */
function categoryTokens(c: Category): string[] {
  const out = c.items.flatMap((i) => [...itemTokens(i)]);
  // Text entries wrap typed text: \ce{…}, \mathrm{…}
  if (c.id === 'chemistry') out.push('\\ce');
  if (c.id === 'units') out.push('\\mathrm');
  return out;
}

export interface Allowed {
  profile: AllowedProfile;
  /** The categories offered, in palette order, with items they'd refuse filtered out */
  categories: Category[];
  tokens: ReadonlySet<string>;
  isAllowed(token: string): boolean;
  /** Tokens in `latex` this profile refuses, in order of appearance */
  refused(latex: string): string[];
}

export function resolveAllowed(profile: AllowedProfile): Allowed {
  const blocked = new Set(profile.blocked ?? []);
  const tokens = new Set([...BASE_TOKENS, ...(profile.extra ?? [])]);
  for (const c of CATEGORIES) if (profile.categories.includes(c.id)) for (const t of categoryTokens(c)) tokens.add(t);
  for (const t of blocked) tokens.delete(t);
  const isAllowed = (t: string) => tokens.has(t);
  const categories = CATEGORIES.filter((c) => profile.categories.includes(c.id))
    .map((c) => ({ ...c, items: c.items.filter((i) => [...itemTokens(i)].every(isAllowed)) }))
    .filter((c) => c.items.length || c.entry);
  return {
    profile,
    categories,
    tokens,
    isAllowed,
    refused: (latex) => [...latexTokens(latex)].filter((t) => !isAllowed(t)),
  };
}

/** A token in words, for messages: the palette's label for it when there is one */
export function describeToken(token: string): string {
  if (token === '^') return 'Powers';
  if (token === '_') return 'Subscripts';
  if (token.startsWith('\\begin{')) return CATEGORIES.find((c) => c.items.some((i) => itemTokens(i).has(token)))?.label ?? token.slice(7, -1);
  for (const c of CATEGORIES)
    for (const i of c.items) {
      const t = itemTokens(i);
      if (t.has(token) && [...t].filter((x) => !BASE_TOKENS.includes(x)).length === 1) return i.label;
    }
  return token;
}

// Example profiles for the demo; a real authoring tool would store one per
// assessment (or per item) next to the item's other settings.
export const PROFILES: AllowedProfile[] = [
  {
    id: 'everything',
    label: 'Everything',
    categories: CATEGORIES.map((c) => c.id),
  },
  {
    id: 'arithmetic',
    label: 'Primary arithmetic',
    categories: ['fractions', 'brackets', 'operators', 'relations'],
    blocked: ['\\infty', '\\pm', '\\mp', '\\equiv', '\\propto', '\\Rightarrow', '\\Leftrightarrow', '\\to', '\\Vert', '\\langle', '\\rangle', '\\lfloor', '\\rfloor', '\\lceil', '\\rceil'],
  },
  {
    id: 'algebra',
    label: 'Secondary algebra',
    categories: ['fractions', 'roots', 'scripts', 'brackets', 'operators', 'relations', 'functions', 'geometry'],
    extra: ['\\pi', '\\theta', '\\alpha', '\\beta'],
  },
  {
    id: 'calculus',
    label: 'Calculus',
    categories: ['fractions', 'roots', 'scripts', 'brackets', 'operators', 'relations', 'greek', 'functions', 'calculus', 'bigops', 'matrices', 'decorations', 'sets'],
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    categories: ['fractions', 'scripts', 'brackets', 'operators', 'relations', 'chemistry', 'units'],
    extra: ['\\Delta', '\\mu', '\\lambda'],
  },
];
