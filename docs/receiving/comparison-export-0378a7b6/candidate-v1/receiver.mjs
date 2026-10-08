import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/comparison-export');
const baseline = process.env.SCOPESIGNAL_EXPECT_EXPORT === '0';
const { chromium } = await import(process.env.SCOPESIGNAL_PLAYWRIGHT
  ? pathToFileURL(process.env.SCOPESIGNAL_PLAYWRIGHT).href : 'playwright');
const { draftFromFixture, createScopeReview } = await import(pathToFileURL(resolve(root, 'src/scope-plan.mjs')));
const { encodeScopeWorkspace } = await import(pathToFileURL(resolve(root, 'src/scope-workspace-record.mjs')));
const checks = [], errors = [], external = [], served = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + sep)) throw new Error('Outside source');
    const bytes = await readFile(file);
    served.set(file.slice(root.length + 1), hash(bytes));
    response.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const original = () => structuredClone(draftFromFixture());
const accepted = 'Recorded proof <literal> & “quoted” 雪';
const pending = 'Pending only\n<img id="injected" src="https://invalid.test/x" onerror="globalThis.injected=true">';
const actions = [['scope-1', 'approve', accepted], ['scope-1', 'order'],
  ['scope-1', 'request'], ['scope-1', 'lose'], ['scope-1', 'receipt'],
  ['scope-1', 'duplicate'], ['scope-1', 'reconcile']];
function saved(name, draft = original(), count = null) {
  const review = count === null ? null : createScopeReview(draft);
  for (const args of actions.slice(0, count ?? 0)) review.act(...args);
  return { name, mimeType: 'application/json', buffer: Buffer.from(encodeScopeWorkspace({
    draft, review, evidenceDrafts: review ? new Map([['scope-2', pending]]) : new Map()
  })) };
}
let browser, context, page, reportPage;
async function check(name, run) {
  await run(); checks.push({ name, result: 'pass' }); console.log('PASS ' + name);
}
async function open(side, file) {
  await page.locator('#file-' + side).setInputFiles(file);
  await page.waitForFunction(({ side, name }) => document.querySelector('#status-' + side).textContent.startsWith('Opened ' + name + '.'), { side, name: file.name });
}
async function state() {
  return page.evaluate(() => ({
    a: document.querySelector('#name-a').textContent, b: document.querySelector('#name-b').textContent,
    project: document.querySelector('#project-fields').textContent,
    totals: document.querySelector('#totals').textContent,
    rows: document.querySelector('#paired-rows').textContent,
    unpaired: document.querySelector('#unpaired-rows').textContent,
    history: document.querySelector('#history-summary').textContent,
    pairs: [...document.querySelectorAll('#pair-controls select')].map(n => [n.id, n.value]),
    filter: document.querySelector('#changes-only').checked,
    writes: globalThis.receivingStorageWrites || 0
  }));
}
let downloadNumber = 0;
async function download() {
  const before = await state();
  const waiting = page.waitForEvent('download');
  await page.locator('#download-comparison').click();
  const result = await waiting;
  assert.equal(result.suggestedFilename(), 'scopesignal-comparison-review.html');
  const path = resolve(output, 'comparison-' + (++downloadNumber) + '.html');
  await result.saveAs(path);
  assert.deepEqual(await state(), before);
  const bytes = await readFile(path);
  reportPage ||= await context.newPage();
  await reportPage.goto(pathToFileURL(path).href);
  return { path, bytes };
}
let outcome = 'pass', failure;
try {
  browser = await chromium.launch({
    headless: true, chromiumSandbox: true,
    executablePath: process.env.SCOPESIGNAL_CHROME || undefined,
    args: ['--disk-cache-size=1048576', '--disable-dev-shm-usage']
  });
  context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 1000 } });
  await context.addInitScript(() => {
    globalThis.receivingStorageWrites = 0;
    for (const name of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[name];
      Storage.prototype[name] = function(...args) { globalThis.receivingStorageWrites++; return original.apply(this, args); };
    }
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || url.protocol === 'file:' || url.protocol === 'blob:') return route.continue();
    external.push(url.href); return route.abort();
  });
  context.on('page', tab => { tab.setDefaultTimeout(8000); tab.on('pageerror', error => errors.push(error.message)); });
  page = await context.newPage();
  await page.goto(origin + '/scope-compare.html');
  await check('real native saved files retain unknown A, captured B and chosen pairing', async () => {
    await open('a', saved('Unknown <A>.json', original(), 6));
    await open('b', saved('Captured B.json', original(), 7));
    assert.equal(await page.locator('#history-summary').getAttribute('data-relationship'), 'a-prefix');
    assert.equal(await page.locator('#totals [data-field="captured"] [data-side="a"]').textContent(), '$0.00');
    assert.equal(await page.locator('#totals [data-field="captured"] [data-side="b"]').textContent(), '$400.00');
    assert.equal(await page.locator('[data-pair]').count(), 3);
  });
  if (baseline) {
    await check('original source has no downloadable comparison review', async () => {
      assert.equal(await page.locator('#download-comparison').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Download comparison review', exact: true }).count(), 0);
    });
    await page.screenshot({ path: resolve(output, 'baseline-comparison.png'), fullPage: true });
  } else {
    await check('actual HTML download opens offline with complete correct fields and histories', async () => {
      const result = await download();
      assert.equal(await reportPage.locator('[data-file="a"]').textContent(), 'Unknown <A>.json');
      assert.equal(await reportPage.locator('#project [data-field="captured"] [data-side="a"]').textContent(), '$0.00');
      assert.equal(await reportPage.locator('#project [data-field="captured"] [data-side="b"]').textContent(), '$400.00');
      assert.equal(await reportPage.locator('[data-pair="0-0"] [data-field="acceptedEvidence"] [data-side="a"]').textContent(), accepted);
      assert.equal(await reportPage.locator('[data-pair="1-1"] [data-field="pendingEvidence"] [data-side="a"]').textContent(), pending);
      assert.equal(await reportPage.locator('#history-a [data-event]').count(), 6);
      assert.equal(await reportPage.locator('#history-b [data-event]').count(), 7);
      assert.equal(await reportPage.locator('script,input,button,select,iframe,img,object,embed,link').count(), 0);
      assert.equal(await reportPage.evaluate(() => Boolean(globalThis.injected)), false);
      await writeFile(resolve(output, 'first-download.json'), JSON.stringify({ bytes: result.bytes.length, sha256: hash(result.bytes) }, null, 2));
    });
    await check('manual pairing and unpaired rows survive export and side swap', async () => {
      await page.locator('#pair-1').selectOption('');
      await page.locator('#pair-0').selectOption('1');
      await download();
      assert.equal(await reportPage.locator('[data-pair="0-1"]').count(), 1);
      assert.equal(await reportPage.locator('[data-unpaired="a-1"]').count(), 1);
      assert.equal(await reportPage.locator('[data-unpaired="b-0"]').count(), 1);
      await page.locator('#swap').click();
      await download();
      assert.equal(await reportPage.locator('[data-pair="1-0"]').count(), 1);
      assert.equal(await reportPage.locator('[data-file="a"]').textContent(), 'Captured B.json');
      assert.equal(await reportPage.locator('[data-relationship]').getAttribute('data-relationship'), 'b-prefix');
    });
    await check('changed-only view still exports the complete comparison with explicit wording', async () => {
      await page.locator('#reset-pairs').click();
      await page.locator('#changes-only').check();
      assert.equal(await page.locator('#project-fields [data-field="stage"]').count(), 0);
      await download();
      assert.equal(await reportPage.locator('#project [data-field="stage"]').count(), 1);
      assert.equal(await reportPage.locator('[data-pair]').count(), 3);
      assert.match(await page.locator('#comparison-download-help').textContent(), /all fields and both complete event histories/);
    });
    await check('export while another file read is pending binds to displayed files', async () => {
      await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = function() {
          const result = original.call(this);
          if (this.name !== 'Pending replacement.json') return result;
          return new Promise(resolve => { globalThis.releaseRead = async () => resolve(await result); });
        };
      });
      await page.locator('#file-a').setInputFiles(saved('Pending replacement.json'));
      await page.waitForFunction(() => Boolean(globalThis.releaseRead));
      await download();
      assert.equal(await reportPage.locator('[data-file="a"]').textContent(), 'Captured B.json');
      await page.evaluate(() => globalThis.releaseRead());
      await page.waitForFunction(() => document.querySelector('#name-a').textContent === 'Pending replacement.json');
    });
    await check('HTML refusal and download preparation failure preserve state and permit retry', async () => {
      const bad = original(); bad.brief = 'Cannot retain\u0000in HTML';
      await open('a', saved('Bad HTML text.json', bad));
      let downloads = 0;
      const observed = () => downloads++;
      page.on('download', observed);
      const before = await state();
      await page.locator('#download-comparison').click();
      assert.match(await page.locator('#comparison-status').textContent(), /cannot be preserved in HTML/);
      assert.deepEqual(await state(), before); assert.equal(downloads, 0);
      await open('a', saved('Valid retry.json', original(), 6));
      await page.evaluate(() => { globalThis.originalObjectURL = URL.createObjectURL; URL.createObjectURL = () => { throw new Error('Injected preparation refusal'); }; });
      const ready = await state();
      await page.locator('#download-comparison').click();
      assert.match(await page.locator('#comparison-status').textContent(), /Injected preparation refusal/);
      assert.deepEqual(await state(), ready); assert.equal(downloads, 0);
      await page.evaluate(() => { URL.createObjectURL = globalThis.originalObjectURL; });
      await download();
      page.off('download', observed);
    });
    await check('keyboard activation, desktop and phone layout, and printable static output', async () => {
      await page.locator('#changes-only').uncheck();
      await page.screenshot({ path: resolve(output, 'comparison-desktop.png'), fullPage: true });
      await reportPage.screenshot({ path: resolve(output, 'report-desktop.png'), fullPage: true });
      await reportPage.emulateMedia({ media: 'print' });
      await reportPage.pdf({ path: resolve(output, 'report-print.pdf'), format: 'A4', printBackground: true });
      await reportPage.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width: 390, height: 844 });
      await reportPage.setViewportSize({ width: 390, height: 844 });
      for (const tab of [page, reportPage]) assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#download-comparison').focus();
      const waiting = page.waitForEvent('download'); await page.keyboard.press('Enter'); await waiting;
      await page.screenshot({ path: resolve(output, 'comparison-phone.png'), fullPage: true });
      await reportPage.screenshot({ path: resolve(output, 'report-phone.png'), fullPage: true });
    });
  }
  await check('isolated route has no storage writes, script exceptions or external resource requests', async () => {
    assert.equal((await state()).writes, 0);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
  });
} catch (error) {
  outcome = 'fail'; failure = { name: error.name, message: error.message, stack: error.stack };
  console.error(error.stack); process.exitCode = 1;
} finally {
  const receipt = { schema: 'scopesignal.comparison-export.receiving.v1', source: root, mode: baseline ? 'original' : 'candidate',
    outcome, checks, failure, browser: browser?.version(), node: process.version, sourceHashes: Object.fromEntries(served),
    pageErrors: errors, externalRequests: external, receivedAt: new Date().toISOString() };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await context?.close(); await browser?.close(); server.close();
  console.log(JSON.stringify({ outcome, checks: checks.length, output }));
}
