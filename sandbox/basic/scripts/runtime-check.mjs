// Loads the built sandbox (dist/) in Chromium under different CSPs and
// reports CSP violations, font loading, rendering and a rough cost for many
// fields. Usage: pnpm build && node scripts/runtime-check.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = join(process.cwd(), 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
let csp = '';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = join(root, normalize(url.pathname === '/' ? '/index.html' : url.pathname));
  try {
    const body = await readFile(file);
    const headers = { 'content-type': types[extname(file)] ?? 'application/octet-stream' };
    if (csp) headers['content-security-policy'] = csp;
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
);

async function run(name, policy, query = '') {
  csp = policy;
  const page = await browser.newPage();
  const violations = new Set();
  const failed = new Set();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 160));
  });
  page.on('requestfailed', (r) => failed.add(new URL(r.url()).pathname));
  page.on('response', (r) => r.status() >= 400 && failed.add(`${r.status()} ${new URL(r.url()).pathname}`));
  await page.exposeFunction('reportViolation', (v) => violations.add(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      window.reportViolation(`${e.effectiveDirective} ← ${e.blockedURI || 'inline'}`)
    );
  });
  await page.goto(base + '/' + query);
  await page.waitForFunction(() => document.querySelector('#out-latex')?.textContent || window.ttOk || window.manyMs, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const mf = document.querySelector('math-field');
    const content = mf?.shadowRoot?.querySelector('.ML__content');
    // A fraction bar rendered by MathLive has an inline style height; if
    // inline styles are blocked by CSP, the layout collapses.
    const frac = mf?.shadowRoot?.querySelector('.ML__frac-line');
    const stretchy = mf?.shadowRoot?.querySelector('.ML__vlist');
    return {
      fontsLoaded: [...document.fonts].filter((f) => f.family.includes('KaTeX') && f.status === 'loaded').length,
      fontsFailedClass: document.body.classList.contains('ML__fonts-did-not-load'),
      contentHeight: content ? Math.round(content.getBoundingClientRect().height) : 0,
      vlistStyle: stretchy?.getAttribute('style') ?? null,
      vlistHeight: stretchy ? getComputedStyle(stretchy).height : null,
      fracLine: !!frac,
      manyMs: window.manyMs ? Math.round(window.manyMs) : undefined,
      ttOk: window.ttOk ? window.ttOk() : undefined,
    };
  });
  if (!/\d$/.test(name)) await page.screenshot({ path: `../../findings/screenshots/${name}.png` });
  await page.close();
  return { name, csp: policy || '(none)', ...info, violations: [...violations], failed: [...failed], errors: errors.slice(0, 4) };
}

const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'";
const STYLE_ATTR = STRICT + "; style-src-attr 'unsafe-inline'";
const results = [];
results.push(await run('no-csp', ''));
results.push(await run('strict-csp', STRICT));
results.push(await run('strict-plus-style-attr', STYLE_ATTR));
results.push(await run('trusted-types-no-policy', STYLE_ATTR + "; require-trusted-types-for 'script'"));
results.push(await run('trusted-types-with-policy', STYLE_ATTR + "; require-trusted-types-for 'script'; trusted-types mathlive", 'trusted-types.html'));
for (const n of [200, 1000]) {
  for (const mode of ['many', 'static', 'native']) {
    const r = await run(`${mode}-${n}`, '', `?${mode}=${n}`);
    results.push({ name: r.name, manyMs: r.manyMs });
  }
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
server.close();
