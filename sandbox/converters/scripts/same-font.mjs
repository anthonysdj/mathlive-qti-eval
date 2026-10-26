// Does pointing the browser at the same math font as MathJax make native
// MathML match the print SVG? For every formula, three renders at the same
// pixel box, each pixel-diffed against the print SVG (drawn by resvg):
//   1. native MathML, Chromium's default math font (today)
//   2. native MathML, New Computer Modern Math (the font MathJax's SVG uses)
//   3. the same SVG shown in Chromium (the recommendation)
// The font is not in the repo (1.1 MB, GUST font licence). Get
// NewCMMath-Regular.otf from CTAN (fonts/newcomputermodern) or the typst-assets
// crate and pass its path: NEWCM_FONT=/path/NewCMMath-Regular.otf node scripts/same-font.mjs
// Usage: pnpm print && NEWCM_FONT=… node scripts/same-font.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const FONT = process.env.NEWCM_FONT;
if (!FONT) throw new Error('Set NEWCM_FONT to the path of NewCMMath-Regular.otf');
const fontB64 = readFileSync(FONT).toString('base64');
const PX_PER_UNIT = 0.048; // 1000 MathJax units per em → 48px em, as in consistency.mjs
const { rows } = JSON.parse(readFileSync('../../findings/print-svg-raw.json', 'utf8'));

function sized(svg) {
  const [, , vbw, vbh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const w = Math.ceil(vbw * PX_PER_UNIT);
  const h = Math.ceil(vbh * PX_PER_UNIT);
  return {
    w, h,
    svg: svg
      .replace(/ style="vertical-align:[^"]*"/, '')
      .replace(/ width="[^"]*ex"/, ` width="${w}"`)
      .replace(/ height="[^"]*ex"/, ` height="${h}"`)
      .replace(/currentColor/g, '#000'),
  };
}

function diff(a, b, w, h) {
  const out = new PNG({ width: w, height: h });
  const changed = pixelmatch(a.data, b.data, out.data, w, h, { threshold: 0.1 });
  let ink = 0;
  for (let i = 0; i < b.data.length; i += 4) if (b.data[i] < 200 || a.data[i] < 200) ink++;
  return { ratio: ink ? changed / ink : 0, png: PNG.sync.write(out) };
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><style>
@font-face { font-family: 'NewCMMath'; src: url(data:font/otf;base64,${fontB64}) format('opentype'); }
body { margin: 0; background: #fff; color: #000 }
#box { display: inline-block; line-height: 0; overflow: hidden; background: #fff }
.newcm math { font-family: 'NewCMMath', math }
</style><div id="box"></div>`);
await page.evaluate(() => document.fonts.load("48px 'NewCMMath'"));

// Native MathML at 48px, scaled into the SVG's box (as in consistency.mjs)
async function native(mathml, w, h, cls) {
  await page.evaluate(({ mathml, w, h, cls }) => {
    const box = document.getElementById('box');
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    box.innerHTML = `<span id="m" class="${cls}" style="display:inline-block;font-size:48px;line-height:normal;transform-origin:0 0">${mathml}</span>`;
    const m = document.getElementById('m');
    const r = m.getBoundingClientRect();
    m.style.transform = `scale(${w / r.width}, ${h / r.height})`;
  }, { mathml, w, h, cls });
  return PNG.sync.read(await page.locator('#box').screenshot());
}

const results = [];
for (const r of rows) {
  const { svg, w, h } = sized(r.svg);
  const print = PNG.sync.read(new Resvg(svg, { background: '#ffffff' }).render().asPng());
  const def = await native(r.mathml, w, h, '');
  const newcm = await native(r.mathml, w, h, 'newcm');
  await page.evaluate(({ svg }) => { document.getElementById('box').innerHTML = svg; }, { svg });
  const same = PNG.sync.read(await page.locator('#box').screenshot());
  const d1 = diff(def, print, w, h), d2 = diff(newcm, print, w, h), d3 = diff(same, print, w, h);
  results.push({
    id: r.id, latex: r.latex,
    defaultFont: d1.ratio, sameFont: d2.ratio, sameSvg: d3.ratio,
    img: [print, def, newcm, same].map((p) => PNG.sync.write(p).toString('base64')),
    diffs: [d1, d2, d3].map((d) => d.png.toString('base64')),
  });
}
await browser.close();

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const stat = (k) => ({ median: median(results.map((r) => r[k])), max: Math.max(...results.map((r) => r[k])) });
const summary = { defaultFont: stat('defaultFont'), sameFont: stat('sameFont'), sameSvg: stat('sameSvg') };
writeFileSync('../../findings/same-font-raw.json', JSON.stringify({ summary, rows: results.map(({ img, diffs, ...x }) => x) }, null, 2));

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const im = (b) => `<img src="data:image/png;base64,${b}">`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
writeFileSync('../../findings/same-font.html', `<!doctype html><meta charset="utf-8"><title>Same math font vs same SVG</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;color:#222;background:#fff}table{border-collapse:collapse}
td,th{border:1px solid #ddd;padding:4px 8px;vertical-align:middle}th{background:#f4f4f4;position:sticky;top:0}
td:first-child{font:12px ui-monospace,monospace;max-width:180px}img{max-height:70px;max-width:200px;display:block}
.n{text-align:right;font-variant-numeric:tabular-nums;font-size:12px;color:#555}</style>
<h1>Does the same math font make browser MathML match print?</h1>
<p>Each render is pixel-diffed against the print SVG (differing pixels as a share of inked pixels). Median / worst:
default font <b>${pct(summary.defaultFont.median)}</b> / ${pct(summary.defaultFont.max)},
same font (New Computer Modern Math) <b>${pct(summary.sameFont.median)}</b> / ${pct(summary.sameFont.max)},
same SVG <b>${pct(summary.sameSvg.median)}</b> / ${pct(summary.sameSvg.max)}. Chromium only. Generated by sandbox/converters/scripts/same-font.mjs.</p>
<table><tr><th>LaTeX</th><th>Print (MathJax SVG)</th><th>Browser MathML, default font</th><th>Browser MathML, same font</th><th>Browser, same SVG</th></tr>
${results.map((r) => `<tr><td>${esc(r.latex)}</td><td>${im(r.img[0])}</td>${[1, 2, 3].map((i) => `<td>${im(r.img[i])}<div class="n">${pct([r.defaultFont, r.sameFont, r.sameSvg][i - 1])} differ</div></td>`).join('')}</tr>`).join('\n')}
</table>`);
console.log(JSON.stringify(summary, null, 2));
