// Static @font-face rules. Vite rewrites their url(fonts/…) to hashed assets,
// and MathLive sees `--ML__static-fonts` and skips its own font loader. This
// is needed because the loader resolves `fontsDirectory` relative to the
// script URL (/assets/ after bundling) and reads it when the first field
// connects: for a <math-field> already in the HTML that is during the
// `import` below, before any line of this file can change it.
import 'mathlive/fonts.css';
import { MathfieldElement, convertLatexToMarkup, version } from 'mathlive';
import { MATHFIELD_EVENTS, KEYBOARD_EVENTS, recordEvents, type Logged } from './event-log';
import { isWellFormedXml } from './probe';
import { toPersistedMathml } from './serialize';

const params = new URLSearchParams(location.search);
MathfieldElement.soundsDirectory = null; // no keypress sounds in the sandbox

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const mf = $<MathfieldElement>('mf');
$('version').textContent = `MathLive ${version.mathlive}`;

function refresh() {
  const latex = mf.getValue('latex');
  const mathml = mf.getValue('math-ml');
  $('out-latex').textContent = latex;
  $('out-mathml').textContent = mathml;
  $('out-spoken').textContent = mf.getValue('spoken-text');
  $('out-ascii').textContent = mf.getValue('ascii-math');
  const ok = isWellFormedXml(mathml);
  const status = $('mathml-ok');
  status.textContent = ok ? 'Well-formed XML' : 'NOT well-formed XML (would break QTI)';
  status.className = ok ? 'good' : 'bad';
  // Let the browser's native MathML renderer show what QTI delivery would see
  const native = $('out-native');
  if (ok) {
    const doc = new DOMParser().parseFromString(toPersistedMathml(mathml, latex), 'application/xml');
    native.replaceChildren(document.importNode(doc.documentElement, true));
  } else native.textContent = '—';
}

const log: Logged[] = [];
const list = $('events');
const push = () => {
  for (const e of log.splice(0)) {
    const li = document.createElement('li');
    li.textContent = `${new Date().toISOString().slice(17, 23)} ${e.type}${e.detail ? ` (${e.detail})` : ''}`;
    list.prepend(li);
  }
};
recordEvents(mf, MATHFIELD_EVENTS.filter((t) => t !== 'keydown'), log);
recordEvents(window.mathVirtualKeyboard, KEYBOARD_EVENTS, log);
mf.addEventListener('input', refresh);
for (const t of [...MATHFIELD_EVENTS, ...KEYBOARD_EVENTS]) {
  mf.addEventListener(t, () => queueMicrotask(push));
  window.mathVirtualKeyboard.addEventListener(t, () => queueMicrotask(push));
}

$('set').addEventListener('click', () => {
  mf.setValue($<HTMLInputElement>('latex-in').value);
  refresh(); // setValue() does not fire `input`
});
$('kbd').addEventListener('click', () => {
  const kbd = window.mathVirtualKeyboard;
  if (kbd.visible) kbd.hide();
  else { mf.focus(); kbd.show(); }
});
$<HTMLInputElement>('ro').addEventListener('change', (e) => {
  mf.readOnly = (e.target as HTMLInputElement).checked;
});

mf.addEventListener('mount', refresh, { once: true });
Object.assign(window, { mf });

// `?many=N` mounts N extra read-only fields, `?static=N` renders the same
// formulas as static markup with convertLatexToMarkup(), and `?native=N` as
// browser-rendered MathML: a rough load-cost comparison for many equations.
const many = Number(params.get('many') ?? 0);
const statik = Number(params.get('static') ?? 0);
const native = Number(params.get('native') ?? 0);
if (many || statik || native) {
  const t0 = performance.now();
  const box = document.createElement('div');
  const tex = (i: number) => `\\frac{${i}}{x_{${i}}}+\\sqrt{${i}^2+1}`;
  const scratch = new MathfieldElement();
  if (native) document.body.append(scratch);
  for (let i = 0; i < Math.max(many, statik, native); i++) {
    if (many) {
      const f = new MathfieldElement();
      f.readOnly = true;
      f.value = tex(i);
      box.append(f);
    } else if (statik) {
      const span = document.createElement('span');
      span.innerHTML = convertLatexToMarkup(tex(i));
      box.append(span, ' ');
    } else {
      scratch.value = tex(i);
      const span = document.createElement('span');
      span.innerHTML = `<math>${scratch.getValue('math-ml')}</math>`;
      box.append(span, ' ');
    }
  }
  scratch.remove();
  document.querySelector('main')!.append(box);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      (window as any).manyMs = performance.now() - t0;
    })
  );
} // for poking at it from devtools
