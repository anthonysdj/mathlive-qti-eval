// <math-eq data-mathml="…">: shows one stored equation inside the editor.
//
// The shadow root holds what src/render.ts (sandbox/converters) builds for the
// page: the MathJax SVG that print uses too (aria-hidden) and the MathML,
// visually hidden, for screen readers. Keeping both in the shadow root means
// the editor's HTML holds only the empty host element, so Froala never sees
// SVG (its default allow-list strips it) and undo snapshots stay small.

import { EQ_CSS, renderEquation } from '@sandbox/converters/src/render';
import { EQ_TAG } from './mathml-allowlist';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
:host { display: inline-block; cursor: pointer; border-radius: 2px; }
:host(:hover) { outline: 1px dashed color-mix(in srgb, currentColor 40%, transparent); }
:host(:state(editing)) { outline: 2px solid Highlight; }
.eq { display: inline-block; }
.eq-error { color: #b00020; font: inherit; }
${EQ_CSS}`);

// MathML → rendered parts, shared by every element showing the same equation.
// Undo/redo recreates the elements from HTML, so this makes it instant.
const cache = new Map<string, Promise<HTMLElement>>();
function rendered(mathml: string): Promise<HTMLElement> {
  let p = cache.get(mathml);
  if (!p) {
    p = renderEquation(mathml);
    p.catch(() => cache.delete(mathml));
    cache.set(mathml, p);
  }
  return p;
}

export class MathEqElement extends HTMLElement {
  static observedAttributes = ['data-mathml'];
  #root = this.attachShadow({ mode: 'open' });
  #internals = this.attachInternals();
  #shown: string | null = null;
  #pending: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.#root.adoptedStyleSheets = [sheet];
  }

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  get mathml(): string {
    return this.getAttribute('data-mathml') ?? '';
  }

  /**
   * Highlighted while its dialog is open. A custom state rather than a class:
   * a class would end up in the editor's HTML and in Froala's undo snapshots.
   */
  set editing(on: boolean) {
    if (on) this.#internals.states.add('editing');
    else this.#internals.states.delete('editing');
  }
  get editing(): boolean {
    return this.#internals.states.has('editing');
  }

  /** Resolves once the current MathML is on screen (or has failed to render). */
  get ready(): Promise<void> {
    return this.#pending;
  }

  #render() {
    const mathml = this.mathml;
    if (mathml === this.#shown) return;
    this.#shown = mathml;
    // Nothing yet: a framework may connect the element before binding data-mathml
    if (!mathml) {
      this.#root.replaceChildren();
      this.#pending = Promise.resolve();
      return;
    }
    this.#pending = rendered(mathml).then(
      (wrapper) => {
        if (this.#shown !== mathml) return; // changed while rendering
        const copy = wrapper.cloneNode(true) as HTMLElement;
        copy.removeAttribute('contenteditable');
        this.#root.replaceChildren(copy);
      },
      (e: Error) => {
        if (this.#shown !== mathml) return;
        const err = document.createElement('span');
        err.className = 'eq-error';
        err.textContent = '[equation]';
        err.title = `This equation could not be displayed: ${e.message}`;
        this.#root.replaceChildren(err);
      }
    );
  }
}

export function defineMathEq() {
  if (!customElements.get(EQ_TAG)) customElements.define(EQ_TAG, MathEqElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'math-eq': MathEqElement;
  }
}
