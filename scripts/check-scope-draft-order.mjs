// Optional native receiving for draft checkpoint movement. Reuse an installed
// Puppeteer/Chrome; every page and download belongs to a local fictional fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/scope-draft-order-receiving');
const { default: puppeteer } = await import(process.env.SCOPESIGNAL_PUPPETEER
  ? pathToFileURL(resolve(process.env.SCOPESIGNAL_PUPPETEER)).href : 'puppeteer');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(output, 'fresh-browser-'));
const checks = [], pageErrors = [], blockedRequests = [], downloads = [], served = {};
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/scope.html' : pathname));
    if (!file.startsWith(root + sep)) throw Error('Outside source');
    const bytes = await readFile(file);
    served[file.slice(root.length + 1)] = createHash('sha256').update(bytes).digest('hex');
    response.writeHead(200, { 'content-type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser, client;

const fixture = () => ({
  label: '  Fictional observatory launch  ',
  brief: 'Local fictional brief. No provider action.',
  cap: ' 0900.50 ',
  checkpoints: [
    { title: '  Same <literal>  ', amount: ' 0100.50 ', evidence: '\nFirst proof\n  λ & 😀  \n' },
    { title: '  Same <literal>  ', amount: '200.00', evidence: 'Second proof\nIndependent value.' },
    { title: 'Final handoff', amount: '300.00', evidence: 'Third proof stays with its amount.' }
  ]
});
const rowButton = (index, direction) => 'button[aria-label="Move checkpoint ' + (index + 1) + ' ' + direction + '"]';
const readDraft = page => page.evaluate(() => ({
  label: document.querySelector('#scope-label').value,
  brief: document.querySelector('#scope-brief').value,
  cap: document.querySelector('#scope-cap').value,
  checkpoints: [...document.querySelectorAll('.scope-row')].map(row => Object.fromEntries(
    ['title', 'amount', 'evidence'].map(key => [key, row.querySelector('[data-field="' + key + '"]').value])
  ))
}));
async function enterDraft(page, draft) {
  await page.evaluate(value => {
    for (const key of ['label', 'brief', 'cap']) {
      const input = document.querySelector('#scope-' + key);
      input.value = value[key]; input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    value.checkpoints.forEach((cp, index) => {
      for (const key of ['title', 'amount', 'evidence']) {
        const input = document.querySelector('#draft-' + index + '-' + key);
        input.value = cp[key]; input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }, draft);
}
const text = (page, selector) => page.$eval(selector, node => node.textContent);
const visible = (page, selector) => page.$eval(selector, node => node.getClientRects().length > 0);
const focusLabel = page => page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.id);
const move = (page, index, direction) => page.click(rowButton(index, direction));
const reviewAction = (page, id, action) => page.click('button[data-checkpoint="' + id + '"][data-action="' + action + '"]');

async function openFile(page, path) {
  const input = await page.$('#scope-open');
  await input.uploadFile(path);
  await page.waitForSelector('#scope-open-preview', { visible: true });
}
async function downloadWorkspace(page, label) {
  const dir = resolve(output, 'downloads', label);
  await mkdir(dir, { recursive: true });
  await client.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: dir, eventsEnabled: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const begin = once(client, 'Browser.downloadWillBegin', { signal: controller.signal });
  let listener;
  const end = new Promise((done, reject) => {
    listener = event => {
      if (event.state === 'completed') done(event);
      if (event.state === 'canceled') reject(Error('Native download canceled'));
    };
    client.on('Browser.downloadProgress', listener);
    controller.signal.addEventListener('abort', () => reject(Error('Native download timed out')), { once: true });
  });
  try {
    await page.click('#scope-save');
    const [[start], finish] = await Promise.all([begin, end]);
    assert.equal(finish.guid, start.guid);
    assert.equal(start.suggestedFilename, 'scopesignal-workspace-v1.json');
    const path = resolve(dir, start.guid);
    const bytes = await readFile(path);
    const record = JSON.parse(bytes.toString('utf8'));
    assert.equal(record.fixtureOnly, true);
    assert.equal(record.paymentEvidence, false);
    downloads.push({ label, path: path.slice(output.length + 1), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), suggestedFilename: start.suggestedFilename });
    return { path, bytes, record };
  } finally {
    clearTimeout(timeout);
    client.off('Browser.downloadProgress', listener);
  }
}
async function scenario(label, viewport, name, action) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  page.on('pageerror', error => pageErrors.push({ label, name, error: String(error) }));
  page.on('request', request => {
    if (new URL(request.url()).origin === origin) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  try {
    await page.goto(origin + '/scope.html', { waitUntil: 'networkidle0' });
    await enterDraft(page, fixture());
    const observations = await action(page);
    checks.push({ name: label + ': ' + name, passed: true, observations });
  } catch (error) {
    checks.push({ name: label + ': ' + name, passed: false, error: error.stack });
  } finally { await page.close(); }
}

try {
  browser = await puppeteer.launch({
    headless: true, userDataDir: profile,
    ...(process.env.SCOPESIGNAL_CHROME ? { executablePath: process.env.SCOPESIGNAL_CHROME } : {}),
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run']
  });
  client = await browser.target().createCDPSession();
  for (const [label, viewport] of [['desktop', { width: 1280, height: 960 }], ['phone', { width: 390, height: 844 }]]) {
    await scenario(label, viewport, 'pointer and keyboard movement keep raw fields, focus, totals and row labels', async page => {
      const expected = fixture();
      assert.equal(await page.$eval(rowButton(0, 'up'), node => node.disabled), true);
      assert.equal(await page.$eval(rowButton(2, 'down'), node => node.disabled), true);
      await move(page, 0, 'down');
      [expected.checkpoints[0], expected.checkpoints[1]] = [expected.checkpoints[1], expected.checkpoints[0]];
      assert.deepEqual(await readDraft(page), expected);
      assert.equal(await focusLabel(page), 'Move checkpoint 2 down');
      assert.equal(await text(page, '#scope-order-status'), 'Checkpoint 1 moved to position 2 of 3.');
      await page.keyboard.press('Space');
      [expected.checkpoints[1], expected.checkpoints[2]] = [expected.checkpoints[2], expected.checkpoints[1]];
      assert.deepEqual(await readDraft(page), expected);
      assert.equal(await focusLabel(page), 'draft-2-title');
      await page.focus('#draft-2-evidence');
      await page.keyboard.press('Tab');
      assert.equal(await focusLabel(page), 'Move checkpoint 3 up');
      await page.keyboard.press('Enter');
      [expected.checkpoints[1], expected.checkpoints[2]] = [expected.checkpoints[2], expected.checkpoints[1]];
      assert.deepEqual(await readDraft(page), expected);
      assert.equal(await focusLabel(page), 'Move checkpoint 2 up');
      await page.keyboard.press('Enter');
      [expected.checkpoints[0], expected.checkpoints[1]] = [expected.checkpoints[1], expected.checkpoints[0]];
      assert.deepEqual(await readDraft(page), fixture());
      assert.equal(await focusLabel(page), 'draft-0-title');
      assert.equal(await text(page, '#scope-budget'), '$600.50 allocated · $300.00 unallocated within the cap');
      const labels = await page.$$eval('.scope-row legend', nodes => nodes.map(node => node.textContent));
      assert.deepEqual(labels, ['Checkpoint 1', 'Checkpoint 2', 'Checkpoint 3']);
      const bounds = await page.$$eval('.scope-draft-actions button', nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, height: r.height };
      }));
      assert(bounds.every(box => box.left >= 0 && box.right <= viewport.width + 1 && box.height >= 44));
      const width = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert(width.scroll <= width.viewport + 1, JSON.stringify(width));
      await page.$eval('.scope-row', node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.screenshot({ path: resolve(output, label + '-draft-controls.png'), fullPage: false });
      assert.equal(await page.$('#scope-injected'), null);
      return { order: expected.checkpoints.map(cp => cp.amount), labels, width, focus: await focusLabel(page) };
    });

    await scenario(label, viewport, 'unfinished values remain unchanged and validation follows their new positions', async page => {
      const raw = fixture();
      raw.checkpoints[1] = { title: '', amount: '1e2', evidence: '\n  \n' };
      await enterDraft(page, raw);
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await visible(page, '#scope-errors'), true);
      assert.equal(await page.$eval('#draft-1-amount', node => node.getAttribute('aria-invalid')), 'true');
      await move(page, 1, 'up');
      [raw.checkpoints[0], raw.checkpoints[1]] = [raw.checkpoints[1], raw.checkpoints[0]];
      assert.deepEqual(await readDraft(page), raw);
      assert.equal(await visible(page, '#scope-errors'), false);
      assert.equal(await text(page, '#scope-budget'), 'Enter valid USD amounts to see the allocation.');
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await visible(page, '#scope-review'), false);
      assert.equal(await page.$eval('#draft-0-amount', node => node.getAttribute('aria-invalid')), 'true');
      assert.match(await text(page, '#scope-errors'), /checkpoint 1/);
      await page.click('#scope-errors a[href="#draft-0-amount"]');
      assert.equal(await focusLabel(page), 'draft-0-amount');
      assert.deepEqual(await readDraft(page), raw);
      return { invalidAmount: raw.checkpoints[0].amount, invalidPosition: 1 };
    });

    await scenario(label, viewport, 'one and twelve checkpoint bounds preserve add/remove and complete row order', async page => {
      await page.click('button[data-remove="2"]');
      await page.click('button[data-remove="1"]');
      const single = await readDraft(page);
      assert.equal(await page.$eval(rowButton(0, 'up'), node => node.disabled), true);
      assert.equal(await page.$eval(rowButton(0, 'down'), node => node.disabled), true);
      assert.equal(await page.$eval('button[data-remove]', node => node.disabled), true);
      await page.$eval(rowButton(0, 'up'), node => node.click());
      assert.deepEqual(await readDraft(page), single);
      for (let index = 1; index < 12; index++) await page.click('#scope-add');
      const twelve = fixture();
      twelve.cap = '1200.00';
      twelve.checkpoints = Array.from({ length: 12 }, (_, index) => ({ title: 'Row ' + (index + 1), amount: (index + 1) + '.01', evidence: 'Proof ' + (index + 1) }));
      await enterDraft(page, twelve);
      assert.equal(await page.$eval('#scope-add', node => node.disabled), true);
      for (let index = 11; index > 0; index--) await move(page, index, 'up');
      twelve.checkpoints.unshift(twelve.checkpoints.pop());
      assert.deepEqual(await readDraft(page), twelve);
      assert.equal(await focusLabel(page), 'draft-0-title');
      assert.equal(await page.$eval(rowButton(0, 'up'), node => node.disabled), true);
      assert.equal(await page.$eval(rowButton(11, 'down'), node => node.disabled), true);
      await page.click('button[data-remove="5"]');
      twelve.checkpoints.splice(5, 1);
      assert.deepEqual(await readDraft(page), twelve);
      assert.equal(await text(page, '#scope-order-status'), '');
      await page.click('#scope-add');
      twelve.checkpoints.push({ title: '', amount: '', evidence: '' });
      assert.deepEqual(await readDraft(page), twelve);
      return { first: twelve.checkpoints[0], count: twelve.checkpoints.length, last: twelve.checkpoints.at(-1) };
    });

    await scenario(label, viewport, 'review evidence moves before approval and final IDs retain the existing approval lock', async page => {
      await page.click('#scope-form button[type="submit"]');
      const edited = '\nReviewed second proof\n  exact pending text 😀  \n';
      await page.$eval('#review-evidence-scope-2', (node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, edited);
      await page.click('#scope-edit');
      assert.equal((await readDraft(page)).checkpoints[1].evidence, edited);
      await move(page, 1, 'up');
      await page.click('#scope-form button[type="submit"]');
      assert.equal(await page.$eval('#review-evidence-scope-1', node => node.value), edited.trim());
      assert.equal(await text(page, '#scope-event-count'), '0 events');
      await reviewAction(page, 'scope-1', 'approve');
      const saved = await downloadWorkspace(page, label + '-approved-order');
      assert.equal(saved.record.events.length, 1);
      assert.equal(saved.record.events[0].checkpointId, 'scope-1');
      assert.equal(saved.record.events[0].acceptedEvidence, edited.trim());
      assert.equal(saved.record.draft.checkpoints[0].amount, '200.00');
      assert.equal(await page.$eval('#scope-edit', node => node.disabled), true);
      assert.equal(await visible(page, '#scope-form'), false);
      const before = saved.bytes;
      await page.$eval(rowButton(0, 'down'), node => node.click());
      const after = await downloadWorkspace(page, label + '-locked-order');
      assert.deepEqual(after.bytes, before);
      for (const action of ['order', 'request', 'lose']) await reviewAction(page, 'scope-1', action);
      assert.equal(await text(page, '#scope-captured'), '$0.00');
      assert.match(await text(page, 'article[data-checkpoint="scope-1"] .scope-review-state'), /unknown/i);
      assert.equal(await page.$('button[data-checkpoint="scope-1"][data-action="request"]'), null);
      return { acceptedCheckpoint: saved.record.events[0].checkpointId, amount: saved.record.draft.checkpoints[0].amount, unknownRemainsUncounted: true };
    });

    await scenario(label, viewport, 'download and native reopen preserve order; movement invalidates an older preview', async page => {
      await move(page, 2, 'up');
      const moved = await readDraft(page);
      const saved = await downloadWorkspace(page, label + '-draft-order');
      assert.equal(saved.record.stage, 'draft');
      assert.deepEqual(saved.record.draft, moved);
      assert.deepEqual(saved.record.events, []);
      await page.reload({ waitUntil: 'networkidle0' });
      const original = await readDraft(page);
      await openFile(page, saved.path);
      assert.deepEqual(await readDraft(page), original);
      await page.click('#scope-open-apply');
      assert.deepEqual(await readDraft(page), moved);
      await openFile(page, saved.path);
      await move(page, 0, 'down');
      const latest = await readDraft(page);
      assert.equal(await visible(page, '#scope-open-preview'), false);
      assert.match(await text(page, '#scope-file-status'), /workspace changed/i);
      await page.$eval('#scope-open-apply', node => node.click());
      assert.deepEqual(await readDraft(page), latest);
      return { openedOrder: moved.checkpoints.map(cp => cp.amount), latestOrder: latest.checkpoints.map(cp => cp.amount), events: saved.record.events.length };
    });

    await scenario(label, viewport, 'movement invalidates an in-flight file read through the existing workspace boundary', async page => {
      const saved = await downloadWorkspace(page, label + '-read-race');
      await page.evaluate(() => {
        const nativeRead = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = function () {
          const file = this;
          return new Promise((done, reject) => {
            window.finishScopeRead = () => nativeRead.call(file).then(done, reject);
          });
        };
      });
      const input = await page.$('#scope-open');
      await input.uploadFile(saved.path);
      await page.waitForFunction(() => typeof window.finishScopeRead === 'function');
      await move(page, 0, 'down');
      const latest = await readDraft(page);
      assert.match(await text(page, '#scope-file-status'), /workspace changed/i);
      await page.evaluate(async () => { await window.finishScopeRead(); await new Promise(done => setTimeout(done, 0)); });
      assert.equal(await visible(page, '#scope-open-preview'), false);
      await page.$eval('#scope-open-apply', node => node.click());
      assert.deepEqual(await readDraft(page), latest);
      return { lateReadDidNotReplace: true, order: latest.checkpoints.map(cp => cp.amount) };
    });
  }
  assert.deepEqual(pageErrors, []);
  assert(blockedRequests.every(url => url.startsWith('https://fonts.googleapis.com/')));
  checks.push({ name: 'no native page errors or external fixture requests', passed: true });
} catch (error) {
  checks.push({ name: 'native receiving infrastructure', passed: false, error: error.stack });
} finally {
  const receipt = {
    schema: 'scopesignal.draft-order-receiving.v1', at: new Date().toISOString(),
    source: root, sourceCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null,
    node: process.version, browser: browser ? await browser.version() : null,
    freshProfile: true, servedSha256: served, checks, downloads, pageErrors, blockedRequests,
    scope: 'Fictional local drafts and existing simulated ledger only; no provider operation.',
    passed: checks.every(check => check.passed)
  };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, pass: checks.filter(x => x.passed).length, fail: checks.filter(x => !x.passed).map(x => ({ name: x.name, error: x.error })), downloads: downloads.length, browser: receipt.browser }));
  await client?.detach();
  await browser?.close();
  await new Promise(done => server.close(done));
  await rm(profile, { recursive: true });
  if (!receipt.passed) process.exitCode = 1;
}
