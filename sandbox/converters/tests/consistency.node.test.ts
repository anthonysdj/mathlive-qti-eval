// Screen/print consistency: the same SVG, drawn by Chromium (screen) and by
// resvg (a non-browser rasteriser standing in for the PDF engine), must give
// the same pixels up to anti-aliasing. Full report: scripts/consistency.mjs.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { mathmlToSvg } from '../src/print-node';

type Row = { id: string; results: Record<string, { mathml: string }> };
const rows: Row[] = JSON.parse(
  readFileSync(new URL('../../../findings/mathml-converters-raw.json', import.meta.url), 'utf8')
);

const PX_PER_UNIT = 0.048; // 1000 MathJax units per em → 48px em
// Measured 2026-10-26: median 0.28%, max 2.69% (\bar). Anything above this is
// a real rendering difference, not anti-aliasing.
const MAX_RATIO = 0.03;

function sized(svg: string) {
  const [, , vbw, vbh] = svg.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
  const w = Math.ceil(vbw * PX_PER_UNIT);
  const h = Math.ceil(vbh * PX_PER_UNIT);
  return {
    w,
    h,
    svg: svg
      .replace(/ style="vertical-align:[^"]*"/, '')
      .replace(/ width="[^"]*ex"/, ` width="${w}"`)
      .replace(/ height="[^"]*ex"/, ` height="${h}"`)
      .replace(/currentColor/g, '#000'),
  };
}

let browser: Browser;
let page: Page;
beforeAll(async () => {
  browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  page = await browser.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 1 });
  await page.setContent(
    '<!doctype html><body style="margin:0;background:#fff"><div id="box" style="display:inline-block;line-height:0;overflow:hidden;background:#fff"></div>'
  );
});
afterAll(() => browser?.close());

describe('the same SVG looks the same on screen and in print', () => {
  it.each(rows.map((r) => [r.id, r.results['Temml 0.14.0'].mathml]))('%s', async (_id, mathml) => {
    const { svg, w, h } = sized(await mathmlToSvg(mathml));
    const print = PNG.sync.read(new Resvg(svg, { background: '#ffffff' }).render().asPng());
    await page.evaluate(
      ({ svg, w, h }) => {
        const box = document.getElementById('box')!;
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.innerHTML = svg;
      },
      { svg, w, h }
    );
    const screen = PNG.sync.read(await page.locator('#box').screenshot());
    expect([screen.width, screen.height]).toEqual([print.width, print.height]);

    const changed = pixelmatch(screen.data, print.data, undefined, w, h, { threshold: 0.1 });
    let ink = 0;
    for (let i = 0; i < print.data.length; i += 4) if (print.data[i] < 200 || screen.data[i] < 200) ink++;
    expect(ink).toBeGreaterThan(0);
    expect(changed / ink).toBeLessThan(MAX_RATIO);
  });
});
