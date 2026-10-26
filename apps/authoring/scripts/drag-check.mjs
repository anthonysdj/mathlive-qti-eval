// Drives the running Angular app (pnpm start) in Chromium to check building
// an equation by dragging palette pieces with a real mouse, and with a real
// touch on a phone: into the empty field, into the empty boxes of pieces
// dropped earlier, and after what is there. Also checks that a plain click
// and the keyboard still insert at the cursor.
// Usage: pnpm start, then node scripts/drag-check.mjs [url] → findings/drag-check.json
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4200/';
const shots = new URL('../../../findings/screenshots/', import.meta.url).pathname;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const out = { url, errors: [] };

async function newPage(contextOptions = { viewport: { width: 1280, height: 900 } }) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts could not be loaded/.test(m.text()) && out.errors.push(m.text()));
  await page.goto(url);
  await page.waitForSelector('.fr-element math-eq');
  return page;
}

const dialogSel = 'dialog.math-eq-dialog[open]';
const fieldLatex = (page) => page.locator('dialog math-field').evaluate((mf) => mf.getValue('latex'));
const lastStoredTex = async (page) => {
  const stored = await page.locator('pre.stored').textContent();
  return [...stored.matchAll(/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g)].map((m) => m[1].replace(/&amp;/g, '&')).at(-1);
};

async function openInsert(page, tap = false) {
  const p = page.locator('.fr-element p').first();
  if (tap) await p.tap({ position: { x: 2, y: 8 } });
  else await p.click({ position: { x: 2, y: 8 } });
  await page.keyboard.press('End');
  if (tap) await page.tap('[data-cmd="insertEquation"]');
  else await page.click('[data-cmd="insertEquation"]');
  await page.waitForSelector(dialogSel);
  await page.waitForTimeout(300);
}

/** Where to drop: 'field' (its middle), 'end' (right of the content), or the n-th empty box (-1: the last) */
const point = (page, where) =>
  page.locator('dialog math-field').evaluate((mf, where) => {
    const r = mf.getBoundingClientRect();
    if (where === 'field') return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (where === 'end') return { x: r.right - 40, y: r.top + r.height / 2 }; // clear of the menu toggle
    const boxes = [];
    for (let o = 0; o <= mf.lastOffset; o++) {
      const i = mf.getElementInfo(o);
      if (i?.latex === '\\placeholder{}') boxes.push(i.bounds);
    }
    const b = boxes.at(where);
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, where);

const keyCenter = async (page, tab, id) => {
  await page.click(`#eb-tab-${tab}`);
  const b = await page.locator(`dialog [data-item="${id}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/** Real mouse: press on a palette key, move in steps, release */
async function mouseDrag(page, tab, id, where, { shot } = {}) {
  const from = await keyCenter(page, tab, id);
  const to = await point(page, where);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  const during = await page.evaluate(() => {
    const m = document.querySelector('.eb-drop-mark');
    return { ghost: !!document.querySelector('.eb-drag-ghost'), mark: m?.style.display, slot: m?.dataset.slot, fieldOutlined: document.querySelector('dialog math-field').classList.contains('eb-drop-over') };
  });
  if (shot) await page.screenshot({ path: `${shots}${shot}` });
  await page.mouse.up();
  await page.waitForTimeout(150);
  return { piece: id, where, during, latex: await fieldLatex(page) };
}

// ---------------------------------------------------------------------------
// 1. Desktop: build \frac{\sqrt{\frac{1}{4}}}{\pi}+x^{2} by dragging
// ---------------------------------------------------------------------------
{
  const page = await newPage();
  await openInsert(page);
  const steps = (out.mouse = []);
  steps.push(await mouseDrag(page, 'fractions', 'frac', 'field'));
  steps.push(await mouseDrag(page, 'roots', 'sqrt', 0, { shot: 'drag-into-box.png' }));
  steps.push(await mouseDrag(page, 'fractions', 'frac', 0));
  steps.push(await mouseDrag(page, 'greek', 'pi', -1));
  steps.push(await mouseDrag(page, 'operators', 'plus', 'end', { shot: 'drag-after.png' }));
  steps.push(await mouseDrag(page, 'scripts', 'power', 'end'));
  // The drop left the caret in the power's first box: type, Tab, type
  await page.keyboard.type('x');
  await page.keyboard.press('Tab');
  await page.keyboard.type('2');
  // The two boxes of the inner fraction: click them, as an author would
  for (const n of ['1', '4']) {
    const p = await point(page, 0);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.type(n);
  }
  await page.waitForTimeout(300);
  out.built = { latex: await fieldLatex(page), previewLatex: await page.locator('dialog .eb-latex').textContent() };
  await page.screenshot({ path: `${shots}drag-built.png` });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(150);
  out.built.stored = await lastStoredTex(page);
  out.built.storedMathml = (await page.locator('pre.stored').textContent()).match(/<math[\s\S]*?<\/math>/g)?.at(-1);

  // A click (no drag) still inserts at the caret; then Tab to the empty
  // denominator and press Enter on a key reached by keyboard (the panel's
  // own tab order is in builder-check.json)
  await openInsert(page);
  await page.click('#eb-tab-fractions');
  await page.click('dialog [data-item="frac"]');
  await page.keyboard.type('a');
  await page.keyboard.press('Tab');
  await page.click('#eb-tab-roots');
  await page.locator('dialog [data-item="sqrt"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('b');
  await page.waitForTimeout(150);
  out.keyboard = {};
  out.keyboard.clickThenKeyboard = await fieldLatex(page);
  await page.locator('dialog [data-action="cancel"]').click();
  await page.context().close();
}

// ---------------------------------------------------------------------------
// 2. Phone: the same with a finger (touch events through the DevTools protocol)
// ---------------------------------------------------------------------------
{
  const page = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const cdp = await page.context().newCDPSession(page);
  await openInsert(page, true);
  // The virtual keyboard shows itself on touch; hide it so the field and palette are in view
  await page.evaluate(() => window.mathVirtualKeyboard.hide());
  await page.waitForTimeout(300);
  const touch = async (tab, id, where) => {
    // (Switching tabs isn't what's checked here; a tap on one can land
    // outside the viewport while MathLive's keyboard is sliding away)
    await page.evaluate(() => window.mathVirtualKeyboard.hide());
    await page.locator(`#eb-tab-${tab}`).evaluate((t) => t.click());
    await page.waitForTimeout(300);
    // Field at the top of the dialog, so it and the key are both on screen
    await page.evaluate(() => {
      document.querySelector('dialog[open]').scrollTop = 0;
      window.scrollTo(0, 0);
    });
    const from = await page.locator(`dialog [data-item="${id}"]`).evaluate((k) => {
      const r = k.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const to = await point(page, where);
    const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    await send('touchStart', from);
    for (let s = 1; s <= 10; s++) await send('touchMove', { x: from.x + ((to.x - from.x) * s) / 10, y: from.y + ((to.y - from.y) * s) / 10 });
    await send('touchEnd');
    await page.waitForTimeout(200);
    return { piece: id, where, from: [from.x, from.y].map(Math.round), to: [to.x, to.y].map(Math.round), latex: await fieldLatex(page) };
  };
  out.touch = [];
  out.touch.push(await touch('fractions', 'frac', 'field'));
  out.touch.push(await touch('greek', 'pi', 0));
  out.touch.push(await touch('operators', 'plus', 'end'));
  out.touch.scrolled = await page.evaluate(() => document.querySelector('dialog[open]').scrollTop);
  await page.screenshot({ path: `${shots}drag-phone.png` });
  await page.context().close();
}

await browser.close();
await writeFile(new URL('../../../findings/drag-check.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
