// Drives the running Angular app (pnpm start) in Chromium to check saving a
// built equation and getting it back: by its typed shortcut, from "My
// equations" (click and drag), after a reload, under a profile that refuses
// part of it, and after deleting it.
// Usage: pnpm start, then node scripts/saved-check.mjs [url] → findings/saved-check.json
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4200/';
const shots = new URL('../../../findings/screenshots/', import.meta.url).pathname;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const out = { url, errors: [] };

const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', (e) => out.errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/fonts could not be loaded/.test(m.text()) && out.errors.push(m.text()));

const dialogSel = 'dialog.math-eq-dialog[open]';
const fieldLatex = () => page.locator('dialog math-field').evaluate((mf) => mf.getValue('latex'));
const lastStoredTex = async () => {
  const stored = await page.locator('pre.stored').textContent();
  return [...stored.matchAll(/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g)].map((m) => m[1].replace(/&amp;/g, '&')).at(-1);
};
async function load() {
  await page.goto(url);
  await page.waitForSelector('.fr-element math-eq');
}
async function openInsert() {
  await page.locator('.fr-element p').first().click({ position: { x: 2, y: 8 } });
  await page.keyboard.press('End');
  await page.click('[data-cmd="insertEquation"]');
  await page.waitForSelector(dialogSel);
  await page.waitForFunction(() => document.activeElement?.localName === 'math-field');
  await page.waitForTimeout(200);
}
async function closeDialog() {
  await page.locator('dialog [data-action="cancel"]').click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
}
// Angular renders after the event: give it a moment
const tab = async (id) => {
  await page.click(`#eb-tab-${id}`);
  await page.waitForTimeout(100);
};
const savedRows = () => page.locator('dialog .eb-saved li').evaluateAll((lis) => lis.map((li) => `${li.querySelector('.eb-saved-name').textContent} (${li.querySelector('.eb-saved-shortcut')?.textContent.trim() ?? 'no shortcut'})`));

await load();
await page.evaluate(() => localStorage.removeItem('eb-saved-equations'));
await load();

// 1. Build the quadratic formula with the palette and the keyboard, then save it
await openInsert();
await tab('saved');
out.emptyState = (await page.locator('dialog .eb-panel .eb-hint').textContent()).trim();
await tab('fractions');
await page.click('dialog [data-item="frac"]');
await page.keyboard.type('-b');
await tab('operators');
await page.click('dialog [data-item="plus-minus"]');
await tab('roots');
await page.click('dialog [data-item="sqrt"]');
await page.keyboard.type('b^2-4ac');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowDown');
await page.keyboard.type('2a');
out.built = await fieldLatex();

await page.click('dialog .eb-save-open');
await page.fill('#eb-save-name', 'Quadratic formula');
await page.fill('#eb-save-shortcut', 'sin');
await page.click('dialog .eb-save-form button[type="submit"]');
await page.waitForTimeout(100);
out.takenShortcutError = await page.locator('dialog .eb-save-form .eb-entry-error').textContent();
await page.fill('#eb-save-shortcut', 'quad f');
await page.keyboard.press('Enter'); // Enter in the form saves it, and doesn't insert the equation
await page.waitForTimeout(100);
out.badShortcutError = await page.locator('dialog .eb-save-form .eb-entry-error').textContent();
out.dialogStillOpenAfterEnter = (await page.locator(dialogSel).count()) === 1;
await page.fill('#eb-save-shortcut', 'quadf');
await page.screenshot({ path: `${shots}saved-form.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
out.savedNote = await page.locator('dialog .eb-saved-note').textContent();
out.focusAfterSave = await page.evaluate(() => document.activeElement?.localName);
await page.keyboard.press('Enter'); // the dialog's own Enter: insert into the document
await page.waitForFunction(() => !document.querySelector('dialog[open]'));
await page.waitForTimeout(150);
out.storedFirst = await lastStoredTex();

// 2. A new equation: type x= then the shortcut
await openInsert();
await page.keyboard.type('x=quadf');
await page.waitForTimeout(150);
out.byShortcut = await fieldLatex();
await tab('saved');
out.myEquations = await savedRows();
await page.screenshot({ path: `${shots}saved-tab.png` });
await page.locator('dialog math-field').focus();
await page.waitForTimeout(100);
await page.keyboard.press('Enter');
await page.waitForFunction(() => !document.querySelector('dialog[open]'));
await page.waitForTimeout(150);
out.storedByShortcut = await lastStoredTex();
out.storedMathml = (await page.locator('pre.stored').textContent()).match(/<math[\s\S]*?<\/math>/g)?.at(-1);

// 3. After a reload: still there; click it, and drag it into an empty box
await load();
await openInsert();
await tab('saved');
out.afterReload = await savedRows();
await page.click('dialog .eb-saved [data-item^="saved-"]');
out.byClick = await fieldLatex();
await page.locator('dialog math-field').evaluate((mf) => mf.setValue('y=\\frac{1}{\\placeholder{}}'));
await page.waitForTimeout(100);
const key = await page.locator('dialog .eb-saved [data-item^="saved-"]').boundingBox();
const box = await page.locator('dialog math-field').evaluate((mf) => {
  for (let o = 0; o <= mf.lastOffset; o++) {
    const i = mf.getElementInfo(o);
    if (i?.latex === '\\placeholder{}') return { x: i.bounds.left + i.bounds.width / 2, y: i.bounds.top + i.bounds.height / 2 };
  }
});
await page.mouse.move(key.x + key.width / 2, key.y + key.height / 2);
await page.mouse.down();
await page.mouse.move(box.x, box.y, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(150);
out.byDragIntoBox = await fieldLatex();
await closeDialog();

// 4. A profile without roots and powers: not offered, and the shortcut does nothing
await page.selectOption('#profile', 'arithmetic');
await openInsert();
await page.keyboard.type('quadf');
await page.waitForTimeout(150);
out.arithmetic = { typed: await fieldLatex() };
await tab('saved');
out.arithmetic.tab = (await page.locator('dialog .eb-panel .eb-hint').first().textContent()).trim();
await closeDialog();
await page.selectOption('#profile', 'everything');

// 5. Delete it; gone after a reload too, and keyboard focus stays in the tabs
await openInsert();
await tab('saved');
await page.locator('dialog .eb-saved-delete').first().focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(100);
out.deleted = { note: await page.locator('dialog .eb-saved-note').textContent(), focus: await page.evaluate(() => document.activeElement?.id) };
await closeDialog();
await load();
await openInsert();
await page.keyboard.type('quadf');
await page.waitForTimeout(150);
out.deleted.shortcutAfterReload = await fieldLatex();
await closeDialog();

await browser.close();
await writeFile(new URL('../../../findings/saved-check.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
