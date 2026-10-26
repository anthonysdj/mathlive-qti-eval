// Destroying the editor must not leave listeners, dialogs or a moved
// virtual keyboard behind (the Angular component creates and destroys
// editors as the author navigates).
import { describe, expect, it } from 'vitest';
import { toEditorHtml } from '../src';
import { createEditor, destroyEditor, eqs, rendered, stored, tick } from './helpers';

// Count listeners on the long-lived targets: window, document, <body>.
// Listeners also go away without removeEventListener: when their AbortSignal
// aborts, and after the first call for `once` listeners. Both are counted.
const live = new Map<string, number>();
const watched = () => [window, document, document.body] as EventTarget[];
const name = (t: EventTarget) => (t === window ? 'window' : t === document ? 'document' : 'body');
const bump = (k: string, d: number) => live.set(k, (live.get(k) ?? 0) + d);
const add = EventTarget.prototype.addEventListener;
const remove = EventTarget.prototype.removeEventListener;
EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, fn: any, opts?: any) {
  if (!watched().includes(this) || !fn) return add.call(this, type, fn, opts);
  const k = `${name(this)}:${type}`;
  let gone = false;
  const done = () => {
    if (!gone) bump(k, -1);
    gone = true;
  };
  bump(k, 1);
  if (typeof opts === 'object' && opts?.signal) opts.signal.addEventListener('abort', done);
  if (typeof opts === 'object' && opts?.once) {
    const orig = fn;
    fn = function (this: unknown, ev: Event) {
      done();
      return typeof orig === 'function' ? orig.call(this, ev) : orig.handleEvent(ev);
    };
  }
  return add.call(this, type, fn, opts);
};
EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, fn: any, opts?: any) {
  if (watched().includes(this) && fn) bump(`${name(this)}:${type}`, -1);
  return remove.call(this, type, fn, opts);
};
const snapshot = () => new Map(live);
const grownSince = (before: Map<string, number>) =>
  [...live].filter(([k, v]) => v !== (before.get(k) ?? 0)).map(([k, v]) => `${k} ${v - (before.get(k) ?? 0) > 0 ? '+' : ''}${v - (before.get(k) ?? 0)}`);

async function cycle(withPlugin: boolean, openDialog: 'cancel' | 'leave-open' | 'none') {
  const ed = await createEditor(withPlugin ? {} : { pluginsEnabled: [] });
  if (withPlugin) {
    ed.html.set(toEditorHtml(`<p>a ${await stored('x^2')} b</p>`));
    await rendered(ed);
    if (openDialog !== 'none') {
      eqs(ed)[0].click();
      await tick(80);
      if (openDialog === 'cancel') ed.mathEquation.dialog().cancel();
    }
  }
  destroyEditor(ed);
  await tick(20);
}

describe('teardown', () => {
  it('20 create → edit → destroy cycles leave no listeners, dialogs or keyboard changes behind', async () => {
    await cycle(true, 'cancel'); // first run: MathLive, Froala and MathJax set up their one-time globals
    document.dispatchEvent(new FocusEvent('focusin')); // see below
    const before = snapshot();
    for (let i = 0; i < 20; i++) await cycle(true, i % 2 ? 'cancel' : 'leave-open');
    // MathLive 0.111.1 adds three one-shot listeners (window blur, document
    // focusin and click) each time a field loses focus, also when it is
    // removed (restoreFocusWhenDocumentFocused). They keep the removed field
    // alive until the next click or focus anywhere on the page, then go: the
    // next cycle's click clears the previous ones, and this focusin the last.
    document.dispatchEvent(new FocusEvent('focusin'));
    expect(grownSince(before)).toEqual([]);
    expect(document.querySelectorAll('dialog')).toHaveLength(0);
    expect(document.querySelectorAll('.fr-box, math-eq')).toHaveLength(0);
    expect(window.mathVirtualKeyboard.visible).toBe(false);
  });

  it('Froala alone, for comparison, also leaves nothing behind', async () => {
    await cycle(false, 'none');
    const before = snapshot();
    for (let i = 0; i < 20; i++) await cycle(false, 'none');
    expect(grownSince(before)).toEqual([]);
  });

  it('destroying the editor while the dialog is open closes it and changes nothing', async () => {
    const ed = await createEditor();
    ed.html.set(toEditorHtml(`<p>a ${await stored('x^2')} b</p>`));
    eqs(ed)[0].click();
    await tick(80);
    const dlg = ed.mathEquation.dialog().dialog;
    expect(dlg.open).toBe(true);
    destroyEditor(ed);
    await tick(20);
    expect(dlg.isConnected).toBe(false);
  });
});
