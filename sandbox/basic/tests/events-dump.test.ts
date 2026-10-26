import { test } from 'vitest';
import { userEvent, commands } from 'vitest/browser';
import { MathfieldElement } from 'mathlive';
import { KEYBOARD_EVENTS, MATHFIELD_EVENTS, recordEvents, settle, type Logged } from '../src/event-log';

test.runIf(import.meta.env.VITE_PROBE)('dump events', async () => {
  const out: Record<string, Logged[]> = {};
  const log: Logged[] = [];
  const step = async (name: string, fn: () => unknown) => {
    log.length = 0;
    await fn();
    await settle();
    await new Promise((r) => requestAnimationFrame(r));
    await settle();
    out[name] = [...log];
  };
  const mf = new MathfieldElement();
  const stop = recordEvents(mf, MATHFIELD_EVENTS, log);
  const stopKbd = recordEvents(window.mathVirtualKeyboard, KEYBOARD_EVENTS, log);
  const other = document.createElement('input');
  document.body.append(other);

  await step('append to DOM', () => document.body.append(mf));
  await step('mf.value = (not focused)', () => { mf.value = 'x+1'; });
  await step('setValue() default', () => mf.setValue('y'));
  await step('insert()', () => mf.insert('\\frac{1}{2}'));
  await step('focus()', () => mf.focus());
  await step('type "2"', () => userEvent.keyboard('2'));
  await step('ArrowLeft', () => userEvent.keyboard('{ArrowLeft}'));
  await step('Home then ArrowLeft (edge)', async () => { await userEvent.keyboard('{Home}'); await userEvent.keyboard('{ArrowLeft}'); });
  await step('Enter', () => userEvent.keyboard('{Enter}'));
  await step('type "\\\\" (latex mode)', () => userEvent.keyboard('\\'));
  await step('Escape', () => userEvent.keyboard('{Escape}'));
  await step('executeCommand undo', () => mf.executeCommand('undo'));
  await step('type "pi" (inline shortcut)', () => userEvent.keyboard('pi'));
  await step('show keyboard', () => window.mathVirtualKeyboard.show());
  await step('hide keyboard', () => window.mathVirtualKeyboard.hide());
  await step('blur by focusing other input', () => other.focus());
  await step('focus + blur without edit', async () => { mf.focus(); await settle(); other.focus(); });
  await step('remove from DOM', () => mf.remove());
  stop(); stopKbd();
  out['__value'] = [{ type: mf.value }];
  await commands.writeFile('../../findings/events-raw.json', JSON.stringify(out, null, 2));
});
