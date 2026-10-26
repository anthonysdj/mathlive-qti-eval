// Drives the built Froala demo (pnpm build) in a top-level page, like an
// author: insert with the toolbar and the virtual keyboard, edit, save,
// reload, load Wiris content. Checks what the Vitest suite can't (it runs in
// an iframe, where MathLive's keyboard can't be moved into the dialog) and
// takes the screenshots for docs/02-froala-integration.md.
// Usage: pnpm build && node scripts/demo-check.mjs
import { preview } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const server = await preview({ preview: { port: 4181 }, logLevel: 'silent' });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto('http://localhost:4181/');
await page.waitForSelector('.fr-element math-eq');
const shots = '../../findings/screenshots';
const out = {};

// 1. Caret at the end of the second paragraph, then the toolbar button
await page.locator('.fr-element p').nth(1).click();
await page.keyboard.press('End');
await page.click('[data-cmd="insertEquation"]');
await page.waitForSelector('dialog.math-eq-dialog[open]');
await page.waitForTimeout(150);

// 2. Type with the physical keyboard, then finish with the virtual keyboard
await page.keyboard.type('x=');
await page.locator('dialog math-field').evaluate((mf) => mf.executeCommand(['insert', '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}']));
await page.locator('dialog math-field').evaluate((mf) => mf.executeCommand('moveToMathfieldEnd'));
await page.locator('dialog math-field').evaluate(() => window.mathVirtualKeyboard.show());
await page.waitForSelector('dialog .ML__keyboard.is-visible', { state: 'attached', timeout: 5000 });
await page.waitForTimeout(400);
out.keyboardInsideDialog = await page.evaluate(() => document.querySelector('dialog.math-eq-dialog').contains(document.querySelector('.ML__keyboard')));
// A real click on a keycap must reach the keyboard, not the inert page behind the dialog
const pi = page.locator('.MLK__keycap', { hasText: 'π' }).first();
const before = await page.locator('dialog math-field').evaluate((mf) => mf.value);
await pi.click({ timeout: 3000 }).catch((e) => errors.push(`keycap click: ${e.message.split('\n')[0]}`));
await page.waitForTimeout(100);
out.keycapClickTyped = (await page.locator('dialog math-field').evaluate((mf) => mf.value)) !== before;
await page.screenshot({ path: `${shots}/froala-dialog-keyboard.png` });
await page.evaluate(() => window.mathVirtualKeyboard.hide());
await page.locator('dialog math-field').evaluate((mf) => mf.executeCommand('deleteBackward'));
await page.locator('dialog math-field').focus();
await page.keyboard.press('Enter');
await page.waitForSelector('dialog.math-eq-dialog:not([open])', { state: 'attached' });
await page.waitForFunction(() => document.querySelectorAll('.fr-element math-eq').length === 2);
out.keyboardBackInBody = await page.evaluate(() => window.mathVirtualKeyboard.container === document.body);

// 3. Edit the first equation: click it, change it, Enter
await page.locator('.fr-element math-eq').first().click();
await page.waitForSelector('dialog.math-eq-dialog[open]');
out.loadedForEdit = await page.locator('dialog math-field').evaluate((mf) => mf.value);
await page.screenshot({ path: `${shots}/froala-edit.png` });
await page.locator('dialog math-field').evaluate((mf) => mf.setValue('ax^2+bx+c=0,\\ a\\neq0'));
await page.keyboard.press('Enter');
await page.waitForSelector('dialog.math-eq-dialog:not([open])', { state: 'attached' });

// 4. Type after the equation, save, reload into a new editor
await page.keyboard.type(' (quadratic)');
await page.click('#save');
const saved = await page.locator('#stored').textContent();
await page.click('#reload');
await page.waitForFunction(() => /reload/.test(document.getElementById('status').textContent));
out.afterReload = await page.locator('#status').textContent();
const reloaded = await page.locator('#stored').textContent();
out.reloadIdentical = reloaded === saved;
// Froala turns the U+00A0 Chromium typed after the equation into a space on
// load (it does that to plain text too); after that, reloads are stable.
out.reloadDifference = reloaded === saved.replace('</math>\u00a0(quadratic)', '</math> (quadratic)') ? 'only the typed U+00A0 became a space' : 'other';
await page.click('#reload');
await page.waitForTimeout(300);
out.secondReloadIdentical = (await page.locator('#stored').textContent()) === reloaded;
out.saved = saved;
out.savedIsXml = await page.evaluate((s) => {
  const d = new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml">${s}</div>`, 'application/xml');
  return !d.querySelector('parsererror');
}, saved);
await page.waitForFunction(() => Array.from(document.querySelectorAll('.fr-element math-eq')).every((e) => e.shadowRoot.querySelector('svg')));
await page.screenshot({ path: `${shots}/froala-demo.png`, fullPage: true });
out.aria = await page.locator('.fr-element').ariaSnapshot();

// 5. Wiris content
await page.click('#wiris');
await page.waitForFunction(() => document.querySelectorAll('.fr-element math-eq').length === 3);
await page.waitForFunction(() => Array.from(document.querySelectorAll('.fr-element math-eq')).every((e) => e.shadowRoot.querySelector('svg')));
out.wirisSaved = await page.locator('#stored').textContent();
await page.locator('.fr-element math-eq').first().click();
await page.waitForSelector('dialog.math-eq-dialog[open]');
out.wirisLatexForEdit = await page.locator('dialog math-field').evaluate((mf) => mf.value);
out.wirisNote = await page.locator('dialog .note').textContent();
await page.screenshot({ path: `${shots}/froala-wiris.png` });

await browser.close();
server.httpServer.close();
out.errors = errors;
writeFileSync('../../findings/froala-demo-check.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
