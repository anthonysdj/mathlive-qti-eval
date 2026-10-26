// <app-math-froala-editor [(value)]="html">: Froala with the equation plugin.
//
// `value` is the stored HTML: XHTML with plain MathML, what goes into the QTI
// item body. Inside, angular-froala-wysiwyg's directive owns the Froala
// instance; this component adds the plugin, the MathML allow-list and the
// teardown checks Froala's directive doesn't do on its own.
//
// With `builder` on (the default), the equation dialog gets the equation
// builder (EquationBuilder) under its field, for the given allowed-symbols
// `profile` and input `ui`.
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  EnvironmentInjector,
  OnDestroy,
  computed,
  createComponent,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { FroalaEditorModule } from 'angular-froala-wysiwyg';
import FroalaEditor from 'froala-editor';
import { COMMAND, registerMathPlugin, withMathOptions, type DialogContext, type DialogExtension } from '@sandbox/froala';
import { PROFILES, type AllowedProfile } from '@sandbox/builder';
import { EquationBuilder, type BuilderUi } from './equation-builder/equation-builder';

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
  /** Add the equation builder to the equation dialog */
  readonly builder = input(true);
  readonly profile = input<AllowedProfile>(PROFILES[0]);
  readonly ui = input<BuilderUi>('panel');

  #destroyed = false;
  #appRef = inject(ApplicationRef);
  #injector = inject(EnvironmentInjector);
  #builders = new Set<ComponentRef<EquationBuilder>>();

  constructor() {
    // The dialog (and its builder) outlives a change of profile or UI
    effect(() => {
      const profile = this.profile();
      const ui = this.ui();
      for (const ref of this.#builders) {
        ref.setInput('profile', profile);
        ref.setInput('ui', ui);
      }
    });
  }

  /** The plugin calls this once, when it creates the equation dialog */
  #extendDialog = (ctx: DialogContext): DialogExtension => {
    const ref = createComponent(EquationBuilder, { environmentInjector: this.#injector, hostElement: ctx.slot });
    ref.setInput('field', ctx.field);
    ref.setInput('profile', this.profile());
    ref.setInput('ui', this.ui());
    this.#appRef.attachView(ref.hostView);
    this.#builders.add(ref);
    return {
      opened: () => ref.instance.opened(),
      validate: () => ref.instance.validate(),
      destroy: () => {
        this.#builders.delete(ref);
        this.#appRef.detachView(ref.hostView);
        ref.destroy();
      },
    };
  };

  protected readonly options = computed(() => {
    const self = this;
    // withMathOptions: Froala cleans the initial content before plugins
    // start, so the MathML allow-list has to be in the options from the start.
    return withMathOptions(
      {
        toolbarButtons: this.toolbar(),
        placeholderText: this.placeholder(),
        heightMin: 160,
        mathEquationExtend: this.builder() ? this.#extendDialog : undefined,
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
