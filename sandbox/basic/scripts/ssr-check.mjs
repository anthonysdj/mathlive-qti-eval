// What MathLive offers when imported in Node (SSR / Angular server build).
// Usage: node scripts/ssr-check.mjs
const main = await import('mathlive');
const ssr = await import('mathlive/ssr');
console.log('exports of "mathlive" under Node:', Object.keys(main).sort().join(', '));
console.log('MathfieldElement available:', 'MathfieldElement' in main);
console.log('same module as mathlive/ssr:', main.convertLatexToMarkup === ssr.convertLatexToMarkup);
const tex = '\\frac{a}{b}';
const tryIt = (name, fn) => {
  try {
    const out = fn();
    console.log(`${name}: OK (${out.length} chars) ${out.slice(0, 70)}…`);
  } catch (e) {
    console.log(`${name}: THROWS ${e.constructor.name}: ${e.message}`);
  }
};
tryIt('convertLatexToMarkup', () => ssr.convertLatexToMarkup(tex));
tryIt('convertLatexToMathMl', () => ssr.convertLatexToMathMl(tex));
tryIt('convertLatexToAsciiMath', () => ssr.convertLatexToAsciiMath(tex));
tryIt('convertAsciiMathToLatex', () => ssr.convertAsciiMathToLatex('a/b'));
tryIt('convertLatexToSpeakableText', () => ssr.convertLatexToSpeakableText(tex));
tryIt('validateLatex', () => JSON.stringify(ssr.validateLatex('\\frac{a}')));
// Workaround: the speakable-text converter reads its settings from a global
// MathfieldElement that only exists in the browser build.
globalThis.MathfieldElement = { textToSpeechRules: 'mathlive', textToSpeechMarkup: '', textToSpeechRulesOptions: {} };
tryIt('convertLatexToSpeakableText (with stub global)', () => ssr.convertLatexToSpeakableText(tex));
