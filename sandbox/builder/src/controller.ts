// Binds the builder to one <math-field>: inserts templates, applies the
// notation and the allowed-symbols profile, and keeps out what the profile
// refuses however it arrives (palette, typing, shortcut, paste, keyboard).
//
// Framework-free so the Angular component, the tests and any other host
// share it. The Angular EquationBuilderComponent is a view on top.

import type { MathfieldElement, Selection } from 'mathlive';

type MenuItem = MathfieldElement['menuItems'][number];
import { describeToken, resolveAllowed, type Allowed, type AllowedProfile } from './allowed';
import { keyboardLayouts } from './keyboard';
import { MACROS, SHORTCUTS, shortcutValue } from './notation';
import type { PaletteItem, TextEntry } from './palette';

/** The field's context-menu items we keep: editing, and matrix rows/columns when matrices are allowed */
const MENU_KEEP = ['cut', 'copy', 'paste', 'select-all'];
const MENU_MATRIX = ['add-row-above', 'add-row-below', 'add-column-before', 'add-column-after', 'delete-row', 'delete-column'];

export interface Refusal {
  /** Tokens that were refused, e.g. ['\\frac'] */
  tokens: string[];
  message: string;
}

export interface BuilderOptions {
  profile: AllowedProfile;
  /** Called when a change is undone because the profile refuses it */
  onRefused?(refusal: Refusal): void;
  /** Also set MathLive's (global) virtual keyboard layouts from the profile. Default true. */
  keyboard?: boolean;
}

const SLOT = /\\placeholder(?:\[[^\]]*\])?\{\}/g;

export function refusalMessage(tokens: string[]): string {
  const names = [...new Set(tokens.map(describeToken))];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? "isn't" : "aren't"} allowed in this assessment.`;
}

export class BuilderController {
  readonly field: MathfieldElement;
  #opts: BuilderOptions;
  #allowed!: Allowed;
  #defaults: { shortcuts: MathfieldElement['inlineShortcuts']; macros: MathfieldElement['macros']; menu: readonly MenuItem[] };
  // Last state the profile accepted, to go back to
  #good: { value: string; selection: Selection } = { value: '', selection: { ranges: [[0, 0]] } };
  // Tokens the profile refuses that were already there when the equation was
  // loaded: editing an older equation shouldn't undo every keystroke.
  #baseline = new Set<string>();
  #abort = new AbortController();

  constructor(field: MathfieldElement, opts: BuilderOptions) {
    this.field = field;
    this.#opts = opts;
    this.#defaults = { shortcuts: field.inlineShortcuts, macros: field.macros, menu: field.menuItems };
    this.setProfile(opts.profile);
    const signal = this.#abort.signal;
    field.addEventListener('input', () => this.#onInput(), { signal });
    // MathLive sends 'input' once for a burst of keys typed in quick
    // succession, but 'selection-change' for each one. Remembering every
    // accepted state there means a refusal undoes only the refused key.
    // Some changes send no 'input' at all (a lone ^ makes an empty
    // superscript), so a refused state is also caught here.
    field.addEventListener('selection-change', () => (this.#newlyRefused().length ? this.#refuse() : this.#remember()), { signal });
  }

  get allowed(): Allowed {
    return this.#allowed;
  }

  setProfile(profile: AllowedProfile) {
    this.#opts = { ...this.#opts, profile };
    const allowed = (this.#allowed = resolveAllowed(profile));
    const fits = (latex: string) => allowed.refused(latex).length === 0;
    const f = this.field;
    // Macros first: shortcuts are checked by what they expand to
    f.macros = { ...this.#defaults.macros, ...Object.fromEntries(Object.entries(MACROS).filter(([, def]) => fits(def))) };
    f.inlineShortcuts = Object.fromEntries(
      Object.entries({ ...this.#defaults.shortcuts, ...SHORTCUTS }).filter(([, def]) => fits(shortcutValue(def)))
    );
    const keep = new Set([...MENU_KEEP, ...(allowed.isAllowed('\\begin{pmatrix}') ? MENU_MATRIX : [])]);
    f.menuItems = tidyDividers(this.#defaults.menu.filter((m) => m.type === 'divider' || ('id' in m && keep.has(m.id!))));
    if (this.#opts.keyboard !== false) window.mathVirtualKeyboard.layouts = keyboardLayouts(allowed);
    this.reset();
  }

  /** Call after the field's value was set without an input event (e.g. setValue on opening a dialog) */
  reset() {
    this.#good = { value: this.field.getValue('latex'), selection: this.field.selection };
    this.#baseline = new Set(this.#allowed.refused(this.field.getValue('latex-expanded')));
  }

  /** Insert a palette item at the caret (wrapping the selection where the item takes one) */
  insert(item: PaletteItem) {
    this.field.insert(item.insert, { focus: true, scrollIntoView: true, format: 'latex' });
  }

  /** Insert what the author typed into a text entry. Throws with a message for the author. */
  insertEntry(entry: TextEntry, text: string) {
    const latex = entry.toLatex(text);
    const refused = this.#allowed.refused(latex);
    if (refused.length) throw new Error(refusalMessage(refused));
    this.field.insert(latex, { focus: true, scrollIntoView: true, format: 'latex' });
  }

  /** Number of empty slots (\placeholder{}) left in the field */
  emptySlots(): number {
    return this.field.getValue('latex').match(SLOT)?.length ?? 0;
  }

  /** Why the field can't be saved yet, or null. For the dialog's confirm step. */
  validate(): string | null {
    const slots = this.emptySlots();
    if (slots) return `Fill in the ${slots === 1 ? 'empty box' : `${slots} empty boxes`}, or delete ${slots === 1 ? 'it' : 'them'}.`;
    const refused = this.#allowed.refused(this.field.getValue('latex-expanded'));
    if (refused.length) return refusalMessage(refused);
    return null;
  }

  #newlyRefused(): string[] {
    return this.#allowed.refused(this.field.getValue('latex-expanded')).filter((t) => !this.#baseline.has(t));
  }

  #remember() {
    if (!this.#newlyRefused().length) this.#good = { value: this.field.getValue('latex'), selection: this.field.selection };
  }

  #onInput() {
    if (this.#newlyRefused().length) this.#refuse();
    else this.#remember();
  }

  #reverting = false;
  #refuse() {
    if (this.#reverting) return;
    const refused = this.#newlyRefused();
    this.#reverting = true;
    const f = this.field;
    // After the current event: MathLive is still dispatching it
    queueMicrotask(() => {
      f.setValue(this.#good.value, { silenceNotifications: true });
      f.selection = this.#good.selection;
      this.#reverting = false;
      this.#opts.onRefused?.({ tokens: refused, message: refusalMessage(refused) });
    });
  }

  detach() {
    this.#abort.abort();
    const f = this.field;
    if (!f.isConnected) return; // MathLive refuses option changes on a removed field
    f.inlineShortcuts = this.#defaults.shortcuts;
    f.macros = this.#defaults.macros;
    f.menuItems = this.#defaults.menu;
  }
}

function tidyDividers(items: MenuItem[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const m of items) {
    if (m.type === 'divider' && (!out.length || out.at(-1)!.type === 'divider')) continue;
    out.push(m);
  }
  while (out.at(-1)?.type === 'divider') out.pop();
  return out;
}
