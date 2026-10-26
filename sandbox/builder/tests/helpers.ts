import { MathfieldElement } from 'mathlive';
import { userEvent } from 'vitest/browser';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';

MathfieldElement.soundsDirectory = null;

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** A focused, empty <math-field> in the page */
export async function newField(): Promise<MathfieldElement> {
  await loadTemmlMhchem();
  const mf = new MathfieldElement();
  mf.mathVirtualKeyboardPolicy = 'manual';
  document.body.append(mf);
  mf.focus();
  await tick(80); // focus() completes on a timer (M1)
  return mf;
}

/** Replace the field's content and put the caret at the end, without an input event */
export function setLatex(mf: MathfieldElement, latex: string) {
  mf.setValue(latex, { silenceNotifications: true });
  mf.position = mf.lastOffset;
}

/**
 * Real key presses into the focused field. MathLive sends 'input' a moment
 * after a burst of keys, so wait for it. Avoid `|` here: userEvent sends it
 * without Shift, and MathLive reads the Backslash key as `\` (the Angular
 * check types it with Playwright's real keyboard instead).
 */
export async function type(keys: string) {
  await userEvent.keyboard(keys);
  await tick(30);
}
