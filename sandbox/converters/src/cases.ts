import { corpus, type Case } from '../../basic/src/corpus';

// The M1 corpus plus cases for custom macros, which MathLive drops from its
// MathML (sandbox/basic/tests/lifecycle.test.ts).
export const MACROS = { R: '\\mathbb{R}', vecb: '\\mathbf{#1}' };

export const cases: Case[] = [
  ...corpus,
  { id: 'macro-R', category: 'Macros', latex: 'x\\in\\R' },
  { id: 'macro-vecb', category: 'Macros', latex: '\\vecb{v}+\\vecb{w}' },
];
