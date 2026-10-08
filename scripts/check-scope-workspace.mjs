// Optional receiving check for the actual authoring page. Reuses an installed
// Playwright/Chromium and blocks all network requests outside the local fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/scope-workspace-receiving');
const baseline = process.env.SCOPESIGNAL_CHECK_SCOPE === 'baseline-entry';
const { chromium } = await import(process.env.SCOPESIGNAL_PLAYWRIGHT ? pathToFileURL(process.env.SCOPESIGNAL_PLAYWRIGHT).href : 'playwright');
const checks = [], failures = [], errors = [], externalRequests = [], served = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + sep)) throw new Error('Outside source');
    const bytes = await readFile(file);
    served.set(file.slice(root.length + 1), createHash('sha256').update(bytes).digest('hex'));
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(output, { recursive: true });
let browser;

async function check(name, action) {
  await action();
  checks.push({ name, result: 'pass' });
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
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    const dialogs = [];
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    const button = (id, action) => page.locator(`button[data-checkpoint="${id}"][data-action="${action}"]`);
    await page.goto(origin, { waitUntil: 'networkidle' });
    if (baseline) {
      await check(`${label}: original Add checkpoint ends in its deterministic-fixture alert`, async () => {
        await page.locator('#add-checkpoint').click();
        assert.match(dialogs.at(-1), /keeps the event model deterministic/);
        assert.equal(new URL(page.url()).pathname, '/');
        assert.equal(await page.locator('#scope-form').count(), 0);
      });
      await context.close();
      continue;
    }
    await check(`${label}: example control opens a usable scope draft`, async () => {
      assert.match(await page.locator('#add-checkpoint').innerText(), /Build your own fixture scope/);
      await page.locator('#add-checkpoint').click();
      await page.waitForURL('**/scope.html');
      await page.locator('#draft-0-title').waitFor();
      assert.equal(await page.locator('.scope-row').count(), 3);
      assert.equal(await page.locator('#scope-cap').inputValue(), '1200.00');
      assert.equal(await page.locator('#scope-review').isVisible(), false);
      assert.deepEqual(dialogs, []);
    });
    const literal = '\n\nProof </textarea><img id="scope-injected" src=x onerror="globalThis.injected=true"> & “quoted” 😀\n';
    await check(`${label}: authored fields survive adding and removing a checkpoint`, async () => {
      await page.locator('#scope-label').fill('  Fictional garden launch  ');
      await page.locator('#scope-brief').fill('A fictional garden needs an identity, a poster, and a launch handoff.');
      await page.locator('#scope-cap').fill('1500.25');
      await page.locator('#draft-0-title').fill('Identity <concepts>');
      await page.locator('#draft-0-amount').fill('500.25');
      await page.locator('#draft-0-evidence').fill(literal);
      await page.locator('#scope-add').click();
      assert.equal(await page.locator('#draft-0-evidence').inputValue(), literal);
      assert.equal(await page.locator('#draft-0-amount').inputValue(), '500.25');
      await page.locator('#draft-3-title').fill('Launch review');
      await page.locator('#draft-3-amount').fill('100.00');
      await page.locator('#draft-3-evidence').fill('Launch proof checked by a reviewer.');
      await page.getByRole('button', { name: 'Remove checkpoint 2', exact: true }).click();
      assert.equal(await page.locator('.scope-row').count(), 3);
      assert.equal(await page.locator('#draft-2-title').inputValue(), 'Launch review');
      assert.equal(await page.locator('#draft-0-evidence').inputValue(), literal);
      assert.equal(await page.locator('#scope-label').inputValue(), '  Fictional garden launch  ');
      assert.equal(await page.locator('#scope-budget').innerText(), '$1,000.25 allocated · $500.00 unallocated within the cap');
      assert.equal(await page.locator('#scope-injected').count(), 0);
    });
    await check(`${label}: invalid cap prevents review and identifies its field`, async () => {
      await page.locator('#scope-cap').fill('500');
      await page.getByRole('button', { name: 'Review this scope' }).click();
      assert.equal(await page.locator('#scope-errors').isVisible(), true);
      assert.match(await page.locator('#scope-errors').innerText(), /exceed the project cap/);
      assert.equal(await page.locator('#scope-cap').getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('#scope-review').isVisible(), false);
      assert.equal(await page.locator('#draft-0-evidence').inputValue(), literal);
      await page.locator('#scope-cap').fill('1500.25');
      await page.getByRole('button', { name: 'Review this scope' }).click();
      assert.equal(await page.locator('#review-title').innerText(), 'Fictional garden launch');
      assert.equal(await page.locator('#scope-approved').innerText(), '0 / 3');
      assert.equal(await page.locator('#scope-event-count').innerText(), '0 events');
      assert.equal(await page.locator('#scope-captured').innerText(), '$0.00');
      assert.equal(await button('scope-1', 'order').count(), 0);
    });
    await check(`${label}: review edits can return to the draft before any acceptance`, async () => {
      await page.locator('#review-evidence-scope-3').fill('New proof clarified during review.');
      await page.locator('#scope-edit').click();
      assert.equal(await page.locator('#draft-2-evidence').inputValue(), 'New proof clarified during review.');
      assert.equal(await page.locator('#draft-0-evidence').inputValue(), literal.trim());
      await page.locator('#scope-form').screenshot({ path: resolve(output, `${label}-draft.png`) });
      await page.getByRole('button', { name: 'Review this scope' }).click();
    });
    await check(`${label}: approval records exact evidence while retaining another checkpoint draft`, async () => {
      await page.locator('#review-evidence-scope-2').fill(literal);
      await page.locator('#review-evidence-scope-1').fill('  Accepted identity\n<literal> & quoted evidence  ');
      await button('scope-1', 'approve').click();
      assert.equal(await page.locator('#review-evidence-scope-1').inputValue(), 'Accepted identity\n<literal> & quoted evidence');
      assert.equal(await page.locator('#review-evidence-scope-1').getAttribute('readonly'), '');
      assert.equal(await page.locator('#review-evidence-scope-2').inputValue(), literal);
      assert.equal(await page.locator('#scope-injected').count(), 0);
      assert.equal(await page.locator('#scope-edit').isDisabled(), true);
      assert.equal(await page.locator('#scope-approved').innerText(), '1 / 3');
      assert.equal(await page.locator('#scope-event-count').innerText(), '1 event');
      assert.match(await page.locator('#scope-event-body').innerText(), /Accepted identity\n<literal> & quoted evidence/);
    });
    await check(`${label}: empty human acceptance is refused without discarding pending text`, async () => {
      await page.locator('#review-evidence-scope-2').fill('\n  ');
      await button('scope-2', 'approve').click();
      assert.match(await page.locator('#scope-action-status').innerText(), /Acceptance evidence is required/);
      assert.equal(await page.locator('#review-evidence-scope-2').inputValue(), '\n  ');
      assert.equal(await page.locator('#scope-event-count').innerText(), '1 event');
      assert.equal(await page.locator('#scope-captured').innerText(), '$0.00');
    });
    await check(`${label}: lost response, duplicate and lookup retain the correct current outcome`, async () => {
      for (const action of ['order', 'request', 'lose']) await button('scope-1', action).click();
      assert.match(await page.locator('article[data-checkpoint="scope-1"] .scope-review-state').innerText(), /unknown/);
      assert.equal(await button('scope-1', 'request').count(), 0);
      for (const action of ['receipt', 'duplicate']) {
        await button('scope-1', action).click();
        assert.equal(await page.locator('#scope-captured').innerText(), '$0.00');
      }
      assert.equal(await page.locator('#scope-event-count').innerText(), '6 events');
      await button('scope-1', 'reconcile').click();
      assert.equal(await page.locator('#scope-captured').innerText(), '$500.25');
      assert.equal(await page.locator('#scope-remaining').innerText(), '$500.00');
      assert.equal(await page.locator('#scope-event-count').innerText(), '7 events');
      assert.equal(await page.locator('article[data-checkpoint="scope-1"] button[data-action]').count(), 0);
    });
    await check(`${label}: second checkpoint follows the ordinary receipt path with independent totals`, async () => {
      await page.locator('#review-evidence-scope-2').fill('Handoff proof accepted.');
      for (const action of ['approve', 'order', 'request', 'receipt', 'duplicate']) await button('scope-2', action).click();
      assert.equal(await page.locator('#scope-approved').innerText(), '2 / 3');
      assert.equal(await page.locator('#scope-captured').innerText(), '$900.25');
      assert.equal(await page.locator('#scope-remaining').innerText(), '$100.00');
      assert.match(await page.locator('#scope-unallocated').innerText(), /\$500.00/);
      assert.equal(await page.locator('#scope-event-count').innerText(), '12 events');
      assert.match(await page.locator('article[data-checkpoint="scope-2"] .scope-receipt-ids').innerText(), /CAP-SCOPE-2/);
      assert.equal(await page.locator('#review-evidence-scope-3').inputValue(), 'New proof clarified during review.');
    });
    await check(`${label}: layout and focus remain usable at the receiving viewport`, async () => {
      const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(size.document <= size.viewport + 1, JSON.stringify(size));
      assert.equal(await button('scope-3', 'approve').isVisible(), true);
      await page.locator('#scope-review').screenshot({ path: resolve(output, `${label}-review.png`) });
    });
    await check(`${label}: a fresh fixture resets the session and enforces checkpoint count bounds`, async () => {
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('#scope-form').isVisible(), true);
      assert.equal(await page.locator('#scope-review').isVisible(), false);
      assert.equal(await page.locator('#scope-label').inputValue(), 'Northstar onboarding refresh');
      for (let index = 3; index < 12; index++) await page.locator('#scope-add').click();
      assert.equal(await page.locator('.scope-row').count(), 12);
      assert.equal(await page.locator('#scope-add').isDisabled(), true);
      while (await page.locator('.scope-row').count() > 1) await page.locator('button[data-remove]').last().click();
      assert.equal(await page.locator('button[data-remove]').isDisabled(), true);
      assert.equal(await page.locator('#scope-add').isEnabled(), true);
    });
    await check(`${label}: accepted large cent amounts remain exact throughout visible review and capture`, async () => {
      await page.locator('#scope-cap').fill('90071992547409.91');
      await page.locator('#draft-0-amount').fill('90071992547409.91');
      assert.match(await page.locator('#scope-budget').innerText(), /\$90,071,992,547,409\.91 allocated/);
      await page.getByRole('button', { name: 'Review this scope' }).click();
      assert.equal(await page.locator('#scope-total').innerText(), '$90,071,992,547,409.91');
      assert.equal(await page.locator('#scope-remaining').innerText(), '$90,071,992,547,409.91');
      for (const action of ['approve', 'order', 'request', 'receipt']) await button('scope-1', action).click();
      assert.equal(await page.locator('#scope-captured').innerText(), '$90,071,992,547,409.91');
      assert.equal(await page.locator('#scope-remaining').innerText(), '$0.00');
      const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(size.document <= size.viewport + 1, JSON.stringify(size));
    });
    await context.close();
  }
  await check('no browser script errors or unexpected external requests', async () => {
    assert.deepEqual(errors, []);
    const font = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap';
    assert.deepEqual(externalRequests.filter(url => url !== font), []);
  });
} catch (error) {
  failures.push({ result: 'fail', after: checks.at(-1)?.name || null, error: error.stack });
} finally {
  const receipt = {
    schema: 'scopesignal.scope-workspace-receiving.v1', mode: baseline ? 'baseline-entry' : 'scope-authoring',
    at: new Date().toISOString(), source: root, sourceCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null,
    node: process.version, browser: browser?.version() || null,
    servedSha256: Object.fromEntries([...served].sort()), checks, failures, pageErrors: errors, externalRequests,
    passed: failures.length === 0
  };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failures.length) process.exitCode = 1;
