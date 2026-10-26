// The custom virtual keyboard: MathLive layouts generated from the same
// palette and the same allowed-symbols profile as the panel, so the two can't
// drift apart.
//
// A text entry (chemistry, units) has no keyboard equivalent: a keycap
// inserts a fixed string or runs a command, and the field can't take typed
// text inside \ce{} or \mathrm{} (palette.ts).

import type { VirtualKeyboardLayout, VirtualKeyboardKeycap } from 'mathlive';
import type { Allowed } from './allowed';
import { displayLatex } from './palette';

type Keycap = Partial<VirtualKeyboardKeycap> | string;

const COLUMNS = 8;

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

/**
 * The first layout: digits, a few letters and the always-allowed signs, plus
 * whichever of × ÷ ^ / the profile allows.
 */
function basicLayout(allowed: Allowed): VirtualKeyboardLayout {
  // Without a tooltip, a keycap's aria-label is its LaTeX ("#@^{#?}"), so
  // template keys get one
  const ok = (latex: string, token: string): Keycap => (allowed.isAllowed(token) ? latex : '[separator]');
  return {
    id: 'eb-basic',
    label: '123',
    tooltip: 'Numbers',
    rows: [
      ['x', 'y', '[separator]', '7', '8', '9', '+', '-'],
      ['a', 'b', '[separator]', '4', '5', '6', ok('\\times', '\\times'), ok('\\div', '\\div')],
      ['n', '=', '[separator]', '1', '2', '3', '<', '>'],
      [
        allowed.isAllowed('^') ? { latex: '#@^{#?}', tooltip: 'Power' } : '[separator]',
        '(',
        ')',
        '0',
        '[.]',
        allowed.isAllowed('\\frac') ? { latex: '\\frac{#@}{#?}', tooltip: 'Fraction' } : '[separator]',
        '[left]',
        '[right]',
      ],
      ['[separator]', '[separator]', '[separator]', '[separator]', '[separator]', '[separator]', '[backspace]', '[hide-keyboard]'],
    ],
  };
}

/**
 * One keyboard layout per palette category the profile offers, between the
 * basic one and MathLive's own letters layout (a, b, x… are not enough for
 * \(b^2-4ac\)). MathLive's letters layout has no commands in it.
 */
export function keyboardLayouts(allowed: Allowed): (VirtualKeyboardLayout | 'alphabetic')[] {
  const layouts: (VirtualKeyboardLayout | 'alphabetic')[] = [basicLayout(allowed)];
  for (const c of allowed.categories) {
    if (!c.items.length) continue;
    const keys: Keycap[] = c.items.map((item) => ({
      latex: displayLatex(item),
      insert: item.insert,
      tooltip: item.label,
      class: item.insert.length > 24 ? 'small' : '',
    }));
    const rows = chunk(keys, COLUMNS);
    rows.push(['[left]', '[right]', '[separator]', '[separator]', '[separator]', '[separator]', '[backspace]', '[hide-keyboard]']);
    layouts.push({ id: `eb-${c.id}`, label: c.short, tooltip: c.label, rows });
  }
  layouts.push('alphabetic');
  return layouts;
}
