import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
if (!['baseline', 'candidate'].includes(mode)) throw new Error('Choose baseline or candidate.');
const supplied = process.argv[3];
const output = path.join(root, mode + '-native');
const pins = JSON.parse(await fs.readFile(path.join(root, 'pins.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex');
const probeBytes = await fs.readFile(fileURLToPath(import.meta.url));
await fs.mkdir(output);
const source = path.join(output, 'source');
await fs.mkdir(source);
const files = {};
for (const pin of pins.files) {
  const bytes = await fs.readFile(path.join(supplied, pin.path));
  const override = mode === 'candidate' && pins.candidateOverrides[pin.path];
  if (override) assert.equal(hash(bytes), override, pin.path + ' candidate pin');
  else if (!(mode === 'candidate' && pin.path === 'README.md')) assert.equal(blob(bytes), pin.blob, pin.path + ' primary pin');
  const target = path.join(source, pin.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes, { flag: 'wx' });
  files[pin.path] = { bytes: bytes.length, sha256: hash(bytes), blob: blob(bytes), mode: pin.mode };
}
const receipt = {
  mode, primaryCommit: pins.baselineCommit, primaryTree: pins.baselineTree,
  node: process.version, platform: process.platform, sourceDirectory: source,
  suppliedDirectory: supplied, probeSha256: hash(probeBytes), files,
  cases: [], downloads: [], responses: [], nonlocalRequests: [], pageErrors: [],
  limits: ['Fresh isolated headless desktop Chrome and authored fixture data only.',
    '320 CSS pixel viewport is not an actual mobile operating system or screen reader.',
    'Review approval is the local fictional ledger action; no real approval or payment.',
    'The file-open intent/normalization repair is owned by PR22; this probe checks movement invalidation of a ready preview.']
};
const cache = new Map();
for (const p of Object.keys(files)) cache.set('/' + p, await fs.readFile(path.join(source, p)));
const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
  const bytes = cache.get(requestPath);
  if (!bytes) { response.writeHead(404); response.end('Missing local fixture resource'); return; }
  const type = requestPath.endsWith('.mjs') ? 'text/javascript' : requestPath.endsWith('.css') ? 'text/css' : requestPath.endsWith('.html') ? 'text/html' : 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(bytes);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const { default: puppeteer } = await import('/Users/me/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
const profile = path.join(output, 'profile');
const downloadRoot = path.join(output, 'downloads');
await fs.mkdir(downloadRoot);
let browser;
const responseTasks = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  const end = Date.now() + 7000;
  while (Date.now() < end) { if (await predicate()) return; await sleep(25); }
  throw new Error('Timed out: ' + label);
}
async function captureCase(name, run) {
  const started = Date.now();
  try { const detail = await run(); receipt.cases.push({ name, status: 'pass', milliseconds: Date.now() - started, detail }); }
  catch (error) { receipt.cases.push({ name, status: 'fail', milliseconds: Date.now() - started, error: String(error), stack: error.stack }); }
}
try {
  browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, userDataDir: profile,
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run',
      '--no-default-browser-check', '--disable-default-apps', '--disable-extensions',
      '--disable-features=MediaRouter,OptimizationHints', '--metrics-recording-only',
      '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1']
  });
  receipt.browser = await browser.version();
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloadRoot, eventsEnabled: true });
  const startedDownloads = [];
  const completedDownloads = new Set();
  cdp.on('Browser.downloadWillBegin', event => startedDownloads.push(event));
  cdp.on('Browser.downloadProgress', event => { if (event.state === 'completed') completedDownloads.add(event.guid); });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(origin + '/') || url.startsWith('blob:' + origin + '/') || url.startsWith('data:')) request.continue();
    else { receipt.nonlocalRequests.push({ url, method: request.method() }); request.abort('blockedbyclient'); }
  });
  page.on('pageerror', error => receipt.pageErrors.push(String(error)));
  page.on('response', response => {
    const url = response.url();
    if (!url.startsWith(origin + '/')) return;
    const p = new URL(url).pathname.slice(1);
    if (!files[p] || response.status() !== 200) return;
    responseTasks.push((async () => {
      try {
        const bytes = await response.buffer();
        receipt.responses.push({ path: p, status: response.status(), sha256: hash(bytes), equal: hash(bytes) === files[p].sha256 });
      } catch (error) { receipt.responses.push({ path: p, error: String(error), equal: false }); }
    })());
  });
  const values = () => page.evaluate(() => ({
    label: document.querySelector('#scope-label').value,
    brief: document.querySelector('#scope-brief').value,
    cap: document.querySelector('#scope-cap').value,
    checkpoints: [...document.querySelectorAll('.scope-row')].map(row => ({
      title: row.querySelector('[data-field="title"]').value,
      amount: row.querySelector('[data-field="amount"]').value,
      evidence: row.querySelector('[data-field="evidence"]').value
    }))
  }));
  async function fresh(width = 1280) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(origin + '/scope.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#scope-draft-list .scope-row');
  }
  async function seed(checkpoints, cap = '1000.00') {
    while (await page.$$eval('.scope-row', rows => rows.length) < checkpoints.length) await page.click('#scope-add');
    while (await page.$$eval('.scope-row', rows => rows.length) > checkpoints.length) await page.click('.scope-row:last-child button[data-remove]');
    const model = { label: '  Lead fixture · 文  ', brief: 'A local fictional brief.\nNo provider action.', cap, checkpoints };
    await page.evaluate(value => {
      const set = (selector, contents) => {
        const input = document.querySelector(selector);
        input.value = contents;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('#scope-label', value.label);
      set('#scope-brief', value.brief);
      set('#scope-cap', value.cap);
      value.checkpoints.forEach((cp, index) => {
        for (const key of ['title', 'amount', 'evidence']) set('#draft-' + index + '-' + key, cp[key]);
      });
    }, model);
    assert.deepEqual(await values(), model);
    return model;
  }
  async function moveControl(index, direction) {
    const handle = await page.evaluateHandle(({ index, direction }) => {
      const row = document.querySelectorAll('.scope-row')[index];
      return [...(row?.querySelectorAll('button') ?? [])].find(button => {
        const name = (button.getAttribute('aria-label') || '') + ' ' + button.textContent;
        return /\bmove\b/i.test(name) && new RegExp('\\b' + direction + '\\b', 'i').test(name);
      }) || null;
    }, { index, direction });
    const element = handle.asElement();
    if (!element) { await handle.dispose(); throw new Error('Missing native Move ' + direction + ' control for checkpoint ' + (index + 1)); }
    return element;
  }
  async function move(index, direction, key = 'Enter') {
    const control = await moveControl(index, direction);
    assert.equal(await control.evaluate(button => button.disabled), false, 'movement action enabled');
    await control.focus();
    await page.keyboard.press(key);
    await control.dispose();
  }
  async function nativeDownload(label) {
    const previous = startedDownloads.length;
    await page.click('#scope-save');
    await until(() => startedDownloads.length > previous, 'native download starts');
    const item = startedDownloads[previous];
    await until(() => completedDownloads.has(item.guid), 'native download completes');
    const original = path.join(downloadRoot, item.guid);
    const bytes = await fs.readFile(original);
    const target = path.join(downloadRoot, label + '.json');
    await fs.rename(original, target);
    receipt.downloads.push({ label, path: target, suggestedFilename: item.suggestedFilename, bytes: bytes.length, sha256: hash(bytes) });
    return { path: target, record: JSON.parse(bytes.toString('utf8')) };
  }
  async function openPreview(filename) {
    const picker = await page.$('#scope-open');
    await picker.uploadFile(filename);
    await page.waitForFunction(() => !document.querySelector('#scope-open-preview').hidden);
  }
  const unfinished = [
    { title: ' Same visible title ', amount: ' 00012.50 ', evidence: 'α first\n  spaces stay  ' },
    { title: ' Same visible title ', amount: '1e2', evidence: '<b>literal</b>\n第二行' },
    { title: 'Final ✨', amount: '.', evidence: '' }
  ];
  await captureCase('ordinary unfinished native download and reopen', async () => {
    await fresh();
    const expected = await seed(unfinished);
    const saved = await nativeDownload('ordinary-unfinished');
    assert.deepEqual(saved.record.draft, expected);
    assert.equal(saved.record.stage, 'draft');
    assert.deepEqual(saved.record.events, []);
    await fresh();
    await openPreview(saved.path);
    await page.click('#scope-open-apply');
    assert.deepEqual(await values(), expected);
    assert.equal(await page.$eval('#scope-form', form => form.hidden), false);
    return { rawDraft: expected, events: saved.record.events.length };
  });
  await captureCase('twelve tuple keyboard movement cycle and boundaries', async () => {
    await fresh();
    const tuples = Array.from({ length: 12 }, (_, i) => ({
      title: i % 2 ? 'Duplicate title' : '位置 ' + (i + 1),
      amount: ['.', '  ', '1e2', '0001.20'][i % 4],
      evidence: 'Tuple ' + i + '\nSame-looking title is not identity.'
    }));
    const original = await seed(tuples);
    const budget = await page.$eval('#scope-budget', node => node.textContent);
    const expected = structuredClone(original);
    const observations = [];
    for (const direction of ['up', 'down']) {
      for (let step = 0; step < 11; step += 1) {
        const from = direction === 'up' ? 11 - step : step;
        const to = direction === 'up' ? from - 1 : from + 1;
        await move(from, direction, step % 2 ? 'Space' : 'Enter');
        const [tuple] = expected.checkpoints.splice(from, 1);
        expected.checkpoints.splice(to, 0, tuple);
        assert.deepEqual(await values(), expected);
        const focus = await page.evaluate(() => document.activeElement.closest('.scope-row')?.dataset.index ?? null);
        assert.equal(focus, String(to), 'focus follows moved checkpoint');
        observations.push({ direction, from, to, focus, leadingEvidence: expected.checkpoints[0].evidence });
      }
    }
    assert.deepEqual(await values(), original);
    assert.equal(await page.$eval('#scope-budget', node => node.textContent), budget);
    assert.equal(await page.$eval('#scope-add', button => button.disabled), true);
    const up = await moveControl(0, 'up');
    const down = await moveControl(11, 'down');
    assert.equal(await up.evaluate(button => button.disabled), true);
    assert.equal(await down.evaluate(button => button.disabled), true);
    await up.evaluate(button => button.click());
    await down.evaluate(button => button.click());
    assert.deepEqual(await values(), original);
    assert.equal(await page.$eval('#scope-review', node => node.hidden), true);
    const saved = await nativeDownload('twelve-cycle');
    assert.deepEqual(saved.record.draft, original);
    return { movementCount: observations.length, observations, budget, events: saved.record.events.length };
  });
  await captureCase('invalid amount and error destination follow new position', async () => {
    await fresh();
    const model = await seed([
      { title: 'A', amount: '1.00', evidence: 'A proof' },
      { title: 'B invalid', amount: '1e2', evidence: 'B proof' },
      { title: 'C', amount: '2.00', evidence: 'C proof' }
    ]);
    await page.click('#scope-form button[type="submit"]');
    assert.equal(await page.$eval('#draft-1-amount', node => node.getAttribute('aria-invalid')), 'true');
    await move(1, 'up');
    const expected = { ...model, checkpoints: [model.checkpoints[1], model.checkpoints[0], model.checkpoints[2]] };
    assert.deepEqual(await values(), expected);
    assert.equal(await page.$eval('#scope-errors', node => node.hidden), true);
    assert.equal(await page.$$eval('[aria-invalid]', nodes => nodes.length), 0);
    await page.click('#scope-form button[type="submit"]');
    const links = await page.$$eval('#scope-errors a', links => links.map(a => a.getAttribute('href')));
    assert.deepEqual(links, ['#draft-0-amount']);
    await page.click('#scope-errors a');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'draft-0-amount');
    assert.equal(await page.$eval('#draft-0-amount', node => node.value), '1e2');
    return { links, rawInvalid: expected.checkpoints[0].amount };
  });
  await captureCase('movement invalidates ready file preview and late apply', async () => {
    await fresh();
    const model = await seed(unfinished);
    const older = {
      schema: 'scopesignal.scope-workspace', version: 1, fixtureOnly: true, paymentEvidence: false,
      stage: 'draft', draft: { label: 'OLDER', brief: 'Older fixture', cap: '12.00',
        checkpoints: [{ title: 'OLD', amount: '12.00', evidence: 'Old proof' }] },
      events: [], evidenceDrafts: []
    };
    const filename = path.join(output, 'older-preview.json');
    await fs.writeFile(filename, JSON.stringify(older, null, 2) + '\n');
    await openPreview(filename);
    await move(0, 'down');
    const expected = { ...model, checkpoints: [model.checkpoints[1], model.checkpoints[0], model.checkpoints[2]] };
    assert.equal(await page.$eval('#scope-open-preview', node => node.hidden), true);
    await page.$eval('#scope-open-apply', button => button.click());
    assert.deepEqual(await values(), expected);
    const saved = await nativeDownload('after-preview-invalidation');
    assert.deepEqual(saved.record.draft, expected);
    return { status: await page.$eval('#scope-file-status', node => node.textContent), oldDraftApplied: false };
  });
  await captureCase('review evidence follows tuple and final approval identity locks editing', async () => {
    await fresh();
    const items = [
      { title: '  A proof  ', amount: '001.25', evidence: 'A before' },
      { title: 'Same title', amount: '2.50', evidence: 'B before' },
      { title: 'Same title', amount: '3.75', evidence: 'C before' }
    ];
    await seed(items, '20.00');
    await page.click('#scope-form button[type="submit"]');
    const pending = 'B accepted <em>literal</em>\nsecond line';
    await page.$eval('#review-evidence-scope-2', (node, value) => {
      node.value = value; node.dispatchEvent(new Event('input', { bubbles: true }));
    }, pending);
    await page.click('#scope-edit');
    await move(1, 'down', 'Space');
    await page.click('#scope-form button[type="submit"]');
    const cards = await page.$$eval('.scope-review-card', cards => cards.map(card => ({
      id: card.dataset.checkpoint, title: card.querySelector('h3').textContent,
      evidence: card.querySelector('textarea').value,
      amount: card.querySelector('.scope-review-heading strong').textContent
    })));
    assert.deepEqual(cards, [
      { id: 'scope-1', title: 'A proof', evidence: 'A before', amount: '$1.25' },
      { id: 'scope-2', title: 'Same title', evidence: 'C before', amount: '$3.75' },
      { id: 'scope-3', title: 'Same title', evidence: pending, amount: '$2.50' }
    ]);
    assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
    await page.click('button[data-checkpoint="scope-3"][data-action="approve"]');
    assert.equal(await page.$eval('#scope-edit', node => node.disabled), true);
    await page.$eval('#scope-edit', button => button.click());
    assert.equal(await page.$eval('#scope-form', node => node.hidden), true);
    assert.equal(await page.$eval('#scope-captured', node => node.textContent), '$0.00');
    const saved = await nativeDownload('moved-reviewed-approval');
    assert.equal(saved.record.events.length, 1);
    assert.equal(saved.record.events[0].checkpointId, 'scope-3');
    assert.equal(saved.record.events[0].acceptedEvidence, pending);
    assert.equal(saved.record.draft.checkpoints[2].amount, '2.50');
    assert.equal(saved.record.draft.checkpoints[2].evidence, pending);
    return { cards, events: saved.record.events, captured: '$0.00', locked: true };
  });
  await captureCase('single-row disabled boundaries and narrow control geometry', async () => {
    await fresh(320);
    const expected = await seed([{ title: 'One', amount: '5.00', evidence: 'One proof' }]);
    const up = await moveControl(0, 'up');
    const down = await moveControl(0, 'down');
    for (const button of [up, down]) {
      assert.equal(await button.evaluate(node => node.disabled), true);
      await button.evaluate(node => node.click());
    }
    assert.deepEqual(await values(), expected);
    const geometry = await page.$$eval('.scope-row button', nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { name: node.getAttribute('aria-label') || node.textContent, x: box.x, right: box.right, width: box.width, height: box.height };
    }));
    for (const box of geometry) {
      assert.ok(box.x >= 0 && box.right <= 320, 'control remains within 320 CSS pixel viewport: ' + JSON.stringify(box));
      assert.ok(box.height >= 32 && box.width >= 32, 'usable control geometry');
    }
    await (await page.$('.scope-row')).screenshot({ path: path.join(output, 'narrow-single-row.png') });
    return { viewport: { width: 320, height: 900 }, geometry };
  });
  await Promise.all(responseTasks);
  await captureCase('exact served sources and isolated browser controls', async () => {
    assert.ok(receipt.responses.length > 0);
    assert.ok(receipt.responses.every(response => response.equal), 'actual response bytes match exact local pins');
    assert.deepEqual(receipt.pageErrors, []);
    assert.deepEqual(receipt.nonlocalRequests, []);
    for (const p of Object.keys(files)) assert.equal(hash(await fs.readFile(path.join(source, p))), files[p].sha256, p + ' unchanged');
    assert.equal(hash(await fs.readFile(fileURLToPath(import.meta.url))), receipt.probeSha256);
    return { responseCount: receipt.responses.length, sourceCount: Object.keys(files).length, sourcesUnchanged: true, probeUnchanged: true };
  });
} catch (error) {
  receipt.fatal = { error: String(error), stack: error.stack };
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await fs.rm(profile, { recursive: true, force: true });
  receipt.passed = receipt.cases.filter(test => test.status === 'pass').length;
  receipt.failed = receipt.cases.filter(test => test.status === 'fail').length;
  receipt.accepted = !receipt.fatal && receipt.failed === 0 && receipt.cases.length === 7;
  await fs.writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ mode, passed: receipt.passed, failed: receipt.failed, fatal: receipt.fatal, accepted: receipt.accepted,
    cases: receipt.cases.map(test => ({ name: test.name, status: test.status, error: test.error })), output }));
  process.exitCode = receipt.accepted ? 0 : 1;
}
