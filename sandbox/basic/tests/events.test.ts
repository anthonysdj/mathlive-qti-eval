// Event order of <math-field> in MathLive 0.111.1 (Chromium). Recorded with
// tests/events-dump.test.ts and summarised in docs/01-how-mathfield-works.md.
import { afterEach, beforeEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { MathfieldElement } from 'mathlive';
import { MATHFIELD_EVENTS, recordEvents, type Logged } from '../src/event-log';

// focus() completes on a 60 ms timer inside MathLive (mathfield-private.ts,
// onFocus), so tests wait longer than that.
const wait = (ms = 100) => new Promise((r) => setTimeout(r, ms));
const types = (log: Logged[]) => log.map((e) => e.type).filter((t) => t !== 'keydown');

let mf: MathfieldElement;
let other: HTMLInputElement;
let log: Logged[];
let stop: () => void;

beforeEach(async () => {
  mf = new MathfieldElement();
  other = document.createElement('input');
  log = [];
  stop = recordEvents(mf, MATHFIELD_EVENTS, log);
  document.body.append(mf, other);
  await wait();
});
afterEach(() => {
  stop();
  mf.remove();
  other.remove();
});

it('fires mount asynchronously after connection', async () => {
  const fresh = new MathfieldElement();
  const seen: string[] = [];
  fresh.addEventListener('mount', () => seen.push('mount'));
  document.body.append(fresh);
  expect(seen).toEqual([]); // queued as a microtask
  await Promise.resolve();
  expect(seen).toEqual(['mount']);
  fresh.remove();
});

it('programmatic value / setValue fire no events, but insert() does', async () => {
  log.length = 0;
  mf.value = 'x+1';
  mf.setValue('y');
  await wait();
  expect(types(log)).toEqual([]);

  mf.insert('\\frac{1}{2}');
  await wait();
  expect(types(log)).toEqual(['beforeinput', 'selection-change', 'undo-state-change', 'input']);
});

it('typing: beforeinput → selection-change → undo-state-change → input (input is deferred)', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  await userEvent.keyboard('2');
  await wait();
  expect(types(log)).toEqual(['beforeinput', 'selection-change', 'undo-state-change', 'input']);
  expect(log.find((e) => e.type === 'input')?.detail).toBe('insertText');
});

it('for command keys (Enter, arrows) host keydown listeners run AFTER MathLive acted', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  await userEvent.keyboard('{Enter}');
  await wait();
  const order = log.map((e) => e.type);
  expect(order.indexOf('keydown')).toBeGreaterThan(order.indexOf('change'));
});

it('a capture-phase keydown listener on the host can veto a key', async () => {
  mf.focus();
  await wait();
  mf.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); }
    },
    { capture: true }
  );
  log.length = 0;
  await userEvent.keyboard('{Enter}');
  await wait();
  expect(types(log)).not.toContain('change');
});

it('Enter fires change (before keydown) and an insertLineBreak input', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  await userEvent.keyboard('{Enter}');
  await wait();
  expect(types(log)).toEqual(['beforeinput', 'change', 'input']);
  expect(log.at(-1)?.detail).toBe('insertLineBreak');
});

it('blur after an edit fires change → blur → focusout', async () => {
  mf.focus();
  await wait();
  await userEvent.keyboard('x');
  await wait();
  log.length = 0;
  other.focus();
  await wait();
  expect(types(log)).toEqual(['change', 'blur', 'focusout']);
});

it('blur without an edit fires no change', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  other.focus();
  await wait();
  expect(types(log)).toEqual(['blur', 'focusout']);
});

it('a blur within 60 ms of focus() is swallowed silently', async () => {
  log.length = 0;
  mf.focus();
  await wait(10);
  other.focus();
  await wait();
  expect(types(log)).not.toContain('blur');
  expect(mf.hasFocus()).toBe(false);
});

it('typing "\\" enters LaTeX mode: mode-change', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  await userEvent.keyboard('\\');
  await wait();
  expect(types(log)[0]).toBe('mode-change');
  expect(mf.mode).toBe('latex');
});

it('arrowing past the start fires move-out', async () => {
  mf.focus();
  await wait();
  await userEvent.keyboard('{Home}');
  log.length = 0;
  await userEvent.keyboard('{ArrowLeft}');
  await wait();
  expect(log.find((e) => e.type === 'move-out')?.detail).toBe('{"direction":"backward"}');
});

it('default inline shortcut: typing "pi" gives \\pi', async () => {
  mf.focus();
  await wait();
  await userEvent.keyboard('pi');
  await wait();
  expect(mf.value).toBe('\\pi');
});

it('showing the virtual keyboard makes the field blur and refocus', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  window.mathVirtualKeyboard.show();
  await wait();
  window.mathVirtualKeyboard.hide();
  await wait();
  expect(types(log)).toEqual(['blur', 'focusout', 'focus', 'focusin', 'blur', 'focusout', 'focus', 'focusin']);
});

it('removing a focused field fires blur → focusout → unmount', async () => {
  mf.focus();
  await wait();
  log.length = 0;
  mf.remove();
  await wait();
  expect(types(log)).toEqual(['blur', 'focusout', 'unmount']);
});
