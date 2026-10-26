// The popup that edits one equation: a modal <dialog> around a <math-field>.
//
// A native modal dialog gives focus trapping, Escape to cancel and focus
// return for free. Its catch: everything outside the top layer is inert,
// including MathLive's virtual keyboard, which lives in <body>. So while the
// dialog is open the keyboard is moved into it (mathVirtualKeyboard.container).
// Outside <body>, MathLive sizes the keyboard to fill its container, so the
// container is a fixed, full-viewport layer inside the dialog that lets clicks
// through, and the dialog moves up out of the keyboard's way.
// Inside an iframe, mathVirtualKeyboard is a proxy to the top window's
// keyboard and its container cannot be changed (MathLive throws), so there the
// keyboard is left where MathLive puts it.

function moveKeyboard(to: HTMLElement) {
  try {
    if (window.mathVirtualKeyboard.container !== to) window.mathVirtualKeyboard.container = to;
  } catch {
    // "Container inside an iframe cannot be changed"
  }
}

// The page must load MathLive's fonts: `import 'mathlive/fonts.css'` with
// Vite, or the stylesheet in angular.json `styles` with the Angular CLI.
import { MathfieldElement } from 'mathlive';
import { storedMathml } from '@sandbox/converters/src/render';
import { loadTemmlMhchem } from '@sandbox/converters/src/temml-mhchem';

MathfieldElement.soundsDirectory = null;
const mhchem = loadTemmlMhchem();

/** What a dialog extension (the equation builder) gets: the field it works on and a place for its UI */
export interface DialogContext {
  dialog: HTMLDialogElement;
  field: MathfieldElement;
  /** Below the field, above the error line and buttons */
  slot: HTMLElement;
}

/** Hooks an extension can return */
export interface DialogExtension {
  /** The dialog has opened and the field holds the equation (set without an input event) */
  opened?(): void;
  /** Before saving: a message keeps the dialog open and is shown as the error */
  validate?(): string | null;
  /** The dialog is being destroyed */
  destroy?(): void;
}

/** Called once, when the dialog is created. The Froala option `mathEquationExtend` takes one. */
export type DialogExtender = (ctx: DialogContext) => DialogExtension | void;

export interface OpenOptions {
  /** LaTeX to start from (empty for a new equation) */
  latex?: string;
  mode?: 'insert' | 'update';
  /** Shown above the field, e.g. that the LaTeX was converted from MathML */
  note?: string;
}

const DIALOG_CSS = `
.math-eq-dialog { border: 1px solid var(--eb-border, #ccc); border-radius: 8px; padding: 16px 20px; width: min(560px, calc(100vw - 32px)); box-sizing: border-box; font: 14px/1.4 system-ui, sans-serif; background: var(--eb-surface, #fff); color: var(--eb-text, CanvasText); }
.math-eq-dialog.extended { width: min(820px, calc(100vw - 16px)); max-height: calc(100vh - 16px); padding: 12px 16px; }
.math-eq-dialog::backdrop { background: rgb(0 0 0 / 0.25); }
.math-eq-dialog h2 { font-size: 16px; margin: 0 0 12px; }
.math-eq-dialog math-field { display: block; width: 100%; font-size: 24px; padding: 6px; border: 1px solid var(--eb-border-strong, #999); border-radius: 4px; box-sizing: border-box; background: var(--eb-surface, #fff); color: inherit; }
.math-eq-dialog .note { margin: 0 0 8px; padding: 6px 8px; background: #fff6d6; border-radius: 4px; }
.math-eq-dialog .error { margin: 8px 0 0; color: var(--eb-error, #b00020); }
.math-eq-dialog .keyboard-layer { position: fixed; inset: 0; pointer-events: none; }
.math-eq-dialog .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.math-eq-dialog .actions button { font: inherit; padding: 6px 14px; border-radius: 4px; border: 1px solid var(--eb-border-strong, #888); background: var(--eb-surface, #fff); color: inherit; cursor: pointer; }
.math-eq-dialog .actions button.primary { background: var(--eb-accent, #0b5fff); border-color: var(--eb-accent, #0b5fff); color: var(--eb-on-accent, #fff); }
`;
let cssAdded = false;

let nextId = 0;

export class EquationDialog {
  readonly dialog: HTMLDialogElement;
  readonly field: MathfieldElement;
  #title: HTMLElement;
  #note: HTMLElement;
  #error: HTMLElement;
  #ok: HTMLButtonElement;
  #resolve: ((mathml: string | null) => void) | null = null;
  #keyboardLayer: HTMLElement;
  #extension: DialogExtension;
  // Keep the dialog above the keyboard while both are on screen. On a phone
  // the dialog is taller than what the keyboard leaves, so it is capped to
  // that and scrolls: otherwise it moved up past the top of the screen and
  // took the field with it.
  #onKeyboardGeometry = () => {
    const kb = window.mathVirtualKeyboard;
    const h = kb.visible && this.dialog.open ? kb.boundingRect.height : 0;
    this.dialog.style.marginBottom = h ? `${h + 8}px` : '';
    this.dialog.style.maxHeight = h ? `calc(100dvh - ${h + 16}px)` : '';
  };

  constructor(doc: Document = document, extend?: DialogExtender) {
    if (!cssAdded) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(DIALOG_CSS);
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      cssAdded = true;
    }
    const id = `math-eq-dialog-${nextId++}`;
    this.dialog = doc.createElement('dialog');
    this.dialog.className = 'math-eq-dialog';
    this.dialog.setAttribute('aria-labelledby', `${id}-title`);
    this.dialog.innerHTML = `
      <h2 id="${id}-title"></h2>
      <p class="note" hidden></p>
      <math-field aria-label="Equation"></math-field>
      <div class="extension"></div>
      <p class="error" role="alert" hidden></p>
      <div class="actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="ok" class="primary"></button>
      </div>
      <div class="keyboard-layer"></div>`;
    this.#title = this.dialog.querySelector('h2')!;
    this.#note = this.dialog.querySelector('.note')!;
    this.#error = this.dialog.querySelector('.error')!;
    this.#ok = this.dialog.querySelector('[data-action="ok"]')!;
    this.field = this.dialog.querySelector('math-field') as MathfieldElement;
    this.#keyboardLayer = this.dialog.querySelector('.keyboard-layer')!;
    const slot = this.dialog.querySelector<HTMLElement>('.extension')!;
    this.#extension = extend?.({ dialog: this.dialog, field: this.field, slot }) ?? {};
    this.dialog.classList.toggle('extended', !!extend);

    this.dialog.addEventListener('click', (e) => {
      const action = (e.target as Element).closest('button')?.dataset.action;
      if (action === 'ok') void this.confirm();
      if (action === 'cancel') this.#close(null);
    });
    // Escape (native 'cancel' event) and closing by any other means
    this.dialog.addEventListener('close', () => this.#close(null));
    // Enter confirms and Escape cancels, as in most equation editors. MathLive
    // binds both itself (Escape switches to LaTeX mode, Enter commits), so
    // they are taken first, in the capture phase, except while the author is
    // typing a LaTeX command, where MathLive needs them to finish it.
    this.dialog.addEventListener(
      'keydown',
      (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || this.field.mode === 'latex') return;
        if (e.key === 'Enter' && e.target === this.field) {
          e.preventDefault();
          e.stopPropagation();
          void this.confirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.#close(null);
        }
      },
      true
    );
    doc.body.append(this.dialog);
  }

  get isOpen() {
    return this.dialog.open;
  }

  /** Show the dialog. Resolves with the stored MathML, or null if cancelled. */
  open({ latex = '', mode = 'insert', note }: OpenOptions = {}): Promise<string | null> {
    this.#resolve?.(null);
    this.#title.textContent = mode === 'insert' ? 'Insert equation' : 'Edit equation';
    this.#ok.textContent = mode === 'insert' ? 'Insert' : 'Update';
    this.#note.hidden = !note;
    this.#note.textContent = note ?? '';
    this.#error.hidden = true;
    this.field.setValue(latex, { silenceNotifications: true });
    moveKeyboard(this.#keyboardLayer);
    window.mathVirtualKeyboard.addEventListener('geometrychange', this.#onKeyboardGeometry);
    this.dialog.showModal();
    this.field.focus();
    this.#extension.opened?.();
    return new Promise((resolve) => (this.#resolve = resolve));
  }

  /** Convert what's in the field and close; on a conversion error, stay open and say why. */
  async confirm(): Promise<void> {
    if (!this.#resolve) return;
    await mhchem;
    if (!this.field.getValue('latex').trim()) return this.#showError('The equation is empty.');
    const refused = this.#extension.validate?.();
    if (refused) return this.#showError(refused);
    let mathml: string;
    try {
      mathml = storedMathml(this.field);
    } catch (e) {
      return this.#showError(`This can't be saved: ${(e as Error).message}`);
    }
    this.#close(mathml);
  }

  cancel() {
    this.#close(null);
  }

  #showError(message: string) {
    this.#error.textContent = message;
    this.#error.hidden = false;
  }

  #close(result: string | null) {
    const resolve = this.#resolve;
    this.#resolve = null;
    window.mathVirtualKeyboard.removeEventListener('geometrychange', this.#onKeyboardGeometry);
    window.mathVirtualKeyboard.hide();
    if (window.mathVirtualKeyboard.container === this.#keyboardLayer) moveKeyboard(this.dialog.ownerDocument.body);
    this.dialog.style.marginBottom = '';
    this.dialog.style.maxHeight = '';
    if (this.dialog.open) this.dialog.close();
    resolve?.(result);
  }

  destroy() {
    this.#close(null);
    this.#extension.destroy?.();
    this.dialog.remove();
  }
}
