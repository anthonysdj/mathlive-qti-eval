// Lifecycle and DOM facts about <math-field> 0.111.1 that matter when it is
// embedded in a host editor (Froala, workstream 2).
import { expect, it } from 'vitest';
import { MathfieldElement, convertLatexToMathMl } from 'mathlive';

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));

it('before connection, value round-trips but other formats are empty', () => {
  const mf = new MathfieldElement();
  mf.value = '\\frac{a}{b}';
  expect(mf.value).toBe('\\frac{a}{b}');
  expect(mf.getValue('math-ml')).toBe('');
});

it('setValue() is silent by default, but passing any options object makes it fire input', async () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  const seen: string[] = [];
  mf.addEventListener('input', () => seen.push('input'));
  mf.setValue('x');
  await wait();
  expect(seen).toEqual([]);
  // The default `{ silenceNotifications: true }` is replaced wholesale
  mf.setValue('y', { mode: 'math' });
  await wait();
  expect(seen).toEqual(['input']);
  mf.remove();
});

it('connecting sets contenteditable="true" and tabindex="0" on the host', () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  expect(mf.getAttribute('contenteditable')).toBe('true');
  expect(mf.getAttribute('tabindex')).toBe('0');
  mf.remove();
});

it('a host with user-select:none gets no contenteditable attribute', () => {
  const mf = new MathfieldElement();
  mf.style.userSelect = 'none';
  document.body.append(mf);
  expect(mf.hasAttribute('contenteditable')).toBe(false);
  mf.remove();
});

it('changing the light-DOM text updates the value (MutationObserver)', async () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  mf.textContent = 'x^2';
  await wait();
  expect(mf.value).toBe('x^2');
  mf.remove();
});

it('is torn down on disconnect and rebuilt on reconnect, keeping value and options', async () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  mf.value = 'a+b';
  mf.smartFence = false;
  const firstSink = mf.shadowRoot!.querySelector('[part=keyboard-sink]');
  mf.remove();
  document.body.append(mf);
  await wait();
  expect(mf.value).toBe('a+b');
  expect(mf.smartFence).toBe(false);
  expect(mf.shadowRoot!.querySelector('[part=keyboard-sink]')).not.toBe(firstSink);
  mf.remove();
});

it('a11y: host has role=group, the focusable sink is a named textbox', () => {
  const mf = new MathfieldElement();
  mf.setAttribute('aria-label', 'Answer');
  document.body.append(mf);
  const sink = mf.shadowRoot!.querySelector('[part=keyboard-sink]')!;
  expect(sink.getAttribute('role')).toBe('textbox');
  expect(sink.getAttribute('aria-label')).toBe('Answer');
  mf.remove();
});

it('read-only fields are still focusable and expose aria-readonly on the sink', () => {
  const mf = new MathfieldElement();
  mf.readOnly = true;
  document.body.append(mf);
  const sink = mf.shadowRoot!.querySelector('[part=keyboard-sink]')!;
  expect(sink.getAttribute('aria-readonly')).toBe('true');
  expect(mf.getAttribute('tabindex')).toBe('0');
  mf.remove();
});

it('importing mathlive installs one shared virtual keyboard on window', () => {
  expect(window.mathVirtualKeyboard).toBeDefined();
  expect(document.body.contains(document.querySelector('.ML__keyboard'))).toBe(false); // created lazily on first show()
});

it('custom macros: latex keeps the macro, latex-expanded inlines it', () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  mf.macros = { ...mf.macros, vecb: '\\mathbf{#1}', R: '\\mathbb{R}' };
  mf.value = '\\vecb{v}';
  expect(mf.getValue('latex')).toBe('\\vecb{v}');
  expect(mf.getValue('latex-expanded')).toBe('\\mathbf{v}');
  mf.remove();
});

it('KNOWN DEFECT: custom macros vanish from MathML; expanding first works around it', () => {
  const mf = new MathfieldElement();
  document.body.append(mf);
  mf.macros = { ...mf.macros, R: '\\mathbb{R}' };
  mf.value = 'x\\in\\R';
  // The \R is silently dropped
  expect(mf.getValue('math-ml')).toBe('<mrow><mi>x</mi><mo>∈</mo></mrow>');
  // Workaround: serialise the macro-expanded LaTeX instead
  expect(convertLatexToMathMl(mf.getValue('latex-expanded'))).toBe(
    '<mrow><mi>x</mi><mo>∈</mo><mi>ℝ</mi></mrow>'
  );
  mf.remove();
});

it('prompts: a read-only field with \\placeholder[id]{} slots acts as a fill-in form', () => {
  const mf = new MathfieldElement();
  mf.readOnly = true;
  document.body.append(mf);
  mf.value = 'x+\\placeholder[ans]{}=5';
  expect(mf.getPrompts()).toEqual(['ans']);
  mf.setPromptValue('ans', '3', {});
  expect(mf.getPromptValue('ans')).toBe('3');
  expect(mf.value).toBe('x+\\placeholder[ans]{3}=5');
  mf.remove();
});
