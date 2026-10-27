// Drives the built Angular app (pnpm build) in Chromium to check the equation
// builder and to measure the panel against the custom virtual keyboard:
// the same formulas entered both ways (actions counted, results compared),
// what each exposes to assistive technology, and how much screen each takes
// on a desktop and a phone.
// Usage: pnpm build && node scripts/builder-check.mjs → findings/builder-check.json
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../dist/authoring/browser/', import.meta.url).pathname;
const shots = new URL('../../../findings/screenshots/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const path = join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4184);

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const out = { errors: [] };

async function newPage(contextOptions = { viewport: { width: 1280, height: 900 } }) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && out.errors.push(`${r.status()} ${r.url()}`));
  await page.goto('http://localhost:4184/');
  await page.waitForSelector('.fr-element math-eq');
  return page;
}

const dialogSel = 'dialog.math-eq-dialog[open]';
const fieldLatex = (page) => page.locator('dialog math-field').evaluate((mf) => mf.getValue('latex'));
const lastStoredTex = async (page) => {
  const stored = await page.locator('pre.stored').textContent();
  return [...stored.matchAll(/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')).at(-1);
};

async function settings(page, { profile, ui, theme }) {
  if (profile) await page.selectOption('#profile', profile);
  if (ui) await page.selectOption('#ui', ui);
  if (theme) await page.selectOption('#theme', theme);
}

/** Open the dialog to insert at the end of the first paragraph */
async function openInsert(page) {
  // Click the paragraph's start (its middle may be an equation by now)
  await page.locator('.fr-element p').first().click({ position: { x: 2, y: 8 } });
  await page.keyboard.press('End');
  const t0 = Date.now();
  await page.click('[data-cmd="insertEquation"]');
  await page.waitForSelector(dialogSel);
  await page.waitForFunction(() => document.activeElement?.localName === 'math-field');
  await page.waitForTimeout(150);
  return Date.now() - t0;
}

async function closeDialog(page) {
  if (await page.locator(dialogSel).count()) await page.locator('dialog [data-action="cancel"]').click();
  await page.waitForSelector(dialogSel, { state: 'detached' }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
}

// ---------------------------------------------------------------------------
// 1. The builder in the dialog (desktop, panel)
// ---------------------------------------------------------------------------
{
  const page = await newPage();
  const flows = (out.flows = {});
  flows.firstOpenMs = await openInsert(page);
  flows.tabs = await page.locator('dialog [role="tab"]').allTextContents();
  // Palette template, Tab between its slots, Enter saves
  await page.click('#eb-tab-calculus');
  await page.click('[data-item="defint"]');
  await page.keyboard.type('0');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1');
  await page.keyboard.press('Tab');
  await page.keyboard.type('x^2');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.keyboard.type('x');
  await page.waitForTimeout(250);
  flows.preview = {
    latex: await page.locator('dialog .eb-latex').textContent(),
    spoken: await page.locator('dialog .eb-spoken').textContent(),
    mathmlLines: (await page.locator('dialog .eb-mathml pre').textContent()).split('\n').length,
    printedSvg: await page.locator('dialog .eb-print math-eq').evaluate((e) => e.ready.then(() => !!e.shadowRoot.querySelector('svg'))),
  };
  await page.screenshot({ path: `${shots}builder-panel.png` });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(100);
  flows.storedIntegral = await lastStoredTex(page);

  // Empty slots stop the save
  await openInsert(page);
  await page.click('#eb-tab-fractions');
  await page.click('[data-item="frac"]');
  await page.keyboard.press('Enter');
  flows.emptySlotsError = await page.locator('dialog .error').textContent();
  flows.stillOpen = (await page.locator(dialogSel).count()) === 1;
  await closeDialog(page);

  // Keyboard-only use of the panel: Tab from the field reaches the tabs, arrows move between tabs
  await openInsert(page);
  const tabStops = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    tabStops.push(await page.evaluate(() => {
      const a = document.activeElement;
      return `${a.localName}${a.getAttribute('role') ? `[role=${a.getAttribute('role')}]` : ''} ${a.getAttribute('aria-label') ?? a.textContent.trim().slice(0, 30)}`;
    }));
  }
  flows.tabOrderFromField = tabStops;
  // From the field: Tab to the tab list, arrow to another tab, Tab into its keys, Enter on one
  await closeDialog(page);
  await openInsert(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  flows.arrowToTab = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press('Tab');
  flows.firstKeyAfterTab = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  flows.keyboardOnlyInsert = { latex: await fieldLatex(page), focusBackInField: await page.evaluate(() => document.activeElement?.localName === 'math-field') };
  flows.panelAria = await page.locator('dialog .eb [role="tabpanel"]').ariaSnapshot();
  flows.mathSpanTabbable = await page.locator('dialog math-span').evaluateAll((els) => els.filter((e) => e.tabIndex >= 0).length);
  await closeDialog(page);

  // Profiles: arithmetic refuses powers; typing | with a real keyboard
  await settings(page, { profile: 'arithmetic' });
  await openInsert(page);
  flows.arithmeticTabs = await page.locator('dialog [role="tab"]').allTextContents();
  await page.keyboard.type('x^');
  await page.waitForTimeout(150);
  flows.arithmeticPower = { latex: await fieldLatex(page), message: await page.locator('dialog .eb-message').textContent() };
  // A real US keyboard sends | as Shift+Backslash. (keyboard.type('|') sends
  // it without Shift, and MathLive, which reads event.code, takes it as \.)
  await page.keyboard.type('2+');
  await page.keyboard.press('Shift+Backslash');
  await page.keyboard.type('x');
  await page.keyboard.press('Shift+Backslash');
  await page.waitForTimeout(150);
  flows.arithmeticTyped = await fieldLatex(page);
  await page.keyboard.type('+sqrt');
  await page.waitForTimeout(150);
  flows.arithmeticSqrtShortcutOff = await fieldLatex(page);
  await page.screenshot({ path: `${shots}builder-refused.png` });
  await closeDialog(page);

  // Chemistry: the text entry
  await settings(page, { profile: 'chemistry' });
  await openInsert(page);
  await page.click('#eb-tab-chemistry');
  await page.fill('#eb-entry-ce', '2H2 + O2 -> 2H2O');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  flows.chemistryInField = await fieldLatex(page);
  flows.chemistryFocusBack = await page.evaluate(() => document.activeElement?.localName);
  await page.screenshot({ path: `${shots}builder-chemistry.png` });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(100);
  flows.storedChemistry = await lastStoredTex(page);


  // The tabs that follow MathType's toolbar (docs/04-mathlive-vs-wiris.md):
  // a screenshot of each, then a long division built from the Elementary
  // math tab and saved. Long division is MathLive-only LaTeX (\enclose) that
  // the pipeline stores under Temml's name (\longdiv).
  await settings(page, { profile: 'everything' });
  await openInsert(page);
  flows.mathtypeTabs = {};
  for (const id of ['arrows', 'decorations', 'bigops', 'format', 'elementary']) {
    await page.click(`#eb-tab-${id}`);
    await page.waitForTimeout(200);
    flows.mathtypeTabs[id] = await page.locator('[role="tabpanel"] [data-item]').count();
    await page.locator('dialog .eb').screenshot({ path: `${shots}builder-tab-${id}.png` });
  }
  await page.click('[data-item="longdiv"]');
  await page.keyboard.type('41');
  await page.keyboard.press('Tab');
  await page.keyboard.type('3');
  await page.keyboard.press('Tab');
  await page.keyboard.type('123');
  await page.waitForTimeout(250);
  flows.longDivisionInField = await fieldLatex(page);
  await page.screenshot({ path: `${shots}builder-longdiv.png` });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(300);
  flows.storedLongDivision = await lastStoredTex(page);
  flows.longDivisionDrawn = await page.evaluate(() =>
    [...document.querySelectorAll('.fr-element math-eq')].at(-1)?.shadowRoot?.querySelectorAll('svg path').length ?? 0
  );

  // Dark theme
  await settings(page, { profile: 'everything', theme: 'dark' });
  await openInsert(page);
  await page.click('#eb-tab-matrices');
  await page.click('[data-item="pmatrix2"]');
  await page.keyboard.type('1');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${shots}builder-dark.png` });
  flows.darkDialogBackground = await page.locator(dialogSel).evaluate((d) => getComputedStyle(d).backgroundColor);
  await closeDialog(page);
  await page.context().close();
}

// ---------------------------------------------------------------------------
// 2. The same formulas through the panel and through the virtual keyboard
// ---------------------------------------------------------------------------
// Panel actions: ['click', css] or ['key', key] (a physical key press).
// Keyboard actions: ['layer', tooltip] or ['tap', keycap] (a keycap's
// aria-label, or a palette item's tooltip). Each list is what an author who
// doesn't know LaTeX would do; the counts are the list lengths, and both
// paths must give the same LaTeX.
const tab = (id) => ['click', `#eb-tab-${id}`];
const item = (id) => ['click', `[data-item="${id}"]`];
const keys = (s) => [...s].map((k) => ['key', k]);
const key = (k) => ['key', k];
const layer = (name) => ['layer', name];
const taps = (...caps) => caps.map((c) => ['tap', c]);

const TASKS = [
  {
    id: 'fractions',
    latex: '\\frac34+\\frac12',
    panel: [...keys('3/4'), key('ArrowRight'), ...keys('+1/2')],
    keyboard: [...taps('3', 'Fraction', '4', '[right]', '+', '1', 'Fraction', '2')],
  },
  {
    id: 'root',
    latex: '\\sqrt{x^2+1}',
    // MathLive leaves a superscript by itself after one digit, so no arrow after ^2
    panel: [tab('roots'), item('sqrt'), ...keys('x^2+1')],
    keyboard: [layer('Roots'), ...taps('Square root'), layer('Numbers'), ...taps('x', 'Power', '2', '[right]', '+', '1')],
  },
  {
    id: 'matrix',
    latex: '\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}',
    panel: [tab('matrices'), item('pmatrix2'), key('1'), key('Tab'), key('2'), key('Tab'), key('3'), key('Tab'), key('4')],
    keyboard: [layer('Matrices'), ...taps('2 by 2 matrix'), layer('Numbers'), ...taps('1', '[right]', '2', '[right]', '3', '[right]', '4')],
  },
  {
    id: 'integral',
    latex: '\\int_0^1x^2\\,\\differentialD x',
    panel: [tab('calculus'), item('defint'), key('0'), key('Tab'), key('1'), key('Tab'), ...keys('x^2'), key('Tab'), key('x')],
    keyboard: [layer('Calculus'), ...taps('Definite integral'), layer('Numbers'), ...taps('0', '[right]', '1', '[right]', 'x', 'Power', '2', '[right]', '[right]', '[right]', 'x')],
  },
  {
    id: 'quadratic',
    latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
    panel: [...keys('x='), tab('fractions'), item('frac'), ...keys('-b'), tab('operators'), item('plus-minus'), tab('roots'), item('sqrt'), ...keys('b^2-4ac'), key('Tab'), ...keys('2a')],
    keyboard: [
      ...taps('x', '='), layer('Fractions'), ...taps('Fraction'), layer('Numbers'), ...taps('-', 'b'), layer('Operators'), ...taps('Plus or minus'),
      layer('Roots'), ...taps('Square root'), layer('Numbers'), ...taps('b', 'Power', '2', '[right]', '-', '4', 'a'), ['layer', 'abc'], ...taps('c'),
      layer('Numbers'), ...taps('[right]', '[right]', '2', 'a'),
    ],
  },
  {
    id: 'chemistry',
    latex: '\\ce{2H2 + O2 -> 2H2O}',
    panel: [tab('chemistry'), ['click', '#eb-entry-ce'], ...keys('2H2 + O2 -> 2H2O'), key('Enter')],
    keyboard: null, // a keycap inserts fixed LaTeX; there is no way to type into \ce{} (palette.ts)
  },
];

async function runPanel(page, actions) {
  for (const [kind, arg] of actions) {
    if (kind === 'click') await page.click(`dialog ${arg}`);
    else await page.keyboard.press(arg);
  }
  await page.waitForTimeout(150);
  return fieldLatex(page);
}

async function runKeyboard(page, actions) {
  for (const [kind, arg] of actions) {
    if (kind === 'layer') {
      // MathLive's letters layout is the last one in the switcher
      const switcher = '.ML__keyboard .MLK__layer.is-visible .MLK__toolbar .left > div';
      await (arg === 'abc' ? page.locator(switcher).last() : page.locator(`${switcher}[data-tooltip="${arg}"]`)).click();
    } else {
      // Arrow keys have no aria-label: found by their command
      const layerSel = '.ML__keyboard .MLK__layer.is-visible .MLK__rows';
      const cap =
        arg === '[right]'
          ? page.locator(`${layerSel} [data-command*="moveToNextChar"]`).first()
          : page.locator(`${layerSel} [data-tooltip="${arg}"], ${layerSel} .MLK__keycap[aria-label="${arg}"]`).first();
      await cap.click();
    }
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(150);
  return fieldLatex(page);
}

{
  const page = await newPage();
  out.compare = [];
  for (const task of TASKS) {
    await settings(page, { ui: 'panel' });
    await openInsert(page);
    const panelLatex = await runPanel(page, task.panel);
    await closeDialog(page);
    let keyboardLatex = null;
    if (task.keyboard) {
      await settings(page, { ui: 'keyboard' });
      await openInsert(page);
      await page.waitForSelector('.ML__keyboard.is-visible');
      keyboardLatex = await runKeyboard(page, task.keyboard).catch(async (e) => `error: ${e.message.slice(0, 600)} | field: ${await fieldLatex(page)}`);
      await closeDialog(page);
    }
    const count = (list, kind) => list.filter(([k]) => kind.includes(k)).length;
    out.compare.push({
      id: task.id,
      expected: task.latex,
      panel: { latex: panelLatex, ok: panelLatex === task.latex, clicks: count(task.panel, ['click']), keys: count(task.panel, ['key']), actions: task.panel.length },
      keyboard: task.keyboard
        ? { latex: keyboardLatex, ok: keyboardLatex === task.latex, layerSwitches: count(task.keyboard, ['layer']), taps: count(task.keyboard, ['tap']), actions: task.keyboard.length }
        : 'not possible',
    });
  }

  // What the virtual keyboard exposes, and how much of the screen it takes
  await settings(page, { ui: 'keyboard' });
  await openInsert(page);
  await page.waitForSelector('.ML__keyboard.is-visible');
  await page.waitForTimeout(300);
  out.keyboard = await page.evaluate(() => {
    const kb = document.querySelector('.ML__keyboard');
    const plate = kb.querySelector('.MLK__plate');
    const layer = kb.querySelector('.MLK__layer.is-visible');
    const caps = [...layer.querySelectorAll('.MLK__keycap')];
    const d = document.querySelector('dialog[open]').getBoundingClientRect();
    return {
      keycapsInLayer: caps.length,
      tabbableKeycaps: [...kb.querySelectorAll('*')].filter((e) => e.tabIndex >= 0).length,
      keycapsWithRole: caps.filter((c) => c.getAttribute('role')).length,
      keycapAriaLabels: caps.slice(0, 12).map((c) => c.getAttribute('aria-label')),
      actionKeysWithoutLabel: [...layer.querySelectorAll('.MLK__rows .action')].filter((e) => !e.getAttribute('aria-label')).length,
      layerSwitchesWithRoleOrLabel: [...layer.querySelectorAll('.MLK__toolbar .left > div')].filter((e) => e.getAttribute('role') || e.getAttribute('aria-label')).length,
      plateHeight: Math.round(plate.getBoundingClientRect().height),
      viewportHeight: innerHeight,
      dialogBottom: Math.round(d.bottom),
      keyboardTop: Math.round(plate.getBoundingClientRect().top),
    };
  });
  out.keyboard.aria = await page.locator('.ML__keyboard').ariaSnapshot();
  await page.screenshot({ path: `${shots}builder-keyboard.png` });
  await closeDialog(page);
  await page.context().close();
}

// ---------------------------------------------------------------------------
// 3. A phone: touch, 390 × 844, the default "panel" UI (keyboard policy auto)
// ---------------------------------------------------------------------------
{
  const page = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.locator('.fr-element p').first().tap();
  await page.tap('[data-cmd="insertEquation"]');
  await page.waitForSelector(dialogSel);
  await page.waitForTimeout(800);
  out.phone = await page.evaluate(() => {
    const kb = document.querySelector('.ML__keyboard.is-visible .MLK__plate');
    const d = document.querySelector('dialog[open]');
    const field = d.querySelector('math-field').getBoundingClientRect();
    const keys = d.querySelector('.eb-keys')?.getBoundingClientRect();
    const kbRect = kb?.getBoundingClientRect();
    return {
      keyboardShown: !!kb,
      keyboardHeight: kbRect ? Math.round(kbRect.height) : 0,
      keyboardShare: kbRect ? +(kbRect.height / innerHeight).toFixed(2) : 0,
      fieldVisibleAboveKeyboard: kbRect ? field.bottom <= kbRect.top : true,
      // The dialog used to move up past the top of the screen to clear the keyboard
      fieldBelowTopOfScreen: field.top >= 0,
      panelKeysTop: keys ? Math.round(keys.top) : null,
      panelKeysVisibleAboveKeyboard: keys && kbRect ? keys.top < kbRect.top : null,
      dialogScrollable: d.scrollHeight > d.clientHeight,
    };
  });
  await page.screenshot({ path: `${shots}builder-phone.png` });
  await page.context().close();
}

await browser.close();
server.close();
await writeFile(new URL('../../../findings/builder-check.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
