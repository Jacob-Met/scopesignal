// Independent user-route receiving. Source remains frozen; this driver imports
// no ScopeSignal implementation or validator. Controlled File read delays only
// expose real asynchronous chooser boundaries; all file selection is native.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { hostname, release } from 'node:os';

const require = createRequire(import.meta.url);
const puppeteerEntry = process.env.SCOPESIGNAL_PUPPETEER;
const puppeteer = require(puppeteerEntry);
const root = resolve(process.env.SCOPESIGNAL_SOURCE);
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
const served = new Map(), external = [], pageErrors = [], cases = [], downloads = [];
await mkdir(output, { recursive: true });
const fixtureDir = join(output, 'input-files');
await mkdir(fixtureDir, { recursive: true });
const profile = await mkdtemp(join(output, 'private-browser-profile-'));
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/scope.html' : decodeURIComponent(pathname)));
    if (!path.startsWith(root + sep)) throw Error('Outside supplied source');
    const bytes = await readFile(path);
    served.set(path.slice(root.length + 1), { bytes: bytes.length, sha256: hash(bytes), git_blob: blob(bytes) });
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser, browserVersion, fatal = null, activePage;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const envelope = draft => ({ schema: 'scopesignal.scope-draft', version: 1, fixtureOnly: true, draft });
const validDraft = {
  label: '  Fictional reopened project 日本語 😀  ',
  brief: '\nFirst line & <brief>\nSecond line — naïve\n', cap: '0090.00',
  checkpoints: [
    { title: '  Design <concept>  ', amount: '0040.10', evidence: '\nEvidence α\nLiteral <img id="scope-injected" src="https://example.invalid/no"> 😀\n' },
    { title: 'Delivery', amount: '20.00', evidence: 'Human reviews the fictional deliverable.' }
  ]
};
async function inputFile(name, data) {
  const path = join(fixtureDir, name);
  await writeFile(path, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n');
  return path;
}
const validFile = await inputFile('fictional-valid-日本語.json', envelope(validDraft));
const anotherDraft = { ...validDraft, label: 'Newer selection Ω', cap: '120.00' };
const anotherFile = await inputFile('newer-selection.json', envelope(anotherDraft));

async function draft(page) {
  return page.evaluate(() => ({
    label: document.querySelector('#scope-label').value,
    brief: document.querySelector('#scope-brief').value,
    cap: document.querySelector('#scope-cap').value,
    checkpoints: [...document.querySelectorAll('.scope-row')].map(row => ({
      title: row.querySelector('[data-field="title"]').value,
      amount: row.querySelector('[data-field="amount"]').value,
      evidence: row.querySelector('[data-field="evidence"]').value
    }))
  }));
}
async function fill(page, selector, value, dispatch = true) {
  await page.$eval(selector, (node, { value, dispatch }) => {
    node.value = value;
    if (dispatch) node.dispatchEvent(new Event('input', { bubbles: true }));
  }, { value, dispatch });
}
async function markNodes(page) {
  await page.evaluate(() => { window.__receivingNodes = [...document.querySelectorAll('#scope-label,#scope-brief,#scope-cap,.scope-row input,.scope-row textarea')]; });
}
async function assertNodes(page) {
  assert.equal(await page.evaluate(() => {
    const now = [...document.querySelectorAll('#scope-label,#scope-brief,#scope-cap,.scope-row input,.scope-row textarea')];
    return now.length === window.__receivingNodes.length && now.every((node, i) => node === window.__receivingNodes[i]);
  }), true, 'Current draft input nodes must remain intact');
}
async function choose(page, path, keyboard = false) {
  const ready = page.waitForFileChooser({ timeout: 5000 });
  if (keyboard) { await page.focus('#scope-draft-open'); await page.keyboard.press('Enter'); }
  else await page.click('#scope-draft-open');
  const chooser = await ready;
  if (path === null) await chooser.cancel();
  else await chooser.accept([path]);
  return chooser;
}
async function preview(page) {
  await page.waitForFunction(() => !document.querySelector('#scope-file-preview').hidden);
}
async function errorShown(page) {
  await page.waitForFunction(() => document.querySelector('#scope-file-status').classList.contains('error'));
  return page.$eval('#scope-file-status', node => node.textContent);
}
async function reset(page) {
  await page.goto(origin + '/scope.html', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#draft-0-title');
  await page.waitForSelector('#scope-draft-save');
}
async function record(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    cases.push({ name, passed: true, ms: Date.now() - start, ...detail });
  } catch (error) {
    const failure = { name, passed: false, ms: Date.now() - start, error: error.message, stack: error.stack };
    try { failure.status = await activePage.$eval('#scope-file-status', node => node.textContent); } catch {}
    cases.push(failure);
  }
  console.log(JSON.stringify(cases.at(-1)));
}
async function saveDownload(page, name) {
  const dir = join(output, 'downloads', name);
  await mkdir(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await page.click('#scope-draft-save');
  const path = join(dir, 'scopesignal-scope-draft-v1.json');
  let bytes;
  for (let i = 0; i < 100; i++) {
    try { if ((await stat(path)).size) { bytes = await readFile(path); break; } } catch {}
    await sleep(50);
  }
  assert.ok(bytes, 'A real browser download must finish');
  await cdp.detach();
  const content = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(Object.keys(content).sort(), ['draft', 'fixtureOnly', 'schema', 'version']);
  assert.equal(content.schema, 'scopesignal.scope-draft');
  assert.equal(content.version, 1);
  assert.equal(content.fixtureOnly, true);
  downloads.push({ name, path: path.slice(output.length + 1), bytes: bytes.length, sha256: hash(bytes), native_download: true });
  return { path, bytes, content };
}
async function holdReads(page) {
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    window.__receivingReads = [];
    File.prototype.arrayBuffer = function () {
      const file = this;
      const bytes = original.call(file);
      return new Promise((resolve, reject) => {
        window.__receivingReads.push({ name: file.name, release: () => bytes.then(resolve, reject), reject: () => reject(new Error('Independent controlled unreadable file')) });
      });
    };
    window.__receivingRestoreReads = () => { File.prototype.arrayBuffer = original; };
  });
}
async function readCount(page, n) {
  await page.waitForFunction(n => window.__receivingReads.length === n, {}, n);
}
async function releaseRead(page, i, reject = false) {
  await page.evaluate(({ i, reject }) => { window.__receivingReads[i][reject ? 'reject' : 'release'](); }, { i, reject });
  await sleep(100);
}
async function unchanged(page, before, nodes = true) {
  assert.deepEqual(await draft(page), before);
  if (nodes) await assertNodes(page);
  assert.equal(await page.$eval('#scope-review', node => node.hidden), true);
}
async function layout(page) {
  const result = await page.evaluate(() => ({
    inner: innerWidth, scroll: document.documentElement.scrollWidth,
    save: (() => { const r = document.querySelector('#scope-draft-save').getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height }; })(),
    open: (() => { const r = document.querySelector('#scope-draft-open').getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height }; })()
  }));
  assert.ok(result.scroll <= result.inner + 1, 'No horizontal page overflow');
  for (const control of [result.save, result.open]) assert.ok(control.width > 40 && control.height >= 36 && control.x >= 0 && control.right <= result.inner);
  return result;
}
try {
  browser = await puppeteer.launch({ headless: true, userDataDir: profile, executablePath: process.env.SCOPESIGNAL_CHROME,
    args: ['--disable-background-networking', '--no-first-run', '--no-default-browser-check'] });
  browserVersion = await browser.version();
  for (const [view, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); activePage = page;
    await page.setViewport(viewport); page.setDefaultTimeout(5000);
    page.on('pageerror', error => pageErrors.push({ view, message: error.message }));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origin) return request.continue();
      external.push({ view, url, method: request.method(), body: request.postData() ?? null, resource_type: request.resourceType() }); return request.abort();
    });
    let actualDownload, authored;
    await record(view + ': actual incomplete download, reload, preview, cancel and reopen', async () => {
      await reset(page);
      const initial = await draft(page);
      await fill(page, '#scope-label', '  Fictional draft α 😀 ' + view + '  ');
      await fill(page, '#scope-brief', '\nA proposed scope\r\nwith Unicode 日本語\n');
      await fill(page, '#scope-cap', 'not finished');
      await fill(page, '#draft-0-title', '  Concept <review> & design  ');
      await fill(page, '#draft-0-amount', '0040.10');
      await fill(page, '#draft-0-evidence', '\nProof </textarea><img id="scope-injected" src="https://example.invalid/no"> 😀\n');
      await page.click('#scope-add'); authored = await draft(page);
      assert.equal(authored.checkpoints.length, 4);
      assert.equal(authored.brief.includes('\r'), false, 'Native textarea normalizes CRLF to LF');
      actualDownload = await saveDownload(page, view + '-unfinished');
      assert.deepEqual(actualDownload.content.draft, authored);
      assert.equal(await page.$$eval('#scope-injected', nodes => nodes.length), 0);
      await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#draft-0-title');
      assert.deepEqual(await draft(page), initial);
      await markNodes(page);
      await choose(page, actualDownload.path, true); await preview(page);
      await unchanged(page, initial);
      assert.equal(await page.$eval('#scope-file-summary', node => node.textContent.includes('Unfinished draft')), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'scope-file-preview-title');
      await page.click('#scope-file-details summary');
      assert.equal(await page.$eval('#scope-file-brief', node => node.textContent), authored.brief);
      assert.equal(await page.$$eval('#scope-injected', nodes => nodes.length), 0);
      const measurements = await layout(page);
      await page.screenshot({ path: join(output, view + '-preview.png'), fullPage: true });
      await page.focus('#scope-file-cancel'); await page.keyboard.press('Enter');
      await unchanged(page, initial);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'scope-draft-open');
      await choose(page, actualDownload.path); await preview(page);
      await page.focus('#scope-file-replace'); await page.keyboard.press('Enter');
      assert.deepEqual(await draft(page), authored);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'scope-label');
      assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
      await page.screenshot({ path: join(output, view + '-reopened.png'), fullPage: true });
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await page.$eval('#scope-errors', node => node.hidden), false, 'Incomplete draft remains subject to ordinary Review validation');
      assert.equal(await page.$eval('#scope-review', node => node.hidden), true);
      return { raw_fields_equal: true, checkpoint_rows: authored.checkpoints.length, layout: measurements, keyboard_open_cancel_replace: true };
    });
    await record(view + ': native file chooser cancellation preserves current draft', async () => {
      await reset(page); await fill(page, '#scope-label', 'Retained through chooser cancellation ' + view);
      const before = await draft(page); await markNodes(page);
      await choose(page, null); await sleep(100);
      await unchanged(page, before);
      assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
      // Some CDP chooser implementations cancel without dispatching HTML cancel.
      return { current_draft_preserved: true, status: await page.$eval('#scope-file-status', node => node.textContent) };
    });
    await record(view + ': valid draft starts fresh review; approvals cannot be resumed by file', async () => {
      await reset(page); await choose(page, validFile); await preview(page);
      assert.equal(await page.$eval('#scope-file-summary', node => node.textContent.includes('Ready for review')), true);
      await page.click('#scope-file-replace'); assert.deepEqual(await draft(page), validDraft);
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await page.$eval('#scope-review', node => node.hidden), false);
      assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
      assert.equal(await page.$eval('#scope-approved', node => node.textContent), '0 / 2');
      assert.equal(await page.$eval('#scope-draft-open', node => node.getClientRects().length), 0);
      await fill(page, '#review-evidence-scope-1', 'Edited before any approval Ω');
      await page.click('#scope-edit');
      assert.equal((await draft(page)).checkpoints[0].evidence, 'Edited before any approval Ω');
      const saved = await saveDownload(page, view + '-edited-before-review');
      assert.equal(saved.content.draft.checkpoints[0].evidence, 'Edited before any approval Ω');
      await page.click('#scope-form button[type="submit"]');
      await page.click('[data-action="approve"][data-checkpoint="scope-1"]');
      assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '1 event');
      assert.equal(await page.$eval('#scope-approved', node => node.textContent), '1 / 2');
      assert.equal(await page.$eval('#scope-edit', node => node.disabled), true);
      assert.equal(await page.$eval('#scope-draft-open', node => node.getClientRects().length), 0);
      await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#draft-0-title');
      await choose(page, saved.path); await preview(page); await page.click('#scope-file-replace');
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
      assert.equal(await page.$eval('#scope-approved', node => node.textContent), '0 / 2');
      return { unapproved_edit_retained: true, prior_approval_not_in_file: true, fresh_reopened_review: true };
    });
    if (view === 'phone') { await context.close(); continue; }
    const invalids = [
      ['malformed.json', '{invalid'],
      ['unsupported-version.json', { ...envelope(validDraft), version: 2 }],
      ['wrong-schema.json', { ...envelope(validDraft), schema: 'scopesignal.fixture-record' }],
      ['approval-history.json', { ...envelope(validDraft), events: [{ type: 'checkpoint.approved' }] }],
      ['row-approval.json', envelope({ ...validDraft, checkpoints: [{ ...validDraft.checkpoints[0], approved: true }] })],
      ['not-fixture.json', { ...envelope(validDraft), fixtureOnly: false }],
      ['zero-rows.json', envelope({ ...validDraft, checkpoints: [] })],
      ['too-many-rows.json', envelope({ ...validDraft, checkpoints: Array.from({ length: 13 }, () => validDraft.checkpoints[0]) })],
      ['nontext-cap.json', envelope({ ...validDraft, cap: 90 })],
      ['cr-textarea.json', envelope({ ...validDraft, brief: 'a\r\nb' })],
      ['newline-input.json', envelope({ ...validDraft, label: 'two\nlines' })],
      ['invalid-utf8.json', Buffer.from([0xff, 0xfe, 0xfd])],
      ['oversized.json', Buffer.alloc(1024 * 1024 + 1, 0x20)]
    ];
    await record('desktop: malformed/unsupported/state-bearing/oversized/invalid-UTF8 imports refuse without draft mutation', async () => {
      await reset(page); await fill(page, '#scope-label', 'Keep these unsaved fields 😀');
      await fill(page, '#scope-cap', 'unfinished');
      const before = await draft(page); await markNodes(page); const refused = [];
      for (const [name, data] of invalids) {
        const path = await inputFile(name, data);
        await choose(page, path);
        const status = await errorShown(page);
        await unchanged(page, before);
        assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'scope-draft-open');
        refused.push({ name, status });
      }
      return { refused, original_input_nodes_preserved: true };
    });
    await record('desktop: UTF8 BOM and CRLF JSON layout preserve LF field values', async () => {
      await reset(page);
      const path = await inputFile('bom-crlf-layout.json', '\uFEFF' + JSON.stringify(envelope(validDraft), null, 2).replace(/\n/g, '\r\n') + '\r\n');
      await choose(page, path); await preview(page); await page.click('#scope-file-replace');
      assert.deepEqual(await draft(page), validDraft);
      const downloaded = await saveDownload(page, 'bom-roundtrip');
      assert.deepEqual(downloaded.content.draft, validDraft);
      return { values_equal_after_native_import_and_download: true };
    });
    await record('desktop: edit while native chooser is outstanding cannot be overwritten', async () => {
      await reset(page);
      const ready = page.waitForFileChooser(); await page.click('#scope-draft-open'); const chooser = await ready;
      await fill(page, '#scope-label', 'Newer edit while picker is outstanding');
      const before = await draft(page); await markNodes(page);
      await chooser.accept([validFile]); await sleep(100);
      await unchanged(page, before);
      assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
      return { current_edit_retained: true };
    });
    await record('desktop: edit during asynchronous native read invalidates pending file', async () => {
      await reset(page); await holdReads(page); await choose(page, validFile); await readCount(page, 1);
      await fill(page, '#scope-brief', 'Typing while the selected file reads\nNewer line');
      const before = await draft(page); await markNodes(page);
      await releaseRead(page, 0); await unchanged(page, before);
      assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
      return { current_edit_retained: true };
    });
    await record('desktop: later selection wins after older successful read', async () => {
      await reset(page); await holdReads(page); await choose(page, validFile); await readCount(page, 1);
      await choose(page, anotherFile); await readCount(page, 2);
      await releaseRead(page, 1); await preview(page);
      const title = await page.$eval('#scope-file-label', node => node.textContent);
      const status = await page.$eval('#scope-file-status', node => node.textContent);
      await releaseRead(page, 0);
      assert.equal(await page.$eval('#scope-file-label', node => node.textContent), title);
      assert.equal(await page.$eval('#scope-file-status', node => node.textContent), status);
      await page.click('#scope-file-replace'); assert.deepEqual(await draft(page), anotherDraft);
      return { later_selection_received: true, older_success_suppressed: true };
    });
    await record('desktop: older read error cannot overwrite newer preview or status', async () => {
      await reset(page); await holdReads(page); await choose(page, validFile); await readCount(page, 1);
      await choose(page, anotherFile); await readCount(page, 2);
      await releaseRead(page, 1); await preview(page);
      const status = await page.$eval('#scope-file-status', node => node.textContent);
      await releaseRead(page, 0, true);
      assert.equal(await page.$eval('#scope-file-status', node => node.textContent), status);
      await page.click('#scope-file-replace'); assert.deepEqual(await draft(page), anotherDraft);
      return { newer_preview_preserved: true, older_error_suppressed: true };
    });
    await record('desktop: unreadable chosen file preserves fields and allows retry', async () => {
      await reset(page); const before = await draft(page); await markNodes(page);
      await holdReads(page); await choose(page, validFile); await readCount(page, 1); await releaseRead(page, 0, true);
      const status = await errorShown(page); await unchanged(page, before);
      await page.evaluate(() => window.__receivingRestoreReads());
      await choose(page, validFile); await preview(page); await page.click('#scope-file-cancel'); await unchanged(page, before);
      return { status, same_file_retry_succeeded: true };
    });
    await record('desktop: oversized native file is rejected before reading bytes', async () => {
      await reset(page); const before = await draft(page); await markNodes(page); await holdReads(page);
      await choose(page, join(fixtureDir, 'oversized.json')); await errorShown(page);
      assert.equal(await page.evaluate(() => window.__receivingReads.length), 0); await unchanged(page, before);
      return { read_calls: 0 };
    });
    await record('desktop: edit or row change after preview invalidates replacement', async () => {
      const results = [];
      for (const action of ['type', 'add', 'remove']) {
        await reset(page); await choose(page, validFile); await preview(page);
        if (action === 'type') await fill(page, '#scope-label', 'New draft after preview');
        if (action === 'add') await page.click('#scope-add');
        if (action === 'remove') await page.click('[data-remove="1"]');
        const after = await draft(page);
        assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
        await page.$eval('#scope-file-replace', button => button.click());
        assert.deepEqual(await draft(page), after);
        results.push({ action, stale_replacement_refused: true });
      }
      return { results };
    });
    await record('desktop: raw DOM value change without input event blocks stale replacement', async () => {
      await reset(page); await choose(page, validFile); await preview(page);
      await fill(page, '#scope-label', 'External value change without input event', false);
      const before = await draft(page); await markNodes(page);
      await page.click('#scope-file-replace'); await unchanged(page, before);
      assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
      return { raw_current_values_checked: true };
    });
    await record('desktop: entering review during read invalidates import and stale errors', async () => {
      await reset(page); const before = await draft(page); await holdReads(page);
      await choose(page, validFile); await readCount(page, 1);
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await page.$eval('#scope-review', node => node.hidden), false);
      await releaseRead(page, 0, true);
      assert.equal(await page.$eval('#scope-file-status', node => node.textContent), '');
      assert.equal(await page.$eval('#scope-file-preview', node => node.hidden), true);
      assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
      await page.click('#scope-edit'); assert.deepEqual(await draft(page), before);
      return { review_and_edit_preserved: true };
    });
    await record('desktop: no application storage or new cross-origin effects beyond inherited font stylesheet', async () => {
      const storage = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).map(x => x.name), workers: (await navigator.serviceWorker.getRegistrations()).length }));
      assert.deepEqual(storage, { local: 0, session: 0, databases: [], workers: 0 });
      const inheritedFont = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap';
      const unexpected = external.filter(request => request.url !== inheritedFont || request.method !== 'GET' || request.body !== null || request.resource_type !== 'stylesheet');
      assert.deepEqual(unexpected, []);
      storage.inherited_font_requests_blocked = external.length;
      return storage;
    });
    await context.close();
  }
} catch (error) { fatal = { name: error.name, message: error.message, stack: error.stack }; }
finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  const receipt = {
    captured_at: new Date().toISOString(), mode: 'candidate-v1', source: root,
    node: process.version, host: hostname(), os: release(), browser: browserVersion,
    puppeteer_entry: puppeteerEntry, base_commit: '317c1aad0bc6d68e4f4d3c70863b481741a61fb5',
    cases, production_downloads: downloads, served: Object.fromEntries(served),
    external_requests_blocked: external, page_errors: pageErrors, fatal,
    independent_oracle: 'Observed actual form strings and native downloaded JSON. No application implementation, parser, validator or ledger imported by this driver.',
    limits: 'Native Chrome with two viewport sizes, private temporary profile and loopback frozen source. Controlled File read promises exercise async boundaries. No Safari/Firefox/real phone, deployment or installed-service adoption claimed.'
  };
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ result: 'complete', cases: cases.length, passed: cases.filter(x => x.passed).length, failed: cases.filter(x => !x.passed).length, page_errors: pageErrors, fatal }));
  process.exitCode = fatal || pageErrors.length || cases.some(x => !x.passed) ? 1 : 0;
}
