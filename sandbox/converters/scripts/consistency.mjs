// Proof that screen and print can look identical when both use the same SVG.
// For every formula, the same MathJax SVG (findings/print-svg-raw.json) is
// rendered twice, at the same pixel size:
//   screen: Chromium, the SVG inline in an HTML page (what a candidate sees)
//   print:  resvg, a separate non-browser SVG renderer, standing in for the
//           PDF engine's SVG rasteriser
// and the two images are pixel-diffed. For contrast, today's setup (native
// MathML on screen vs SVG in print) is diffed the same way.
// Usage: pnpm print && node scripts/consistency.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const PX_PER_UNIT = 0.048; // MathJax uses 1000 units per em → a 48px em
const { rows } = JSON.parse(readFileSync('../../findings/print-svg-raw.json', 'utf8'));

/** Fix the SVG to an exact pixel size and black ink, so both renderers draw the same box */
function sized(svg) {
  const [, , vbw, vbh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const w = Math.ceil(vbw * PX_PER_UNIT);
  const h = Math.ceil(vbh * PX_PER_UNIT);
  const fixed = svg
    .replace(/ style="vertical-align:[^"]*"/, '')
    .replace(/ width="[^"]*ex"/, ` width="${w}"`)
    .replace(/ height="[^"]*ex"/, ` height="${h}"`)
    .replace(/currentColor/g, '#000');
  return { svg: fixed, w, h };
}

function diff(a, b, w, h) {
  const out = new PNG({ width: w, height: h });
  const changed = pixelmatch(a.data, b.data, out.data, w, h, { threshold: 0.1 });
  let ink = 0;
  for (let i = 0; i < b.data.length; i += 4) if (b.data[i] < 200 || a.data[i] < 200) ink++;
  return { changed, ink, ratio: ink ? changed / ink : 0, png: PNG.sync.write(out) };
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 1 });
await page.setContent('<!doctype html><body style="margin:0;background:#fff"><div id="box" style="display:inline-block;line-height:0;overflow:hidden;background:#fff"></div>');

const results = [];
for (const r of rows) {
  const { svg, w, h } = sized(r.svg);

  // Print side: resvg (no browser)
  const print = PNG.sync.read(new Resvg(svg, { background: '#ffffff' }).render().asPng());

  // Screen side: Chromium, inline SVG
  await page.evaluate(({ svg, w, h }) => {
    const box = document.getElementById('box');
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    box.innerHTML = svg;
  }, { svg, w, h });
  const screen = PNG.sync.read(await page.locator('#box').screenshot());

  // Baseline: native MathML on screen, scaled into the same box
  await page.evaluate(({ mathml, w, h }) => {
    const box = document.getElementById('box');
    box.innerHTML = `<span id="m" style="display:inline-block;font-size:48px;line-height:normal;transform-origin:0 0">${mathml}</span>`;
    const m = document.getElementById('m');
    const r = m.getBoundingClientRect();
    m.style.transform = `scale(${w / r.width}, ${h / r.height})`;
  }, { mathml: r.mathml, w, h });
  const native = PNG.sync.read(await page.locator('#box').screenshot());

  const same = diff(screen, print, w, h);
  const before = diff(native, print, w, h);
  results.push({
    id: r.id, latex: r.latex, w, h,
    sameSvg: { changed: same.changed, ink: same.ink, ratio: same.ratio },
    nativeVsSvg: { changed: before.changed, ink: before.ink, ratio: before.ratio },
    images: {
      screen: PNG.sync.write(screen).toString('base64'),
      print: PNG.sync.write(print).toString('base64'),
      diff: same.png.toString('base64'),
      native: PNG.sync.write(native).toString('base64'),
      nativeDiff: before.png.toString('base64'),
    },
  });
}
await browser.close();

const pct = (x) => `${(x * 100).toFixed(2)}%`;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summary = {
  pxPerUnit: PX_PER_UNIT,
  sameSvg: { median: median(results.map((r) => r.sameSvg.ratio)), max: Math.max(...results.map((r) => r.sameSvg.ratio)) },
  nativeVsSvg: { median: median(results.map((r) => r.nativeVsSvg.ratio)), max: Math.max(...results.map((r) => r.nativeVsSvg.ratio)) },
};
writeFileSync(
  '../../findings/consistency-raw.json',
  JSON.stringify({ summary, rows: results.map(({ images, ...rest }) => rest) }, null, 2)
);

const img = (b64) => `<img src="data:image/png;base64,${b64}">`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
writeFileSync('../../findings/consistency.html', `<!doctype html><meta charset="utf-8"><title>Screen vs print consistency</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;color:#222;background:#fff}table{border-collapse:collapse}
td,th{border:1px solid #ddd;padding:4px 8px;vertical-align:middle}th{background:#f4f4f4}td:first-child{font:12px ui-monospace,monospace;max-width:200px}
img{max-height:90px;max-width:260px}.n{text-align:right;font-variant-numeric:tabular-nums}</style>
<h1>Same SVG on screen (Chromium) and in print (resvg)</h1>
<p>Differing pixels as a share of inked pixels (pixelmatch, threshold 0.1). Median, same SVG: <b>${pct(summary.sameSvg.median)}</b>
(max ${pct(summary.sameSvg.max)}). Today's setup, native MathML vs SVG: median <b>${pct(summary.nativeVsSvg.median)}</b> (max ${pct(summary.nativeVsSvg.max)}).
Generated by sandbox/converters/scripts/consistency.mjs.</p>
<table><tr><th>LaTeX</th><th>Screen (Chromium, SVG)</th><th>Print (resvg, SVG)</th><th>Diff</th><th>Same SVG</th><th>Screen today (native MathML)</th><th>Diff vs print</th><th>Today</th></tr>
${results.map((r) => `<tr><td>${esc(r.latex)}</td><td>${img(r.images.screen)}</td><td>${img(r.images.print)}</td><td>${img(r.images.diff)}</td><td class="n">${pct(r.sameSvg.ratio)}</td><td>${img(r.images.native)}</td><td>${img(r.images.nativeDiff)}</td><td class="n">${pct(r.nativeVsSvg.ratio)}</td></tr>`).join('\n')}
</table>`);
console.log(JSON.stringify(summary, null, 2));
for (const r of results) if (r.sameSvg.ratio > 0.02) console.log('above 2%:', r.id, pct(r.sameSvg.ratio));
