// Spoken text and braille for every stored formula, made from the stored
// MathML (not from LaTeX) with speech-rule-engine, the engine inside MathJax's
// accessibility tools. This is our equivalent of MathType's accessibility
// service, which writes the alt text of its formula images: it runs on a
// server (or in the browser), with no outside service. Reads the MathML that
// `pnpm dump` recorded in findings/wiris-parity-raw.json; writes
// findings/wiris-speech.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

// The package's CommonJS build: its ES module index also loads the
// command-line tool (and `commander`), and its system.js alone finds no
// locale files under Vitest, so every text comes back empty.
const sre = createRequire(import.meta.url)('speech-rule-engine');

type Row = { id: string; name: string; latex: string; mathml?: string; spokenText: string };
const raw = new URL('../../../findings/wiris-parity-raw.json', import.meta.url);
const rows: Row[] = JSON.parse(readFileSync(raw, 'utf8')).rows.filter((r: Row) => r.mathml);

const SPEECH = ['en', 'es', 'fr', 'de', 'it'] as const;
// SRE's 'euro' braille (LaTeX-based) gave empty output for some formulas (brackets), so only Nemeth is checked
const BRAILLE = ['nemeth'] as const;
type Locale = (typeof SPEECH)[number] | (typeof BRAILLE)[number];

const out: Record<string, Partial<Record<Locale | 'mathlive', string>>> = {};

async function speak(locale: Locale, mathml: string) {
  const braille = (BRAILLE as readonly string[]).includes(locale);
  await sre.setupEngine({ locale, modality: braille ? 'braille' : 'speech', domain: braille ? 'default' : 'clearspeak' });
  await sre.engineReady();
  return sre.toSpeech(mathml);
}

describe('alt text from stored MathML (speech-rule-engine 5.0.0-rc.4)', () => {
  beforeAll(() => {
    for (const r of rows) out[r.id] = { mathlive: r.spokenText };
  });

  for (const locale of [...SPEECH, ...BRAILLE]) {
    it(`${locale}: every formula`, async () => {
      for (const r of rows) {
        const s = await speak(locale, r.mathml!);
        out[r.id][locale] = s;
        expect(s.trim(), r.id).not.toBe('');
      }
    }, 60_000);
  }

  it('reads what MathLive could not (chemistry, aligned steps, boxed)', () => {
    // MathLive's spoken text is empty for these (tests/notation.test.ts)
    expect(out['ce-reaction'].en).toMatch(/H.*2.*O/);
    expect(out['ce-reaction'].en).toMatch(/right(wards)? arrow|yields/i);
    expect(out['align'].en).toMatch(/a plus b/);
    expect(out['boxed'].en).toMatch(/x equals 2/);
  });

  it('reads structure that MathLive drops', () => {
    // MathLive: "'F' of 'X' equals" (the cases are lost); "of 'X' plus of 'Y'" for floor/ceiling
    expect(out['cases'].en).toMatch(/2 cases/);
    expect(out['floor'].en).toMatch(/floor of x/);
    expect(out['arrowlabel'].en).toMatch(/over/);
  });

  it('writes findings/wiris-speech.json', () => {
    writeFileSync(new URL('../../../findings/wiris-speech.json', import.meta.url), JSON.stringify(out, null, 1));
  });
});
