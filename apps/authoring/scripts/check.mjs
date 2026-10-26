// Drives the built Angular app (pnpm build) in Chromium: insert, edit, save,
// reload through the two-way binding, then mount/unmount the editor component
// 20 times and check that nothing is left behind.
// Usage: pnpm build && node scripts/check.mjs
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../dist/authoring/browser/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const path = join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4183);

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
// Count listeners on window/document/body, including ones removed by
// AbortSignal or by `once` (same counting as sandbox/froala/tests/teardown.test.ts)
await page.addInitScript(() => {
  const live = (window.__listeners = new Map());
  const watched = (t) => t === window || t === document || t === document.body;
  const key = (t, type) => `${t === window ? 'window' : t === document ? 'document' : 'body'}:${type}`;
  const bump = (k, d) => live.set(k, (live.get(k) ?? 0) + d);
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (!watched(this) || !fn) return add.call(this, type, fn, opts);
    const k = key(this, type);
    let gone = false;
    const done = () => { if (!gone) bump(k, -1); gone = true; };
    bump(k, 1);
    if (typeof opts === 'object' && opts?.signal) opts.signal.addEventListener('abort', done);
    if (typeof opts === 'object' && opts?.once) {
      const orig = fn;
      fn = function (ev) { done(); return typeof orig === 'function' ? orig.call(this, ev) : orig.handleEvent(ev); };
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    if (watched(this) && fn) bump(key(this, type), -1);
    return remove.call(this, type, fn, opts);
  };
});
await page.goto('http://localhost:4183/');
await page.waitForSelector('.fr-element math-eq');
await page.waitForFunction(() => [...document.querySelectorAll('math-eq')].every((e) => e.shadowRoot.querySelector('svg')));
const out = {};
const stored = () => page.locator('pre.stored').textContent();
out.initialEquations = await page.locator('.fr-element math-eq').count();
out.previewEquations = await page.locator('.preview math-eq').count();

// Insert at the end of the paragraph
await page.locator('.fr-element p').first().click();
await page.keyboard.press('End');
await page.click('[data-cmd="insertEquation"]');
await page.waitForSelector('dialog.math-eq-dialog[open]');
await page.waitForTimeout(150);
await page.keyboard.type('x=2');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelectorAll('.fr-element math-eq').length === 3);
await page.waitForTimeout(100);
out.storedAfterInsert = (await stored()).includes('<annotation encoding="application/x-tex">x=2</annotation>');

// A formula that needs one of MathJax's on-demand font ranges (double-struck)
await page.locator('.fr-element math-eq').nth(2).click();
await page.waitForSelector('dialog.math-eq-dialog[open]');
await page.locator('dialog math-field').evaluate((mf) => mf.setValue('x\\in\\mathbb{R}'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelectorAll('.fr-element math-eq')[2].getAttribute('data-mathml').includes('mathbb'));
await page.waitForTimeout(500);
out.mathbbGlyphs = await page.evaluate(() => document.querySelectorAll('.fr-element math-eq')[2].shadowRoot.querySelectorAll('svg path').length);
out.previewAfterInsert = await page.locator('.preview math-eq').count();

// Edit the first one
await page.locator('.fr-element math-eq').first().click();
await page.waitForSelector('dialog.math-eq-dialog[open]');
out.loadedForEdit = await page.locator('dialog math-field').evaluate((mf) => mf.value);
await page.locator('dialog math-field').evaluate((mf) => mf.setValue('x^2-5x+6=(x-2)(x-3)'));
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
out.storedAfterEdit = (await stored()).includes('x^2-5x+6=(x-2)(x-3)');

// Save, replace with the sample, load the saved version back
await page.click('text=Save');
const saved = await stored();
await page.click('text=Load sample');
await page.waitForFunction(() => document.querySelectorAll('.fr-element math-eq').length === 2);
await page.click('text=Load saved');
await page.waitForFunction(() => document.querySelectorAll('.fr-element math-eq').length === 3);
await page.waitForTimeout(100);
out.loadSavedRoundTrip = (await stored()) === saved;
out.savedIsXml = await page.evaluate((s) => !new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${s}</div>`, 'application/xml').querySelector('parsererror'), saved);
await page.waitForFunction(() => [...document.querySelectorAll('math-eq')].every((e) => e.shadowRoot.querySelector('svg')));
await page.screenshot({ path: '../../findings/screenshots/angular-demo.png', fullPage: true });
out.aria = await page.locator('.fr-element').ariaSnapshot();

// Teardown: unmount/mount the component 20 times, every other time with the dialog open
const toggle = page.locator('label.toggle input');
// Baseline: a fresh editor whose dialog hasn't been created yet
await toggle.click();
await page.waitForFunction(() => !document.querySelector('app-math-froala-editor'));
await toggle.click();
await page.waitForSelector('.fr-element math-eq');
await page.mouse.click(5, 5);
const before = await page.evaluate(() => Object.fromEntries(window.__listeners));
for (let i = 0; i < 20; i++) {
  if (i % 2 === 0) {
    await page.locator('.fr-element math-eq').first().click();
    await page.waitForSelector('dialog.math-eq-dialog[open]');
  }
  // off: from script, as a route change would (an open modal dialog makes the page inert)
  await toggle.evaluate((el) => el.click());
  await page.waitForFunction(() => !document.querySelector('app-math-froala-editor'));
  await toggle.click(); // on
  await page.waitForSelector('.fr-element math-eq');
}
await page.mouse.click(5, 5); // one click anywhere releases MathLive's one-shot focus listeners
const after = await page.evaluate(() => Object.fromEntries(window.__listeners));
out.listenerGrowth = Object.keys(after).filter((k) => after[k] !== (before[k] ?? 0)).map((k) => `${k} ${after[k] - (before[k] ?? 0)}`);
out.leftovers = await page.evaluate(() => ({
  editors: document.querySelectorAll('.fr-box').length, // the one mounted now
  dialogs: document.querySelectorAll('dialog').length,
  keyboardContainer: window.mathVirtualKeyboard.container === document.body ? 'body' : 'moved',
}));

// Unmount in the same task as the mount: is an orphan editor left behind?
await page.evaluate(() => new Promise((resolve) => {
  const input = document.querySelector('label.toggle input');
  input.click(); // off
  setTimeout(() => {
    const mo = new MutationObserver(() => {
      if (document.querySelector('app-math-froala-editor')) {
        mo.disconnect();
        input.click(); // off again as soon as the component exists
        setTimeout(resolve, 500);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    input.click(); // on
  }, 100);
}));
out.raceLeftovers = await page.evaluate(() => ({ editors: document.querySelectorAll('.fr-box').length, dialogs: document.querySelectorAll('dialog').length }));

await browser.close();
server.close();
out.errors = errors;
await writeFile('../../findings/angular-check.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
