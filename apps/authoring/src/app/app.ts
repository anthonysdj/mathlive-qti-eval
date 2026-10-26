import { ChangeDetectionStrategy, Component, computed, effect, signal } from '@angular/core';
import { PROFILES } from '@sandbox/builder';
import { MathFroalaEditor } from './math-froala-editor';
import type { BuilderUi } from './equation-builder/equation-builder';
import { StoredHtmlPreview } from './stored-html-preview';

const NS = 'http://www.w3.org/1998/Math/MathML';
const SAMPLE =
  `<p>Solve <math xmlns="${NS}"><semantics><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>−</mo><mn>5</mn><mi>x</mi><mo>+</mo><mn>6</mn><mo>=</mo><mn>0</mn></mrow>` +
  `<annotation encoding="application/x-tex">x^2-5x+6=0</annotation></semantics></math> for <math xmlns="${NS}"><mi>x</mi></math>.</p>`;

@Component({
  selector: 'app-root',
  imports: [MathFroalaEditor, StoredHtmlPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>Item authoring: equations in Froala (Angular)</h1>
      <p class="hint">Use the √ button or Ctrl+Shift+M to insert an equation; click one to edit it. The equation builder in the dialog follows the settings below.</p>

      <div class="settings">
        <label>
          Allowed symbols
          <select id="profile" (change)="profileId.set($any($event.target).value)">
            @for (p of profiles; track p.id) {
              <option [value]="p.id" [selected]="p.id === profileId()">{{ p.label }}</option>
            }
          </select>
        </label>
        <label>
          Input
          <select id="ui" (change)="ui.set($any($event.target).value)">
            <option value="panel" [selected]="ui() === 'panel'">Panel (keyboard on touch)</option>
            <option value="keyboard" [selected]="ui() === 'keyboard'">Virtual keyboard</option>
            <option value="both" [selected]="ui() === 'both'">Both</option>
          </select>
        </label>
        <label>
          Theme
          <select id="theme" (change)="theme.set($any($event.target).value)">
            <option value="light" [selected]="theme() === 'light'">Light</option>
            <option value="dark" [selected]="theme() === 'dark'">Dark</option>
          </select>
        </label>
      </div>

      <label class="toggle"><input type="checkbox" [checked]="show()" (change)="show.set(!show())" /> Show the editor</label>
      @if (show()) {
        <app-math-froala-editor [(value)]="stem" [profile]="profile()" [ui]="ui()" />
      }

      <div class="controls">
        <button type="button" (click)="saved.set(stem())">Save</button>
        <button type="button" (click)="stem.set(saved())" [disabled]="!saved()">Load saved</button>
        <button type="button" (click)="stem.set(sample)">Load sample</button>
      </div>

      <h2>Preview</h2>
      <div class="preview" [appStoredHtmlPreview]="stem()"></div>

      <h2>Stored HTML</h2>
      <pre class="stored">{{ stem() }}</pre>
    </main>
  `,
  styles: `
    main { max-width: 860px; margin: 0 auto; padding: 24px 16px; font: 15px/1.5 system-ui, sans-serif; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    .hint { color: var(--muted); }
    .settings { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 8px 0; }
    .settings label { display: flex; flex-direction: column; font-size: 13px; color: var(--muted); }
    select { font: inherit; padding: 4px 6px; }
    .toggle { display: block; margin: 8px 0; }
    .controls { display: flex; gap: 8px; margin-top: 12px; }
    button { font: inherit; padding: 6px 14px; }
    .preview { background: var(--eb-surface); border: 1px solid var(--eb-border); padding: 8px 12px; }
    .stored { white-space: pre-wrap; word-break: break-all; background: var(--eb-surface); border: 1px solid var(--eb-border); padding: 12px; font-size: 12px; }
  `,
})
export class App {
  protected readonly sample = SAMPLE;
  protected readonly show = signal(true);
  protected readonly stem = signal(SAMPLE);
  protected readonly saved = signal('');
  protected readonly profiles = PROFILES;
  protected readonly profileId = signal(PROFILES[0].id);
  protected readonly profile = computed(() => PROFILES.find((p) => p.id === this.profileId())!);
  protected readonly ui = signal<BuilderUi>('panel');
  protected readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    effect(() => (document.documentElement.dataset['theme'] = this.theme()));
  }
}
