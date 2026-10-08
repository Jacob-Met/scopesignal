import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const taskRoot = resolve(process.env.SCOPE_TASK_ROOT || '/tmp/ultra-20b27c2e-memory-scope-movement');
const sourceRoot = resolve(process.env.SCOPESIGNAL_SOURCE || taskRoot + '/baseline');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || taskRoot + '/before-native');
const puppeteerPath = process.env.SCOPESIGNAL_PUPPETEER || '/Users/me/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
const { default: puppeteer } = await import(pathToFileURL(puppeteerPath).href);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(taskRoot + '/browser-before-');
const served = {}, checks = [], pageErrors = [], blockedRequests = [];
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(sourceRoot, '.' + pathname);
    if (!file.startsWith(sourceRoot + sep)) throw Error('Outside source');
    const bytes = await readFile(file);
    served[file.slice(sourceRoot.length + 1)] = createHash('sha256').update(bytes).digest('hex');
    response.writeHead(200, { 'content-type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
const records = {};
async function check(name, run) {
  try { await run(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.stack }); }
}
try {
  browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, userDataDir: profile,
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 900 });
  page.setDefaultTimeout(4000);
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (new URL(request.url()).origin === origin) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  await page.goto(origin + '/scope.html', { waitUntil: 'networkidle0' });
  const raw = {
    label: '  Fictional observatory launch  ', brief: 'Draft-only local fixture. Nothing is approved.',
    cap: ' 0900.50 ', checkpoints: [
      { title: '  First concept <literal>  ', amount: ' 0100.50 ', evidence: '\nFirst proof\n  λ & 😀  \n' },
      { title: 'Second review', amount: '200.00', evidence: 'Second proof\nTwo views.' },
      { title: 'Third handoff', amount: '300.00', evidence: 'Third proof stays with its amount.' }
    ]
  };
  const read = () => page.evaluate(() => ({
    label: document.querySelector('#scope-label').value,
    brief: document.querySelector('#scope-brief').value,
    cap: document.querySelector('#scope-cap').value,
    checkpoints: [...document.querySelectorAll('.scope-row')].map(row => Object.fromEntries(['title', 'amount', 'evidence'].map(key => [key, row.querySelector('[data-field="' + key + '"]').value])))
  }));
  await check('native draft accepts the distinct raw checkpoint values', async () => {
    await page.evaluate(value => {
      for (const key of ['label', 'brief', 'cap']) {
        const input = document.querySelector('#scope-' + key); input.value = value[key]; input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      value.checkpoints.forEach((cp, index) => {
        for (const key of ['title', 'amount', 'evidence']) {
          const input = document.querySelector('#draft-' + index + '-' + key); input.value = cp[key]; input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }, raw);
    assert.deepEqual(await read(), raw);
  });
  await check('existing add/remove preserves the authored fields and budget', async () => {
    await page.click('#scope-add');
    await page.click('button[data-remove="3"]');
    assert.deepEqual(await read(), raw);
    assert.equal(await page.$eval('#scope-budget', node => node.textContent), '$600.50 allocated · $300.00 unallocated within the cap');
  });
  records.before = await read();
  records.buttons = await page.$$eval('#scope-draft-list button', nodes => nodes.map(node => ({ text: node.textContent, label: node.getAttribute('aria-label'), disabled: node.disabled })));
  await check('each editable checkpoint offers explicit movement controls', async () => {
    for (let index = 1; index <= 3; index++) {
      for (const direction of ['up', 'down']) {
        assert.equal(await page.$$eval('button[aria-label="Move checkpoint ' + index + ' ' + direction + '"]', nodes => nodes.length), 1, 'Missing Move checkpoint ' + index + ' ' + direction);
      }
    }
  });
  await check('the first checkpoint moves down with all three fields intact', async () => {
    const selector = 'button[aria-label="Move checkpoint 1 down"]';
    assert.ok(await page.$(selector), 'No native movement action is available');
    await page.click(selector);
    const expected = structuredClone(raw);
    expected.checkpoints = [raw.checkpoints[1], raw.checkpoints[0], raw.checkpoints[2]];
    assert.deepEqual(await read(), expected);
    assert.equal(await page.$eval('#scope-budget', node => node.textContent), '$600.50 allocated · $300.00 unallocated within the cap');
  });
  records.after = await read();
  await page.screenshot({ path: output + '/draft.png', fullPage: false });
  await check('the existing review derives IDs from displayed order and stays unapproved', async () => {
    await page.click('#scope-form button[type="submit"]');
    records.review = await page.$$eval('.scope-review-card', cards => cards.map(card => ({ id: card.dataset.checkpoint, title: card.querySelector('h3').textContent, evidence: card.querySelector('textarea').value })));
    assert.deepEqual(records.review.map(cp => cp.id), ['scope-1', 'scope-2', 'scope-3']);
    assert.deepEqual(records.review.map(cp => cp.title), records.after.checkpoints.map(cp => cp.title.trim()));
    assert.deepEqual(records.review.map(cp => cp.evidence), records.after.checkpoints.map(cp => cp.evidence.trim()));
    assert.equal(await page.$eval('#scope-approved', node => node.textContent), '0 / 3');
    assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
  });
  await check('native page has no JavaScript errors or fixture-origin escape', async () => {
    assert.deepEqual(pageErrors, []);
    assert(blockedRequests.every(url => url.startsWith('https://fonts.googleapis.com/')));
  });
} catch (error) { checks.push({ name: 'native receiving infrastructure', passed: false, error: error.stack }); }
finally {
  const receipt = { schema: 'scopesignal.draft-movement-before.v1', at: new Date().toISOString(), source: sourceRoot, node: process.version, browser: browser ? await browser.version() : null, profileIsFresh: true, servedSha256: served, checks, records, pageErrors, blockedRequests, passed: checks.every(check => check.passed) };
  await writeFile(output + '/receipt.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, passed: receipt.passed, pass: checks.filter(x => x.passed).length, fail: checks.filter(x => !x.passed).map(x => x.name), browser: receipt.browser }));
  await browser?.close();
  await new Promise(done => server.close(done));
  await rm(profile, { recursive: true });
  if (!receipt.passed) process.exitCode = 1;
}
