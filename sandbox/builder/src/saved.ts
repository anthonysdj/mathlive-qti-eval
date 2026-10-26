// Equations an author saved to reuse: "My equations" in the palette (click
// or drag, like any piece) and, optionally, a typed shortcut that inserts
// it (type `quadf` and the quadratic formula appears).
//
// A saved equation is the field's LaTeX at the moment it was saved. Empty
// boxes stay empty boxes (\placeholder{} → #?), so an equation saved half
// built is a template: Tab moves between its boxes after inserting it.
// The shortcut is an inline shortcut, so it inserts plain LaTeX and the
// stored MathML never depends on it (notation.ts).
//
// Where they are kept is up to the host (SavedStorage). The demo uses
// localStorage, so they belong to one browser; a real authoring tool would
// keep them per author on its server.

import type { PaletteItem } from './palette';

export interface SavedEquation {
  id: string;
  name: string;
  latex: string;
  /** Letters that, typed in the field, insert the equation */
  shortcut?: string;
}

export interface SavedStorage {
  load(): SavedEquation[];
  save(list: SavedEquation[]): void;
}

const SLOT = /\\placeholder(?:\[[^\]]*\])?\{\}/g;
const SHORTCUT = /^[a-zA-Z]{2,16}$/;

/** As a palette piece: its empty boxes become slots */
export function savedItem(s: SavedEquation): PaletteItem {
  return { id: `saved-${s.id}`, label: s.name, insert: s.latex.replace(SLOT, '#?') };
}

/**
 * Why `text` can't be a shortcut, or null. `taken` holds the shortcuts the
 * field already has (MathLive's ~260 and ours: sin, pi, sqrt, abs...).
 */
export function shortcutProblem(text: string, taken: Iterable<string>): string | null {
  if (!SHORTCUT.test(text)) return 'A shortcut is 2 to 16 letters, with no spaces, digits or symbols.';
  if (new Set(taken).has(text)) return `"${text}" is already a shortcut. Choose other letters.`;
  return null;
}

/** Keeps the list in its storage. Every change goes through add/remove, which validate. */
export class SavedEquations {
  #storage: SavedStorage;
  #list: SavedEquation[];

  constructor(storage: SavedStorage) {
    this.#storage = storage;
    this.#list = storage.load().filter(isSaved);
  }

  get list(): readonly SavedEquation[] {
    return this.#list;
  }

  /**
   * Save an equation. Throws with a message for the author. `taken` is the
   * field's other shortcuts; the saved ones are checked here.
   */
  add(input: { name: string; latex: string; shortcut?: string }, taken: Iterable<string> = []): SavedEquation {
    const name = input.name.trim();
    const latex = input.latex.trim();
    const shortcut = input.shortcut?.trim() || undefined;
    if (!latex || !latex.replace(SLOT, '').trim()) throw new Error('Build an equation first: there is nothing to save.');
    if (!name) throw new Error('Give the equation a name.');
    if (name.length > 60) throw new Error('Keep the name under 60 characters.');
    if (this.#list.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already an equation called "${name}".`);
    if (shortcut) {
      const problem = shortcutProblem(shortcut, [...taken, ...this.#list.flatMap((s) => (s.shortcut ? [s.shortcut] : []))]);
      if (problem) throw new Error(problem);
    }
    const saved: SavedEquation = { id: newId(), name, latex, ...(shortcut ? { shortcut } : {}) };
    this.#list = [...this.#list, saved];
    this.#storage.save(this.#list);
    return saved;
  }

  remove(id: string) {
    this.#list = this.#list.filter((s) => s.id !== id);
    this.#storage.save(this.#list);
  }
}

/** Kept in this browser. Reads and writes never throw: a private window or blocked storage just keeps nothing. */
export function localSavedStorage(key = 'eb-saved-equations'): SavedStorage {
  return {
    load() {
      try {
        const list = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    save(list) {
      try {
        localStorage.setItem(key, JSON.stringify(list));
      } catch {
        // Not kept; the list still works until the page is reloaded
      }
    },
  };
}

export function memorySavedStorage(initial: SavedEquation[] = []): SavedStorage {
  let list = initial;
  return { load: () => list, save: (l) => void (list = l) };
}

// Storage is the host's (and the author's browser): don't trust its shape
function isSaved(s: unknown): s is SavedEquation {
  const o = s as SavedEquation;
  return !!o && typeof o.id === 'string' && typeof o.name === 'string' && typeof o.latex === 'string' && (o.shortcut === undefined || SHORTCUT.test(o.shortcut));
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
