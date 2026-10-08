// Optional receiving of the actual static app and native file picker. Requires
// an existing Puppeteer Core + Chromium; installs no package or browser.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, access } from 'node:fs/promises';
import { extname, resolve, sep, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = process.env.SCOPESIGNAL_PUPPETEER || 'puppeteer-core';
const puppeteer = require(modulePath);
const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/record-view-receiving');
const { serializeFixtureRecord } = await import(pathToFileURL(join(root, 'src/fixture-record.mjs')).href);
const { replayFixture } = await import(pathToFileURL(join(root, 'src/ledger.mjs')).href);
const checks = [], failures = [], pageErrors = [], externalRequests = [], downloads = [];
const served = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(output, 'browser-profile-'));
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(root + sep)) throw Error('Outside source');
    const bytes = await readFile(file);
    served.set(file.slice(root.length + 1), hash(bytes));
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;

async function check(name, run) {
  try { await run(); checks.push({ name, result: 'pass' }); }
  catch (error) {
    const failed = { name, result: 'fail', error: error.stack };
    checks.push(failed); failures.push(failed); throw error;
  }
}
async function guard(page, role) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('data:') || new URL(url).origin === origin) return request.continue();
    externalRequests.push({ role, url });
    return request.abort();
  });
  page.on('pageerror', error => pageErrors.push({ role, error: error.message }));
}
async function choose(page, file, keyboard = false) {
  const ready = page.waitForFileChooser({ timeout: 5000 });
  if (keyboard) { await page.focus('#record-file'); await page.keyboard.press('Enter'); }
  else await page.click('#record-file');
  const chooser = await ready;
  await chooser.accept([file]);
}
async function statusContains(page, text) {
  await page.waitForFunction(text => document.querySelector('#record-status')?.textContent.includes(text), { timeout: 5000 }, text);
}
async function errorContains(page, text) {
  await page.waitForFunction(text => {
    const error = document.querySelector('#record-error');
    return error && !error.hidden && error.textContent.includes(text);
  }, { timeout: 5000 }, text);
}
async function acceptedEvidence(page) {
  return page.$eval('[data-checkpoint-id="accessibility"] .accepted-evidence', node => node.textContent);
}
async function assertRetained(page, accepted) {
  assert.equal(await acceptedEvidence(page), accepted);
  assert.equal(await page.$$eval('.saved-event', nodes => nodes.length), 8);
  assert.equal(await page.$eval('.record-totals>div:nth-child(3) dd', node => node.textContent), '$400.00');
  assert.equal(await page.evaluate(() => document.querySelector('#record-title') === globalThis.retainedTitle), true);
}
async function put(directory, name, bytes) {
  const file = join(directory, name);
  await writeFile(file, bytes);
  return file;
}

try {
  browser = await puppeteer.launch({
    headless: true, userDataDir: profile,
    ...(process.env.SCOPESIGNAL_CHROME ? { executablePath: process.env.SCOPESIGNAL_CHROME } : {}),
    args: ['--disable-background-networking', '--no-first-run', '--no-default-browser-check'],
  });
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const files = join(output, label + '-files');
    await mkdir(files, { recursive: true });
    const context = await browser.createBrowserContext();
    const app = await context.newPage();
    await app.setViewport(viewport);
    await guard(app, label + ':fixture');
    const cdp = await app.createCDPSession();
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: files });
    await app.goto(origin, { waitUntil: 'networkidle0' });
    await app.waitForSelector('#evidence-accessibility');
    const accepted = 'Reviewed </pre><img id="injected-record" src="https://example.invalid/record" onerror="globalThis.injectedRecord=true"> & “quoted” 😀\nSecond evidence line\twith a tab';
    const draft = 'UNAPPROVED_LOCAL_DRAFT_' + label;
    const downloaded = join(files, 'scopesignal-fixture-record-v1.json');
    let exported;

    await check(label + ': save the actual edited approval using the production download', async () => {
      await app.$eval('#evidence-accessibility', (node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, '  ' + accepted + '  ');
      await app.click('.approve[data-id="accessibility"]');
      await app.$eval('#evidence-handoff', (node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, draft);
      await app.click('#export-record');
      for (let attempt = 0; attempt < 100; attempt++) {
        try { await access(downloaded); break; }
        catch { await new Promise(resolve => setTimeout(resolve, 50)); }
      }
      const bytes = await readFile(downloaded);
      exported = JSON.parse(bytes);
      assert.equal(exported.events.length, 8);
      assert.equal(exported.checkpoints[1].approval.acceptedEvidence, accepted);
      assert.equal(exported.paymentEvidence, false);
      assert(!bytes.includes(draft));
      downloads.push({ viewport: label, filename: 'scopesignal-fixture-record-v1.json', bytes: bytes.length, sha256: hash(bytes) });
    });

    let viewer;
    await check(label + ': navigation opens a separate viewer and preserves the current fixture', async () => {
      assert.equal(await app.$$eval('#inspect-record', nodes => nodes.length), 1, 'Saved-record navigation is absent');
      const opened = context.waitForTarget(target => target.url() === origin + '/record.html', { timeout: 5000 });
      await app.click('#inspect-record');
      viewer = await (await opened).page();
      await viewer.setViewport(viewport);
      await guard(viewer, label + ':viewer');
      // Reload with interception already installed to account for every viewer
      // module and asset, including requests preceding the popup event.
      await viewer.reload({ waitUntil: 'networkidle0' });
      assert.equal(await viewer.evaluate(() => window.opener), null);
      assert.equal(await app.$eval('#evidence-handoff', node => node.value), draft);
      assert.equal(await app.$eval('#ledger-count', node => node.textContent), '8 events');
      assert.equal(await viewer.$eval('#record-display', node => node.hidden), true);
    });

    await check(label + ': native file selection displays exact evidence, money and saved event fields', async () => {
      await choose(viewer, downloaded, true);
      await statusContains(viewer, 'Opened scopesignal-fixture-record-v1.json.');
      assert.equal(await acceptedEvidence(viewer), accepted);
      assert.equal(await viewer.$eval('.record-totals>div:nth-child(2) dd', node => node.textContent), '2 / 3');
      assert.equal(await viewer.$eval('.record-totals>div:nth-child(3) dd', node => node.textContent), '$400.00');
      assert.equal(await viewer.$eval('.record-totals>div:nth-child(4) dd', node => node.textContent), '$800.00');
      assert.equal(await viewer.$$eval('.saved-event', nodes => nodes.length), 8);
      const savedEvents = await viewer.$$eval('.event-json', nodes => nodes.map(node => JSON.parse(node.textContent)));
      assert.deepEqual(savedEvents, exported.events);
      assert.equal(await viewer.$$eval('[data-checkpoint-id="handoff"] .accepted-evidence', nodes => nodes.length), 0);
      assert.equal(await viewer.$$eval('#injected-record', nodes => nodes.length), 0);
      assert.equal(await viewer.evaluate(() => globalThis.injectedRecord === true), false);
      assert.equal(await viewer.$eval('#record-file', node => node.value), '');
      await viewer.evaluate(() => { globalThis.retainedTitle = document.querySelector('#record-title'); });
    });

    await check(label + ': malformed, inconsistent, unsupported and unreadable files preserve the accepted display', async () => {
      const inconsistent = structuredClone(exported);
      inconsistent.summary.captured = 80000; inconsistent.summary.remaining = 40000;
      const version = structuredClone(exported); version.version = 2;
      const contradiction = structuredClone(exported);
      contradiction.events[0].approver = 'bot'; contradiction.checkpoints[0].approval.approver = 'bot';
      const samples = [
        ['incomplete.json', '{"schema":', 'not complete JSON'],
        ['inconsistent.json', JSON.stringify(inconsistent), 'does not match'],
        ['version.json', JSON.stringify(version), 'not supported'],
        ['contradictory.json', JSON.stringify(contradiction), 'violates the fixture ledger'],
        ['invalid-utf8.json', Buffer.from([0x7b, 0xff, 0x7d]), 'not valid UTF-8'],
      ];
      for (const [name, bytes, message] of samples) {
        await choose(viewer, await put(files, name, bytes));
        await errorContains(viewer, message);
        await assertRetained(viewer, accepted);
      }
      await viewer.evaluate(() => {
        globalThis.originalFileRead = File.prototype.arrayBuffer;
        globalThis.fileReads = [];
        File.prototype.arrayBuffer = function () { globalThis.fileReads.push(this.name); return globalThis.originalFileRead.call(this); };
      });
      const oversized = await put(files, 'oversized.json', ' '.repeat(1024 * 1024 + 1));
      await choose(viewer, oversized);
      await errorContains(viewer, 'exceeds the 1 MiB');
      assert.equal(await viewer.evaluate(() => globalThis.fileReads.includes('oversized.json')), false);
      await assertRetained(viewer, accepted);
      const readError = await put(files, 'read-error.json', JSON.stringify(exported));
      await viewer.evaluate(() => {
        File.prototype.arrayBuffer = function () {
          return this.name === 'read-error.json' ? Promise.reject(Error('Injected read refusal')) : globalThis.originalFileRead.call(this);
        };
      });
      await choose(viewer, readError);
      await errorContains(viewer, 'could not be read');
      await assertRetained(viewer, accepted);
      await viewer.evaluate(() => { File.prototype.arrayBuffer = globalThis.originalFileRead; });
      await viewer.screenshot({ path: join(output, label + '-retained-error.png'), fullPage: true });
    });

    await check(label + ': same-file retry and canceled selection leave a usable review', async () => {
      await choose(viewer, downloaded);
      await statusContains(viewer, 'Opened scopesignal-fixture-record-v1.json.');
      assert.equal(await viewer.$eval('#record-error', node => node.hidden), true);
      await viewer.evaluate(() => { globalThis.retainedTitle = document.querySelector('#record-title'); });
      const pending = viewer.waitForFileChooser({ timeout: 5000 });
      await viewer.click('#record-file');
      await (await pending).cancel();
      await assertRetained(viewer, accepted);
      await choose(viewer, downloaded);
      await statusContains(viewer, 'Opened scopesignal-fixture-record-v1.json.');
      assert.equal(await acceptedEvidence(viewer), accepted);
      assert.equal(await viewer.$eval('#record-file', node => node.value), '');
    });

    await check(label + ': keyboard and narrow layout expose the complete accepted record', async () => {
      await viewer.focus('#record-file');
      await viewer.keyboard.press('Tab');
      assert.equal(await viewer.evaluate(() => document.activeElement.id), 'clear-record');
      await viewer.keyboard.press('Tab');
      assert.equal(await viewer.evaluate(() => document.activeElement.id), 'jump-to-record');
      await viewer.keyboard.press('Enter');
      assert.equal(await viewer.evaluate(() => document.activeElement.id), 'record-title');
      await viewer.focus('.saved-event summary');
      await viewer.keyboard.press('Enter');
      assert.equal(await viewer.$eval('.saved-event', node => node.open), true);
      const dimensions = await viewer.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(dimensions.document <= dimensions.viewport + 1, JSON.stringify(dimensions));
      assert.deepEqual(await viewer.$$eval('button', nodes => nodes.map(node => node.textContent)), ['Clear view']);
      assert.deepEqual(await viewer.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
      await viewer.screenshot({ path: join(output, label + '-record.png'), fullPage: true });
    });

    const slowFile = await put(files, 'slow-record.json', JSON.stringify(exported));
    const emptyFile = await put(files, 'empty-record.json', serializeFixtureRecord([]));
    async function holdRead() {
      await viewer.evaluate(() => {
        globalThis.releaseSlow = null;
        File.prototype.arrayBuffer = function () {
          if (this.name !== 'slow-record.json') return globalThis.originalFileRead.call(this);
          const file = this;
          return new Promise((resolve, reject) => {
            globalThis.releaseSlow = () => globalThis.originalFileRead.call(file).then(resolve, reject);
          });
        };
      });
      await choose(viewer, slowFile);
      await viewer.waitForFunction(() => typeof globalThis.releaseSlow === 'function', { timeout: 5000 });
    }
    async function releaseRead() {
      await viewer.evaluate(async () => {
        await globalThis.releaseSlow();
        await new Promise(resolve => setTimeout(resolve, 0));
        File.prototype.arrayBuffer = globalThis.originalFileRead;
      });
    }

    await check(label + ': an earlier slow file cannot replace a later accepted file', async () => {
      await holdRead();
      await choose(viewer, emptyFile);
      await statusContains(viewer, 'Opened empty-record.json.');
      await releaseRead();
      assert.equal(await viewer.$eval('.record-filename', node => node.textContent), 'empty-record.json');
      assert.equal(await viewer.$$eval('.saved-event', nodes => nodes.length), 0);
      assert.equal(await viewer.$eval('.record-totals>div:nth-child(3) dd', node => node.textContent), '$0.00');
    });

    await check(label + ': the latest refused file still supersedes an older pending read', async () => {
      await holdRead();
      await choose(viewer, join(files, 'incomplete.json'));
      await errorContains(viewer, 'not complete JSON');
      await releaseRead();
      assert.equal(await viewer.$eval('.record-filename', node => node.textContent), 'empty-record.json');
      assert.equal(await viewer.$$eval('.saved-event', nodes => nodes.length), 0);
      assert.equal(await viewer.$eval('#record-error', node => node.hidden), false);
    });

    await check(label + ': explicit clear cancels a pending read and returns keyboard focus', async () => {
      await holdRead();
      await viewer.focus('#clear-record');
      await viewer.keyboard.press('Space');
      await statusContains(viewer, 'View cleared.');
      await releaseRead();
      assert.equal(await viewer.$eval('#record-display', node => node.hidden), true);
      assert.equal(await viewer.$eval('#record-display', node => node.childElementCount), 0);
      assert.equal(await viewer.evaluate(() => document.activeElement.id), 'record-file');
      assert.equal(await viewer.$eval('#clear-record', node => node.disabled), true);
    });

    await check(label + ': unfinished history stays unknown and the saved download reopens after reload', async () => {
      const unknownFile = await put(files, 'unknown-record.json', serializeFixtureRecord(replayFixture().events.slice(0, 6)));
      await choose(viewer, unknownFile);
      await statusContains(viewer, 'Opened unknown-record.json.');
      assert.equal(await viewer.$eval('[data-checkpoint-id="journey"] .saved-capture', node => node.dataset.captureState), 'unknown');
      assert.equal(await viewer.$eval('.record-totals>div:nth-child(3) dd', node => node.textContent), '$0.00');
      await viewer.reload({ waitUntil: 'networkidle0' });
      assert.equal(await viewer.$eval('#record-display', node => node.hidden), true);
      await choose(viewer, downloaded);
      await statusContains(viewer, 'Opened scopesignal-fixture-record-v1.json.');
      assert.equal(await acceptedEvidence(viewer), accepted);
      assert.equal(await app.$eval('#evidence-handoff', node => node.value), draft);
      assert.equal(await app.$eval('#ledger-count', node => node.textContent), '8 events');
    });
    await context.close();
  }
  await check('viewer makes no external requests and all pages finish without script errors', async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(externalRequests.filter(request => request.role.endsWith(':viewer')), []);
    assert(externalRequests.filter(request => request.role.endsWith(':fixture')).every(request => request.url.startsWith('https://fonts.googleapis.com/css2?')));
  });
} catch (error) {
  if (!failures.length) failures.push({ name: 'receiver setup or execution', result: 'fail', error: error.stack });
} finally {
  const entry = require.resolve(modulePath);
  const receipt = {
    schema: 'scopesignal.record-viewer-browser.v1', at: new Date().toISOString(),
    source: root, sourceCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null,
    expectation: process.env.SCOPESIGNAL_EXPECTATION || 'candidate',
    node: process.version, platform: process.platform, architecture: process.arch,
    browser: browser ? await browser.version() : null,
    puppeteerEntry: entry, puppeteerEntrySha256: hash(await readFile(entry)),
    origin, servedSha256: Object.fromEntries([...served].sort()), downloads,
    checks, failures, pageErrors, externalRequests, passed: failures.length === 0,
  };
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
if (failures.length) process.exitCode = 1;
