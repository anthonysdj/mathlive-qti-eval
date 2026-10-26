// <app-math-froala-editor [(value)]="html">: Froala with the equation plugin.
//
// `value` is the stored HTML: XHTML with plain MathML, what goes into the QTI
// item body. Inside, angular-froala-wysiwyg's directive owns the Froala
// instance; this component adds the plugin, the MathML allow-list and the
// teardown checks Froala's directive doesn't do on its own.
import { ChangeDetectionStrategy, Component, OnDestroy, computed, input, model } from '@angular/core';
import { FroalaEditorModule } from 'angular-froala-wysiwyg';
import FroalaEditor from 'froala-editor';
import { COMMAND, registerMathPlugin, withMathOptions } from '@sandbox/froala';

registerMathPlugin(FroalaEditor);

const DEFAULT_TOOLBAR = ['bold', 'italic', 'underline', 'subscript', 'superscript', '|', COMMAND, '|', 'undo', 'redo'];

@Component({
  selector: 'app-math-froala-editor',
  imports: [FroalaEditorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [froalaEditor]="options()" [(froalaModel)]="value"></div>`,
})
export class MathFroalaEditor implements OnDestroy {
  /** Stored HTML (XHTML + MathML), two-way */
  readonly value = model('');
  readonly toolbar = input<string[]>(DEFAULT_TOOLBAR);
  readonly placeholder = input('Type the question…');

  #destroyed = false;

  protected readonly options = computed(() => {
    const self = this;
    // withMathOptions: Froala cleans the initial content before plugins
    // start, so the MathML allow-list has to be in the options from the start.
    return withMathOptions(
      {
        toolbarButtons: this.toolbar(),
        placeholderText: this.placeholder(),
        heightMin: 160,
        events: {
          // angular-froala-wysiwyg creates the editor after a dynamic
          // import(), so a component destroyed in the meantime would leave an
          // orphan editor behind. Destroy it as soon as it exists.
          'html.set'(this: any) {
            if (self.#destroyed) queueMicrotask(() => this.destroy?.());
          },
        },
      },
      FroalaEditor.DEFAULTS
    );
  });

  ngOnDestroy() {
    // The directive's own ngOnDestroy destroys the editor, which closes and
    // removes the equation dialog (plugin 'destroy' handler).
    this.#destroyed = true;
  }
}
