// Narrow receiving for the freshly merged timeline/export page and authored entry.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] || '.');
const output = resolve(process.argv[3] || 'browser-composition');
const { chromium } = await import(pathToFileURL(process.env.SCOPESIGNAL_PLAYWRIGHT).href);
const checks = [], failures = [], errors = [], externalRequests = [], downloads = [], served = new Map();
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    assert(file.startsWith(root + sep));
    const bytes = await readFile(file);
    served.set(file.slice(root.length + 1), hash(bytes));
    response.writeHead(200, { 'content-type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
await mkdir(output, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SCOPESIGNAL_CHROME });
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true });
    try {
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        externalRequests.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.locator('#evidence-accessibility').fill('Explicit current-page acceptance <review> & 😀');
      await page.locator('.approve[data-id="accessibility"]').click();
      const draft = '\nLiteral pending </textarea><script>draft</script> & 😀\n';
      await page.locator('#evidence-handoff').fill(draft);
      assert.equal(await page.locator('#approved').innerText(), '2 / 3');
      assert.equal(await page.locator('#ledger-count').innerText(), '8 events');
      async function downloadRecord(stage) {
        const waiting = page.waitForEvent('download');
        await page.locator('#export-record').click();
        const download = await waiting;
        assert.equal(download.suggestedFilename(), 'scopesignal-fixture-record-v1.json');
        const bytes = await readFile(await download.path());
        const record = JSON.parse(bytes);
        assert.equal(record.fixtureOnly, true);
        assert.equal(record.paymentEvidence, false);
        assert.equal(record.events.length, 8);
        assert.equal(record.checkpoints.find(row => row.id === 'accessibility').approval.acceptedEvidence, 'Explicit current-page acceptance <review> & 😀');
        downloads.push({ viewport: label, stage, bytes: bytes.length, sha256: hash(bytes), events: record.events.length });
        return bytes;
      }
      const before = await downloadRecord('before-timeline');
      await page.locator('#fixture-timeline summary').click();
      for (const index of [6, 7, 0, 4, 7]) await page.locator('#timeline-event').selectOption(String(index));
      assert.equal(await page.locator('#timeline-capture-state').textContent(), 'captured');
      assert.equal(await page.locator('#evidence-handoff').inputValue(), draft);
      assert.equal(await page.locator('#approved').innerText(), '2 / 3');
      assert.equal(await page.locator('#ledger-count').innerText(), '8 events');
      assert.deepEqual(await downloadRecord('after-timeline'), before);
      checks.push({ name: label + ': timeline inspection preserves current accepted evidence, pending draft, and exact downloaded record', result: 'pass' });
      await page.locator('#add-checkpoint').click();
      await page.waitForURL('**/scope.html');
      await page.locator('#draft-0-title').waitFor();
      assert.equal(await page.locator('.scope-row').count(), 3);
      assert.equal(await page.locator('#scope-cap').inputValue(), '1200.00');
      await page.getByRole('button', { name: 'Review this scope' }).click();
      assert.equal(await page.locator('#scope-approved').innerText(), '0 / 3');
      assert.equal(await page.locator('#scope-event-count').innerText(), '0 events');
      assert.equal(await page.locator('#scope-captured').innerText(), '$0.00');
      checks.push({ name: label + ': current combined page opens the accepted authoring module with no inherited approvals or events', result: 'pass' });
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  assert(externalRequests.every(url => url.startsWith('https://fonts.googleapis.com/css2?')));
  checks.push({ name: 'no page errors or unexpected external request attempts', result: 'pass' });
} catch (error) {
  failures.push({ name: 'current composition receiving', result: 'fail', error: error.stack });
} finally {
  const receipt = { schema: 'scopesignal.current-composition-receiving.v1', at: new Date().toISOString(), node: process.version, browser: browser?.version(), source: root, sourceBase: '31d683e35e4a70065a514cc459eb83d8ffc573ca', origin, servedSha256: Object.fromEntries([...served].sort()), checks, failures, downloads, pageErrors: errors, externalRequests, passed: failures.length === 0 };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failures.length) process.exitCode = 1;
