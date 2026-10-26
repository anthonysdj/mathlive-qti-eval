// Demo: Froala with the equation plugin. Load → edit → save → reload.
import FroalaEditor from 'froala-editor';
import 'froala-editor/css/froala_editor.pkgd.min.css';
import { COMMAND, registerMathPlugin, withMathOptions } from '../src';

registerMathPlugin(FroalaEditor);

const $ = (id: string) => document.getElementById(id)!;
const NS = 'http://www.w3.org/1998/Math/MathML';

const START =
  '<p>The roots of <math xmlns="' + NS + '"><semantics><mrow><mi>a</mi><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mi>b</mi><mi>x</mi><mo>+</mo><mi>c</mi><mo>=</mo><mn>0</mn></mrow>' +
  '<annotation encoding="application/x-tex">ax^2+bx+c=0</annotation></semantics></math> are given by the formula below.</p><p>Write it here: </p>';

// The formats Wiris MathType leaves behind (see src/wiris.ts)
const WIRIS =
  `<p>Wiris, saveMode xml: <math xmlns="${NS}"><mfrac><mrow><mi>a</mi><mo>+</mo><mn>1</mn></mrow><msqrt><mi>b</mi></msqrt></mfrac></math></p>` +
  `<p>Wiris image: <img class="Wirisformula" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-mathml="«math xmlns=¨${NS}¨»«msup»«mi»e«/mi»«mrow»«mi»i«/mi»«mi»π«/mi»«/mrow»«/msup»«mo»+«/mo»«mn»1«/mn»«mo»=«/mo»«mn»0«/mn»«/math»" alt="e to the i pi plus 1 equals 0"></p>` +
  `<p>Wiris safeXml text: «math xmlns=¨${NS}¨»«msub»«mi»H«/mi»«mn»2«/mn»«/msub»«mi»O«/mi»«/math»</p>`;

let saved = '';
let editor: any;

function create(stored: string): Promise<void> {
  editor?.destroy();
  $('editor').innerHTML = '';
  return new Promise((resolve) => {
    editor = new (FroalaEditor as any)(
      '#editor',
      withMathOptions(
        {
          toolbarButtons: ['bold', 'italic', 'underline', '|', COMMAND, '|', 'undo', 'redo'],
          heightMin: 180,
          events: {
            initialized(this: any) {
              this.html.set(stored);
              this.undo.reset();
              this.undo.saveStep();
              resolve();
            },
          },
        },
        FroalaEditor.DEFAULTS
      )
    );
  });
}

function save() {
  saved = editor.html.get();
  $('stored').textContent = saved;
  const n = (saved.match(/<math\b/g) ?? []).length;
  $('status').textContent = `Saved ${n} equation${n === 1 ? '' : 's'}, ${saved.length} characters`;
}

$('save').addEventListener('click', save);
$('reload').addEventListener('click', async () => {
  if (!saved) save();
  const before = saved;
  await create(saved);
  save();
  $('status').textContent += before === saved ? ' (reload gave back the same HTML)' : ' (reload CHANGED the HTML)';
});
$('wiris').addEventListener('click', async () => {
  await create(WIRIS);
  save();
});

await create(START);
save();
(window as any).demo = { get editor() { return editor; } };
