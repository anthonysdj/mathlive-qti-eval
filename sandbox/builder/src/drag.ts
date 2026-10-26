// Drag and drop from the palette into a <math-field>: drag a piece, drop it
// between two others or onto an empty box of a piece dropped earlier, and
// keep going until the formula is built.
//
// MathLive has no drop support of its own. It does say which caret offset is
// under a point (getOffsetFromPoint) and where each atom is drawn
// (getElementInfo(offset).bounds, in client coordinates), which is all this
// needs: the drop goes in as a normal insert at that offset, so the
// allowed-symbols check, undo and the stored MathML work as for a click.
// An empty box (\placeholder{}) is an atom of its own, and inserting at its
// offset replaces it (tests/drag.test.ts).
//
// Pointer events rather than HTML drag and drop: one code path for mouse,
// pen and touch (HTML drag and drop doesn't start from a touch in most
// mobile browsers), and the piece under the pointer can be drawn as it will
// look. A press that doesn't move is still a click, so the palette keeps
// inserting at the caret for keyboard and switch users.

import type { MathfieldElement } from 'mathlive';
import type { PaletteItem } from './palette';

export interface DropTarget {
  /** Caret offset in the field to insert at */
  offset: number;
  /** The drop replaces an empty box */
  slot: boolean;
  /** What to highlight, in client coordinates: the box, or a caret-sized line */
  rect: DOMRect;
}

/** How far (px) a press has to move before it is a drag rather than a click */
const THRESHOLD = 6;
/** Pointer this close (px) to the field still drops into it */
const MARGIN = 12;

/** Where a piece dropped at (x, y), in client coordinates, would go; null if not over the field */
export function dropTargetAt(field: MathfieldElement, x: number, y: number): DropTarget | null {
  const r = field.getBoundingClientRect();
  if (x < r.left - MARGIN || x > r.right + MARGIN || y < r.top - MARGIN || y > r.bottom + MARGIN) return null;
  const offset = field.getOffsetFromPoint(x, y);
  if (offset < 0) return null;
  const info = field.getElementInfo(offset);
  const b = boundsOf(field, offset);
  if (!b) return { offset, slot: false, rect: new DOMRect(r.left + 4, r.top + 4, 2, r.height - 8) };
  if (info?.latex === '\\placeholder{}') return { offset, slot: true, rect: DOMRect.fromRect(b) };
  // Offset n is the caret after atom n: its right edge. The start of a
  // branch (numerator, exponent...) has a zero-width atom; empty field, the
  // field's whole content box.
  // Kept inside the field: a tall atom's box (a fraction with a root in it)
  // reaches above it.
  const at = b.width < 0 ? b.left : offset === 0 ? b.left : b.right;
  const top = Math.max(b.top, r.top + 4);
  const bottom = Math.min(b.bottom, r.bottom - 4);
  return { offset, slot: false, rect: new DOMRect(at - 1, top, 2, bottom - top) };
}

/**
 * Where the atom ending at `offset` is drawn. MathLive gives no bounds for a
 * superscript/subscript atom (x^2 is atoms x, then ^2 holding 2), so for
 * those it is the box around its contents and the base before it.
 */
function boundsOf(field: MathfieldElement, offset: number): DOMRect | undefined {
  const info = field.getElementInfo(offset);
  if (!info || info.bounds) return info?.bounds;
  const depth = info.depth ?? 0;
  const boxes: DOMRect[] = [];
  for (let o = offset - 1; o >= 0; o--) {
    const i = field.getElementInfo(o);
    if ((i?.depth ?? 0) <= depth) {
      if (i?.bounds) boxes.push(i.bounds); // the base
      break;
    }
    if (i?.bounds && i.bounds.width >= 0) boxes.push(i.bounds);
  }
  if (!boxes.length) return undefined;
  const left = Math.min(...boxes.map((r) => r.left));
  const top = Math.min(...boxes.map((r) => r.top));
  return new DOMRect(left, top, Math.max(...boxes.map((r) => r.right)) - left, Math.max(...boxes.map((r) => r.bottom)) - top);
}

/**
 * The insert string for a dropped piece. A click inserts at the caret, where
 * `#@` takes the term before it (3x, then x² gives 3x²). A drop is placed by
 * hand: a power or subscript still attaches to what it is dropped after,
 * but a fraction dropped after a 2 gets an empty numerator rather than
 * swallowing the 2.
 */
export function dropInsert(item: PaletteItem): string {
  return item.insert.startsWith('#@') ? item.insert : item.insert.replaceAll('#@', '#?');
}

export interface PaletteDragOptions {
  /** The field pieces are dropped into */
  field(): MathfieldElement | null;
  /** The palette item a key (an element with data-item="id") stands for */
  item(id: string): PaletteItem | undefined;
  /** Put the item in at the offset */
  drop(item: PaletteItem, target: DropTarget): void;
  /** Called on start (item) and end (null) of each drag, e.g. to describe it */
  onDrag?(item: PaletteItem | null): void;
}

/**
 * Makes every `[data-item]` element inside `root` draggable into the field.
 * Delegated, so keys the host re-renders (another tab) need nothing.
 */
export class PaletteDrag {
  #root: HTMLElement;
  #opts: PaletteDragOptions;
  #abort = new AbortController();
  #drag: {
    id: number;
    key: HTMLElement;
    item: PaletteItem;
    x0: number;
    y0: number;
    started: boolean;
    target: DropTarget | null;
    ghost?: HTMLElement;
    mark?: HTMLElement;
    end: AbortController;
  } | null = null;

  constructor(root: HTMLElement, opts: PaletteDragOptions) {
    this.#root = root;
    this.#opts = opts;
    root.addEventListener('pointerdown', (e) => this.#down(e), { signal: this.#abort.signal });
  }

  /** A drag is in progress */
  get dragging(): boolean {
    return !!this.#drag?.started;
  }

  #down(e: PointerEvent) {
    if (this.#drag || !e.isPrimary || e.button !== 0) return;
    const key = (e.target as Element).closest<HTMLElement>('[data-item]');
    const item = key && this.#root.contains(key) ? this.#opts.item(key.dataset.item!) : undefined;
    if (!key || !item) return;
    const end = new AbortController();
    this.#drag = { id: e.pointerId, key, item, x0: e.clientX, y0: e.clientY, started: false, target: null, end };
    const signal = end.signal;
    // On the window: the pointer leaves the key, and a touch keeps sending
    // to the element it started on
    window.addEventListener('pointermove', (ev) => ev.pointerId === e.pointerId && this.#move(ev), { signal });
    window.addEventListener('pointerup', (ev) => ev.pointerId === e.pointerId && this.#up(ev), { signal });
    window.addEventListener('pointercancel', (ev) => ev.pointerId === e.pointerId && this.#cancel(), { signal });
    window.addEventListener(
      'keydown',
      (ev) => {
        if (ev.key !== 'Escape' || !this.#drag?.started) return;
        ev.preventDefault();
        ev.stopPropagation(); // not the dialog's Escape
        this.#cancel();
      },
      { signal, capture: true }
    );
  }

  #move(e: PointerEvent) {
    const d = this.#drag!;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < THRESHOLD) return;
      d.started = true;
      d.ghost = ghostOf(d.key);
      d.mark = document.createElement('div');
      d.mark.className = 'eb-drop-mark';
      for (const el of [d.ghost, d.mark]) onTop(el);
      document.documentElement.classList.add('eb-dragging');
      this.#opts.onDrag?.(d.item);
    }
    e.preventDefault();
    const w = d.ghost!.offsetWidth;
    d.ghost!.style.transform = `translate(${e.clientX - w / 2}px, ${e.clientY - d.ghost!.offsetHeight - 8}px)`;
    const field = this.#opts.field();
    d.target = field ? dropTargetAt(field, e.clientX, e.clientY) : null;
    field?.classList.toggle('eb-drop-over', !!d.target);
    showMark(d.mark!, d.target);
  }

  #up(e: PointerEvent) {
    const d = this.#drag!;
    if (!d.started) return this.#finish(); // a click: the key's own handler inserts at the caret
    this.#move(e);
    const { item, target } = d;
    // The click that follows a drag isn't an insert at the caret
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
    this.#finish();
    if (target) this.#opts.drop(item, target);
  }

  #cancel() {
    this.#finish();
  }

  #finish() {
    const d = this.#drag;
    if (!d) return;
    this.#drag = null;
    d.end.abort();
    d.ghost?.remove();
    d.mark?.remove();
    this.#opts.field()?.classList.remove('eb-drop-over');
    document.documentElement.classList.remove('eb-dragging');
    if (d.started) this.#opts.onDrag?.(null);
  }

  detach() {
    this.#finish();
    this.#abort.abort();
  }
}

// The ghost and the drop mark live in <body>, outside any component's
// styles, so they carry their own. Colours come from the builder's --eb-*
// properties when the host sets them on :root.

/**
 * Add to <body> above everything. The palette is usually in a modal
 * <dialog>, which is in the browser's top layer: anything else in <body>,
 * whatever its z-index, is drawn under it. A manual popover is in the top
 * layer too, and shown after the dialog, so above it.
 */
function onTop(el: HTMLElement) {
  document.body.append(el);
  if (!('showPopover' in el)) return;
  el.popover = 'manual';
  // Undo the popover's own UA styles (centred, bordered box)
  Object.assign(el.style, { right: 'auto', bottom: 'auto', margin: '0', overflow: 'visible' });
  el.showPopover();
}
function ghostOf(key: HTMLElement): HTMLElement {
  const g = key.cloneNode(true) as HTMLElement;
  g.removeAttribute('id');
  g.setAttribute('aria-hidden', 'true');
  g.className = 'eb-drag-ghost';
  Object.assign(g.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
    minWidth: '44px',
    minHeight: '44px',
    padding: '4px 8px',
    font: '16px system-ui, sans-serif',
    border: '1px solid var(--eb-accent, #0b5fff)',
    borderRadius: 'var(--eb-radius, 6px)',
    background: 'var(--eb-surface, #fff)',
    color: 'var(--eb-text, #1d2433)',
    boxShadow: '0 6px 18px rgb(0 0 0 / 0.18)',
    opacity: '0.92',
  });
  return g;
}

function showMark(mark: HTMLElement, t: DropTarget | null) {
  if (!t) {
    mark.style.display = 'none';
    return;
  }
  const pad = t.slot ? 2 : 0;
  Object.assign(mark.style, {
    display: 'block',
    position: 'fixed',
    zIndex: '2147483646',
    pointerEvents: 'none',
    border: 'none',
    padding: '0',
    left: `${t.rect.left - pad}px`,
    top: `${t.rect.top - pad}px`,
    width: `${t.rect.width + 2 * pad}px`,
    height: `${t.rect.height + 2 * pad}px`,
    borderRadius: t.slot ? '4px' : '1px',
    background: t.slot ? 'color-mix(in srgb, var(--eb-accent, #0b5fff) 22%, transparent)' : 'var(--eb-accent, #0b5fff)',
    outline: t.slot ? '2px solid var(--eb-accent, #0b5fff)' : 'none',
  });
  mark.dataset.slot = String(t.slot);
}
