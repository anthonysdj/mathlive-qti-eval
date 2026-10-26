// Shows stored HTML the way a candidate would see it: each <math> as the same
// MathJax SVG the editor and print use, the MathML kept for screen readers.
// The HTML comes from our own editor, so it is set directly rather than
// through Angular's sanitiser (which removes custom elements).
import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { defineMathEq, toEditorHtml } from '@sandbox/froala';

defineMathEq();

@Directive({ selector: '[appStoredHtmlPreview]' })
export class StoredHtmlPreview {
  readonly html = input('', { alias: 'appStoredHtmlPreview' });
  #el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      this.#el.innerHTML = toEditorHtml(this.html());
      // Read-only here: not editable, not deletable
      for (const eq of Array.from(this.#el.querySelectorAll('math-eq'))) {
        eq.removeAttribute('contenteditable');
        eq.removeAttribute('class');
        (eq as HTMLElement).style.cursor = 'auto';
      }
    });
  }
}
