import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MathFroalaEditor } from './math-froala-editor';
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
      <p class="hint">Use the √ button or Ctrl+Shift+M to insert an equation; click one to edit it.</p>

      <label class="toggle"><input type="checkbox" [checked]="show()" (change)="show.set(!show())" /> Show the editor</label>
      @if (show()) {
        <app-math-froala-editor [(value)]="stem" />
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
    .hint { color: #555; }
    .toggle { display: block; margin: 8px 0; }
    .controls { display: flex; gap: 8px; margin-top: 12px; }
    button { font: inherit; padding: 6px 14px; }
    .preview { background: #fff; border: 1px solid #ddd; padding: 8px 12px; }
    .stored { white-space: pre-wrap; word-break: break-all; background: #fff; border: 1px solid #ddd; padding: 12px; font-size: 12px; }
  `,
})
export class App {
  protected readonly sample = SAMPLE;
  protected readonly show = signal(true);
  protected readonly stem = signal(SAMPLE);
  protected readonly saved = signal('');
}
