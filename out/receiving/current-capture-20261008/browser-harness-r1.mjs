// Optional real-browser receiving checks. Use a fresh browser profile and an
// ephemeral loopback server; no account, provider or deployed page is used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/browser-receiving');
const modulePath = process.env.SCOPESIGNAL_PLAYWRIGHT;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const { replayFixture } = await import(pathToFileURL(resolve(root, 'src/ledger.mjs')).href);
const recorded = replayFixture().snapshot();
const served = new Map();
const failures = [], checks = [], errors = [], externalRequests = [];
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + sep)) throw new Error('Outside fixture root');
    const bytes = await readFile(file);
    served.set(file.slice(root.length + 1), createHash('sha256').update(bytes).digest('hex'));
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
async function check(name, run) {
  try { await run(); checks.push({ name, result: 'pass' }); }
  catch (error) { const result = { name, result: 'fail', error: error.message }; checks.push(result); failures.push(result); }
}

try {
  browser = await chromium.launch({ headless: true, ...(process.env.SCOPESIGNAL_CHROME ? { executablePath: process.env.SCOPESIGNAL_CHROME } : {}) });
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      externalRequests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const dialogs = [];
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('#evidence-handoff').waitFor();
    await check(`${label}: current capture callout agrees with the reduced ledger`, async () => {
      assert.equal(recorded.checkpoints.journey.captureStatus, 'captured');
      assert.equal(recorded.captured, 40000);
      assert.equal(await page.locator('.unknown-callout strong').innerText(), 'Capture state: captured');
      assert.match(await page.locator('.unknown-callout p').innerText(), /counts this checkpoint once/);
      assert.equal(await page.locator('#captured').innerText(), '$400.00');
    });
    await check(`${label}: recovery reviewer describes the current resolved state`, async () => {
      const review = await page.locator('#role-cards .role-card').filter({ hasText: 'Recovery reviewer' }).locator('p').innerText();
      assert.match(review, /no uncertain capture remains/);
      assert.doesNotMatch(review, /Keep capture unknown/);
    });
    await check(`${label}: pending literal draft survives another approval`, async () => {
      const draft = '\n\nDraft </textarea><img id="injected-evidence" src=x onerror="globalThis.injectedEvidence=true"> & “quoted” 😀\n';
      await page.locator('#evidence-handoff').fill(draft);
      await page.locator('#evidence-accessibility').fill('  Human reviewed\naccessibility evidence  ');
      await page.locator('.approve[data-id="accessibility"]').click();
      assert.equal(await page.locator('#evidence-handoff').inputValue(), draft);
      assert.equal(await page.locator('#evidence-accessibility').inputValue(), 'Human reviewed\naccessibility evidence');
      assert.equal(await page.locator('textarea').count(), 3);
      assert.equal(await page.locator('#injected-evidence').count(), 0);
      assert.equal(await page.locator('#approved').innerText(), '2 / 3');
      assert.equal(await page.locator('#ledger-count').innerText(), '8 events');
      assert.equal(await page.locator('#evidence-accessibility').getAttribute('readonly'), '');
      assert.equal(await page.locator('.suggest[data-id="accessibility"]').isDisabled(), true);
      assert.equal(await page.locator('.approve[data-id="accessibility"]').isDisabled(), true);
    });
    await check(`${label}: refused approval retains its draft and recorded approvals`, async () => {
      await page.locator('#evidence-handoff').fill('\n\n');
      await page.locator('.approve[data-id="handoff"]').click();
      assert.match(dialogs.at(-1), /Acceptance evidence is required/);
      assert.equal(await page.locator('#evidence-handoff').inputValue(), '\n\n');
      assert.equal(await page.locator('#evidence-accessibility').inputValue(), 'Human reviewed\naccessibility evidence');
      assert.equal(await page.locator('#ledger-count').innerText(), '8 events');
      assert.equal(await page.locator('#captured').innerText(), '$400.00');
    });
    await check(`${label}: final approval preserves exact accepted evidence and one captured amount`, async () => {
      await page.locator('#evidence-handoff').fill('Reviewed handoff <literal> & "quoted"');
      await page.locator('.approve[data-id="handoff"]').click();
      assert.equal(await page.locator('#evidence-handoff').inputValue(), 'Reviewed handoff <literal> & "quoted"');
      assert.equal(await page.locator('#approved').innerText(), '3 / 3');
      assert.equal(await page.locator('#ledger-count').innerText(), '9 events');
      assert.equal(await page.locator('#captured').innerText(), '$400.00');
      assert.equal(await page.locator('#remaining').innerText(), '$800.00');
      assert.equal(await page.locator('#evidence-handoff').getAttribute('readonly'), '');
      assert.equal(await page.locator('#ledger-body tr').nth(4).locator('td').last().innerText(), 'webhook received');
      assert.equal(await page.locator('#ledger-body tr').nth(5).locator('td').last().innerText(), 'duplicate ignored');
      assert.equal(await page.locator('#ledger-body tr').nth(6).locator('td').last().innerText(), 'reconciled · counted once');
    });
    await check(`${label}: explicit replay restores fixture state`, async () => {
      await page.locator('#replay').click();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('#approved').innerText(), '1 / 3');
      assert.equal(await page.locator('#ledger-count').innerText(), '7 events');
      assert.equal(await page.locator('#captured').innerText(), '$400.00');
      assert.equal(await page.locator('#evidence-handoff').inputValue(), recorded.checkpoints.handoff.evidence);
    });
    await check(`${label}: layout retains a usable viewport`, async () => {
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(dimensions.document <= dimensions.viewport + 1, JSON.stringify(dimensions));
      assert.equal(await page.locator('.approve[data-id="handoff"]').isVisible(), true);
    });
    await mkdir(output, { recursive: true });
    await page.locator('#workspace').screenshot({ path: resolve(output, `${label}.png`) });
    await context.close();
  }
  await check('no browser script errors or external requests', async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
  });
} catch (error) {
  failures.push({ name: 'browser setup or execution', result: 'fail', error: error.stack });
} finally {
  const receipt = { schema: 'scopesignal.browser-receiving.v1', at: new Date().toISOString(), node: process.version, browser: browser?.version() || null, source: root, sourceCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null, origin, servedSha256: Object.fromEntries([...served].sort()), checks, failures, pageErrors: errors, externalRequests, passed: failures.length === 0 };
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failures.length) process.exitCode = 1;
