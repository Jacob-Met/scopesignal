// Actual local authoring UI -> downloaded HTML -> offline browser and print.
// Uses an existing Playwright/Chromium installation; no package installation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/scope-review-export-receiving');
const baselineRef = process.env.SCOPESIGNAL_BASELINE_REF;
const { chromium } = await import(process.env.SCOPESIGNAL_PLAYWRIGHT ? pathToFileURL(process.env.SCOPESIGNAL_PLAYWRIGHT).href : 'playwright');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const checks = [], failures = [], pageErrors = [], external = [], served = new Map(), downloads = [];
const mime = { '.html': 'text/html;charset=utf-8', '.mjs': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/scope.html' : pathname));
    if (!path.startsWith(root + sep)) throw Error('Outside source');
    const relative = path.slice(root.length + 1);
    const bytes = baselineRef
      ? execFileSync('git', ['show', `${baselineRef}:${relative}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      : await readFile(path);
    served.set(relative, hash(bytes));
    res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await mkdir(output, { recursive: true });
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
async function check(name, run) { await run(); checks.push({ name, pass: true }); }

try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SCOPESIGNAL_CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === 'file:') return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('#draft-0-title').waitFor();
  const save = async (selector, name, keyboard = false) => {
    const pending = page.waitForEvent('download');
    if (keyboard) { await page.locator(selector).focus(); await page.keyboard.press('Enter'); }
    else await page.locator(selector).click();
    const download = await pending;
    assert.equal(await download.failure(), null);
    const path = resolve(output, name);
    await download.saveAs(path);
    const bytes = await readFile(path);
    downloads.push({ name, suggested: download.suggestedFilename(), bytes: bytes.length, sha256: hash(bytes) });
    return { path, bytes, suggested: download.suggestedFilename() };
  };
  const values = async target => target.locator('dl .field').evaluateAll(fields => fields.map(field => ({
    label: field.querySelector('dt').textContent, value: field.querySelector('dd').textContent
  })));
  const selected = (fields, label) => fields.filter(field => field.label === label).map(field => field.value);
  const openArtifact = async file => {
    const view = await context.newPage();
    await view.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    assert.equal(await view.locator('script, link, img, iframe, input, button, form').count(), 0);
    return view;
  };

  if (baselineRef) {
    await check('pinned baseline still saves authored JSON but has no portable review download', async () => {
      await page.locator('#scope-label').fill('Baseline authored evidence');
      const saved = await save('#scope-save', 'baseline-workspace.json');
      assert.equal(JSON.parse(saved.bytes).draft.label, 'Baseline authored evidence');
      assert.equal(await page.locator('#scope-review-download').count(), 0);
    });
  } else {
    const literal = '\nProof <img src="x" onerror="bad()"> & literal 🧭\n';
    let draftHTML;
    await check('keyboard downloads unfinished draft as literal HTML without changing its saved workspace', async () => {
      await page.locator('#scope-label').fill('  Fictional garden review  ');
      await page.locator('#scope-brief').fill(literal);
      await page.locator('#scope-cap').fill('not ready');
      await page.locator('#draft-0-amount').fill('');
      const before = await save('#scope-save', 'draft-before.json');
      draftHTML = await save('#scope-review-download', 'draft-review.html', true);
      assert.equal(draftHTML.suggested, 'scopesignal-scope-review.html');
      const after = await save('#scope-save', 'draft-after.json');
      assert.deepEqual(after.bytes, before.bytes);
      const view = await openArtifact(draftHTML.path);
      const fields = await values(view);
      assert.deepEqual(selected(fields, 'Project name'), ['  Fictional garden review  ']);
      assert.deepEqual(selected(fields, 'Brief'), [literal]);
      assert.deepEqual(selected(fields, 'Project cap in USD (as entered, not validated)'), ['not ready']);
      assert.equal(selected(fields, 'Amount in USD (as entered, not validated)')[0], '');
      assert.equal(await view.locator('.events li').count(), 0);
      assert.match(await view.locator('body').innerText(), /Unfinished fictional draft/);
      await view.close();
    });

    let reviewHTML, reviewJSON;
    await check('mixed review exports accepted and pending evidence with truthful current amounts and full history', async () => {
      await page.locator('#scope-cap').fill('1500.25');
      await page.locator('#draft-0-amount').fill('500.25');
      await page.getByRole('button', { name: 'Review this scope' }).click();
      await page.locator('#review-evidence-scope-1').fill('  Accepted identity\n<literal> & proof  ');
      await page.locator('#review-evidence-scope-3').fill(literal);
      const button = (id, action) => page.locator(`button[data-checkpoint="${id}"][data-action="${action}"]`);
      for (const action of ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate']) await button('scope-1', action).click();
      for (const action of ['approve', 'order', 'request', 'receipt']) await button('scope-2', action).click();
      reviewJSON = await save('#scope-save', 'review-before.json');
      const visible = await page.locator('#scope-review').innerText();
      reviewHTML = await save('#scope-review-download', 'review.html');
      const after = await save('#scope-save', 'review-after.json');
      assert.deepEqual(after.bytes, reviewJSON.bytes);
      assert.equal(await page.locator('#scope-review').innerText(), visible);
      const view = await openArtifact(reviewHTML.path);
      const fields = await values(view);
      assert.deepEqual(selected(fields, 'Current simulated capture state'), ['unknown', 'captured', 'not started']);
      assert.deepEqual(selected(fields, 'Simulated captured (USD)'), ['$400.00']);
      assert.deepEqual(selected(fields, 'Allocated remaining (USD)'), ['$900.25']);
      assert.deepEqual(selected(fields, 'Unallocated cap (USD)'), ['$200.00']);
      assert.equal(selected(fields, 'Accepted evidence — from recorded approval')[0], 'Accepted identity\n<literal> & proof');
      assert.deepEqual(selected(fields, 'Pending evidence — not approved'), [literal]);
      const events = JSON.parse(reviewJSON.bytes).events;
      const rendered = await view.locator('.events li').evaluateAll(items => items.map(item =>
        Object.fromEntries([...item.querySelectorAll('.field')].map(field => [field.querySelector('dt').textContent, field.querySelector('dd').textContent]))));
      assert.deepEqual(rendered, events.map(event => Object.fromEntries(Object.entries(event).map(([key, value]) => [key, String(value)]))));
      await view.screenshot({ path: resolve(output, 'review-desktop.png'), fullPage: false });
      await view.close();
    });

    await check('download refusal leaves current work intact and a subsequent download recovers', async () => {
      await page.evaluate(() => { window.originalCreateURL = URL.createObjectURL; URL.createObjectURL = () => { throw Error('Synthetic download preparation refusal'); }; });
      await page.locator('#scope-review-download').click();
      assert.match(await page.locator('#scope-file-status').innerText(), /Could not prepare the scope review/);
      await page.evaluate(() => { URL.createObjectURL = window.originalCreateURL; delete window.originalCreateURL; });
      const unchanged = await save('#scope-save', 'after-refusal.json');
      assert.deepEqual(unchanged.bytes, reviewJSON.bytes);
      const retry = await save('#scope-review-download', 'retry-review.html');
      assert.deepEqual(retry.bytes, reviewHTML.bytes);
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('a[download]').count(), 0);
    });

    await check('review download preserves an already admitted open preview without replacing the active workspace', async () => {
      await page.locator('#scope-open').setInputFiles(resolve(output, 'draft-before.json'));
      await page.locator('#scope-open-preview').waitFor({ state: 'visible' });
      const preview = await page.locator('#scope-open-summary').innerText();
      const exported = await save('#scope-review-download', 'preview-active-review.html');
      assert.deepEqual(exported.bytes, reviewHTML.bytes);
      assert.equal(await page.locator('#scope-open-preview').isVisible(), true);
      assert.equal(await page.locator('#scope-open-summary').innerText(), preview);
      await page.locator('#scope-open-cancel').click();
    });

    await check('phone workspace control and offline review remain readable without horizontal overflow', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#scope-review-download').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const phone = await save('#scope-review-download', 'phone-review.html', true);
      assert.deepEqual(phone.bytes, reviewHTML.bytes);
      const view = await openArtifact(phone.path);
      await view.setViewportSize({ width: 390, height: 844 });
      assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await view.screenshot({ path: resolve(output, 'review-phone.png'), fullPage: false });
      await view.locator('.checkpoint').first().scrollIntoViewIfNeeded();
      await view.screenshot({ path: resolve(output, 'review-phone-checkpoint.png'), fullPage: false });
      await view.close();
    });

    await check('actual browser print generates a local PDF with every checkpoint and event retained', async () => {
      const view = await openArtifact(reviewHTML.path);
      await view.emulateMedia({ media: 'print' });
      assert.equal(await view.locator('.checkpoint:visible').count(), 3);
      assert.equal(await view.locator('.events li:visible').count(), 10);
      const bytes = await view.pdf({ format: 'A4', printBackground: true });
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      await writeFile(resolve(output, 'review.pdf'), bytes);
      downloads.push({ name: 'review.pdf', bytes: bytes.length, sha256: hash(bytes), source: 'Chromium printToPDF' });
      await view.close();
    });
  }
  assert.deepEqual(pageErrors, []);
  await context.close();
} catch (error) { failures.push({ message: error.message, stack: error.stack }); process.exitCode = 1; }
finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  const receipt = { source: root, baselineRef: baselineRef ?? null, node: process.version,
    checks, failures, pageErrors, externalRequests: external, served: Object.fromEntries(served), downloads,
    result: failures.length ? 'FAIL' : 'PASS' };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ result: receipt.result, checks: checks.length, failures }, null, 2));
}
