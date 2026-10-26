// Records the events a <math-field> dispatches, for tests and the demo page.
export const MATHFIELD_EVENTS = [
  'beforeinput', 'input', 'change', 'selection-change', 'mode-change',
  'focus', 'blur', 'focusin', 'focusout', 'mount', 'unmount', 'move-out',
  'undo-state-change', 'keydown', 'read-aloud-status-change',
  'focus-out', 'select-out',
] as const;

export const KEYBOARD_EVENTS = [
  'before-virtual-keyboard-toggle', 'virtual-keyboard-toggle', 'geometrychange',
] as const;

export type Logged = { type: string; detail?: string };

export function recordEvents(target: EventTarget, types: readonly string[], log: Logged[]) {
  const ctrl = new AbortController();
  for (const type of types) {
    target.addEventListener(
      type,
      (e) => {
        const ev = e as Event & { inputType?: string; detail?: unknown; data?: string };
        let detail: string | undefined;
        if (ev.inputType) detail = ev.inputType;
        else if (ev.detail && typeof ev.detail === 'object') detail = JSON.stringify(ev.detail);
        else if (ev instanceof KeyboardEvent) detail = ev.key;
        log.push(detail ? { type, detail } : { type });
      },
      { signal: ctrl.signal }
    );
  }
  return () => ctrl.abort();
}

export const settle = () => new Promise((r) => setTimeout(r, 30));
