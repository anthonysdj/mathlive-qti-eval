// <app-equation-builder [field]="mathfield" [profile]="profile" [ui]="'panel'">
//
// The palette-driven equation builder for authors who don't know LaTeX: a
// categorised template panel, text entries for chemistry and units, and a
// live preview of the LaTeX, the stored MathML, the spoken text and the
// rendering that will print. Palette pieces can also be dragged into the
// field, or onto an empty box of a piece dropped earlier (PaletteDrag); a
// press without a drag still inserts at the caret. It works on a <math-field> it is given (in the
// demo, the one in the Froala equation dialog), through BuilderController
// from sandbox/builder, which also enforces the per-assessment profile.
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import type { MathfieldElement } from 'mathlive';
import {
  BuilderController,
  PROFILES,
  PaletteDrag,
  displayLatex,
  prettyMathml,
  previewOf,
  type AllowedProfile,
  type Category,
  type PaletteItem,
  type Preview,
} from '@sandbox/builder';

/**
 * Which input UI the author gets:
 * - panel: the palette in the dialog; MathLive's virtual keyboard appears on
 *   touch devices only (policy "auto"). The default, see docs/03.
 * - keyboard: no panel; the custom virtual keyboard, shown on open.
 * - both: panel, and the keyboard toggle on every device.
 */
export type BuilderUi = 'panel' | 'keyboard' | 'both';

const EMPTY_PREVIEW: Preview = { latex: '', mathml: '', error: null, spoken: '' };

@Component({
  selector: 'app-equation-builder',
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <math-span>, <math-eq>
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equation-builder.html',
  styleUrl: './equation-builder.css',
  host: { class: 'eb', '[attr.data-ui]': 'ui()' },
})
export class EquationBuilder implements OnDestroy {
  readonly field = input.required<MathfieldElement>();
  readonly profile = input<AllowedProfile>(PROFILES[0]);
  readonly ui = input<BuilderUi>('panel');
  readonly showPreview = input(true);

  protected readonly categories = signal<Category[]>([]);
  protected readonly activeId = signal<string>('');
  protected readonly active = computed(() => this.categories().find((c) => c.id === this.activeId()) ?? this.categories()[0]);
  protected readonly message = signal('');
  protected readonly entryError = signal('');
  protected readonly preview = signal<Preview>(EMPTY_PREVIEW);
  protected readonly prettyMathml = computed(() => (this.preview().mathml ? prettyMathml(this.preview().mathml!) : ''));
  protected readonly display = displayLatex;

  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');
  readonly #host: HTMLElement = inject(ElementRef).nativeElement;
  #controller: BuilderController | null = null;
  #previewTimer = 0;
  #onInput = () => this.#schedulePreview();

  constructor() {
    // Attach to the field once it is known
    effect((onCleanup) => {
      const field = this.field();
      const controller = untracked(
        () =>
          new BuilderController(field, {
            profile: this.profile(),
            onRefused: (r) => this.message.set(r.message),
          })
      );
      this.#controller = controller;
      field.addEventListener('input', this.#onInput);
      const drag = new PaletteDrag(this.#host, {
        field: () => field,
        item: (id) => this.categories().flatMap((c) => c.items).find((i) => i.id === id),
        drop: (item, target) => {
          this.message.set('');
          controller.drop(item, target.offset);
          this.#refreshPreview();
        },
      });
      untracked(() => this.#applyProfile());
      onCleanup(() => {
        drag.detach();
        field.removeEventListener('input', this.#onInput);
        controller.detach();
        this.#controller = null;
      });
    });
    // A new profile: new palette, new checks, new keyboard
    effect(() => {
      this.profile();
      untracked(() => this.#applyProfile());
    });
    effect(() => {
      const field = this.field();
      const ui = this.ui();
      // "auto" shows MathLive's keyboard on touch devices only
      field.mathVirtualKeyboardPolicy = ui === 'keyboard' ? 'manual' : 'auto';
      field.classList.toggle('eb-hide-keyboard-toggle', ui === 'panel');
    });
  }

  #applyProfile() {
    const c = this.#controller;
    if (!c) return;
    if (c.allowed.profile !== this.profile()) c.setProfile(this.profile());
    this.categories.set(c.allowed.categories);
    if (!c.allowed.categories.some((x) => x.id === this.activeId())) this.activeId.set(c.allowed.categories[0]?.id ?? '');
    this.message.set('');
    this.#refreshPreview();
  }

  /** The dialog opened with a (possibly older) equation in the field */
  opened() {
    this.#controller?.reset();
    this.message.set('');
    this.entryError.set('');
    this.#refreshPreview();
    if (this.ui() === 'keyboard') window.mathVirtualKeyboard.show();
  }

  /** For the dialog's confirm step */
  validate(): string | null {
    return this.#controller?.validate() ?? null;
  }

  protected insert(item: PaletteItem) {
    this.message.set('');
    this.#controller?.insert(item);
    this.#refreshPreview();
  }

  protected insertEntry(category: Category, input: HTMLInputElement, event: Event) {
    event.preventDefault();
    try {
      this.#controller?.insertEntry(category.entry!, input.value);
      input.value = '';
      this.entryError.set('');
      this.#refreshPreview();
    } catch (e) {
      this.entryError.set((e as Error).message);
    }
  }

  // Tabs: arrow keys move between them (one tab stop for the whole list)
  protected onTabKey(event: KeyboardEvent, index: number) {
    const n = this.categories().length;
    const to = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: n - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = (to + n) % n;
    this.activeId.set(this.categories()[next].id);
    this.tabs()[next]?.nativeElement.focus();
  }

  #schedulePreview() {
    clearTimeout(this.#previewTimer);
    this.#previewTimer = window.setTimeout(() => this.#refreshPreview(), 120);
  }

  #refreshPreview() {
    clearTimeout(this.#previewTimer);
    if (!this.showPreview() || !this.#controller) return;
    this.preview.set(previewOf(this.field()));
  }

  ngOnDestroy() {
    clearTimeout(this.#previewTimer);
  }
}
