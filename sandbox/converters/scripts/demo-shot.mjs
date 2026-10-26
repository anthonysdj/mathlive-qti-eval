// Drives the built insert-equation demo (pnpm build) like an author would and
// screenshots it: type text, insert two equations, edit one.
// Usage: pnpm build && node scripts/demo-shot.mjs
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ preview: { port: 4179 }, logLevel: 'silent' });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4179/');
await page.waitForFunction(() => customElements.get('math-field'));

// Caret at the end of the text, then insert the quadratic formula
const doc = page.locator('#doc');
await doc.click();
await page.keyboard.press('End');
await page.click('#insert');
await page.waitForSelector('#doc .eq svg');

// More text, then a second equation set from LaTeX
await doc.click();
await page.keyboard.press('End');
await page.keyboard.type(' for every x ∈ ');
await page.evaluate(() => document.getElementById('mf').setValue('\\mathbb{R}\\text{, and } \\ce{2H2 + O2 -> 2H2O}'));
await page.click('#insert');
await page.waitForFunction(() => document.querySelectorAll('#doc .eq').length === 2);

// Edit the first equation: click it, change it, Update
await page.locator('#doc .eq').first().click();
const loaded = await page.evaluate(() => document.getElementById('mf').value);
await page.evaluate(() => document.getElementById('mf').setValue('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a},\\ a\\neq0'));
await page.click('#insert');
await page.waitForFunction(() => document.querySelectorAll('#doc .eq').length === 2 && !document.querySelector('.editing'));

const result = await page.evaluate(() => ({
  equations: document.querySelectorAll('#doc .eq').length,
  stored: document.getElementById('stored').textContent,
  status: document.getElementById('status').textContent,
}));
const aria = await page.locator('#doc').ariaSnapshot();
await page.screenshot({ path: '../../findings/screenshots/insert-demo.png', fullPage: true });
await browser.close();
server.httpServer.close();
console.log(JSON.stringify({ errors, loadedForEdit: loaded, ...result, aria }, null, 2));
