// The dialog's extension point, which the equation builder (M3) plugs into
// through the Froala option `mathEquationExtend`.
import { afterEach, expect, it } from 'vitest';
import type { MathfieldElement } from 'mathlive';
import type { DialogContext } from '../src';
import { createEditor, destroyEditor, eqs, rendered, stored, tick, type Editor } from './helpers';

let ed: Editor;
afterEach(() => ed && destroyEditor(ed));

it('gets the field and a slot, is told when the dialog opens, can stop a save, and is destroyed with the editor', async () => {
  const calls: string[] = [];
  let ctx: DialogContext | undefined;
  let refuse: string | null = 'Fill in the empty box, or delete it.';
  ed = await createEditor({
    mathEquationExtend(c: DialogContext) {
      ctx = c;
      c.slot.innerHTML = '<p class="palette">palette</p>';
      return {
        opened: () => calls.push(`opened ${c.field.getValue('latex')}`),
        validate: () => (calls.push('validate'), refuse),
        destroy: () => calls.push('destroy'),
      };
    },
  });
  ed.html.set(`<p>a ${await stored('x^2')}</p>`);
  await rendered(ed);
  expect(eqs(ed)).toHaveLength(1);
  expect(ctx).toBeUndefined(); // created with the dialog, on first use

  const done = ed.mathEquation.open(eqs(ed)[0]);
  const dialog = ed.mathEquation.dialog();
  expect(ctx!.field).toBe(dialog.field);
  expect(dialog.dialog.querySelector('.extension .palette')).not.toBeNull();
  // The slot sits between the field and the error line
  expect(ctx!.slot.previousElementSibling).toBe(dialog.field);
  expect(dialog.dialog.classList.contains('extended')).toBe(true);
  expect(calls).toEqual(['opened x^2']);

  (dialog.field as MathfieldElement).setValue('x^3');
  await dialog.confirm();
  expect(dialog.isOpen).toBe(true);
  expect(dialog.dialog.querySelector('.error')!.textContent).toBe('Fill in the empty box, or delete it.');

  refuse = null;
  await dialog.confirm();
  await done;
  await tick(50);
  expect(eqs(ed)[0].getAttribute('data-mathml')).toContain('x^3');
  expect(calls).toEqual(['opened x^2', 'validate', 'validate']);

  destroyEditor(ed);
  ed = undefined!;
  expect(calls.at(-1)).toBe('destroy');
});

it('without an extension the dialog is as before', async () => {
  ed = await createEditor();
  const dialog = ed.mathEquation.dialog();
  expect(dialog.dialog.classList.contains('extended')).toBe(false);
  expect(dialog.dialog.querySelector('.extension')!.childElementCount).toBe(0);
});
