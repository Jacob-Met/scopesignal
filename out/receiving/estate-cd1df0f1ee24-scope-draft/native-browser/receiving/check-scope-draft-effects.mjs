// Focused correction of the first receiver's overly broad cross-origin check.
// The exact inherited font stylesheet request stays blocked. We require no
// authored data, no other external request and no application browser storage.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.SCOPESIGNAL_PUPPETEER);
const root = resolve(process.env.SCOPESIGNAL_SOURCE), output = resolve(process.env.SCOPESIGNAL_EVIDENCE);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(output, 'private-browser-profile-'));
const inheritedFont = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap';
const blocked = [], pageErrors = [], served = {};
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname));
    assert.ok(path.startsWith(root + sep)); const bytes = await readFile(path);
    served[path.slice(root.length + 1)] = createHash('sha256').update(bytes).digest('hex');
    const type = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' }[extname(path)];
    response.writeHead(200, { 'content-type': (type || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' }); response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const marker = 'FICTIONAL-SCOPE-RECEIVER-ONLY-α-7f4c1';
const imported = { label: marker + ' import', brief: 'Two lines\n' + marker, cap: '0090.00', checkpoints: [{ title: 'Proof ' + marker, amount: '0040.10', evidence: '<img id="scope-injected" src="https://example.invalid/no"> ' + marker }] };
const file = join(output, 'fictional-effect-input.json');
await writeFile(file, JSON.stringify({ schema: 'scopesignal.scope-draft', version: 1, fixtureOnly: true, draft: imported }));
let browser, result;
try {
  browser = await puppeteer.launch({ headless: true, userDataDir: profile, executablePath: process.env.SCOPESIGNAL_CHROME, args: ['--disable-background-networking', '--no-first-run', '--no-default-browser-check'] });
  const context = await browser.createBrowserContext(), page = await context.newPage();
  page.setDefaultTimeout(5000); await page.setViewport({ width: 390, height: 844 });
  await page.setRequestInterception(true);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origin) return request.continue();
    blocked.push({ url, method: request.method(), body: request.postData() ?? null, resource_type: request.resourceType() });
    return request.abort();
  });
  await page.goto(origin + '/scope.html', { waitUntil: 'networkidle0' }); await page.waitForSelector('#draft-0-title');
  await page.$eval('#scope-label', (node, marker) => { node.value = marker; node.dispatchEvent(new Event('input', { bubbles: true })); }, marker);
  const before = blocked.length;
  const chooserReady = page.waitForFileChooser(); await page.click('#scope-draft-open'); const chooser = await chooserReady; await chooser.accept([file]);
  await page.waitForFunction(() => !document.querySelector('#scope-file-preview').hidden);
  await page.click('#scope-file-details summary'); await page.click('#scope-file-replace');
  assert.equal(await page.$eval('#scope-label', node => node.value), imported.label);
  const cdp = await page.createCDPSession(); await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: output }); await page.click('#scope-draft-save');
  let download;
  for (let n = 0; n < 100; n++) { try { download = await readFile(join(output, 'scopesignal-scope-draft-v1.json')); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  assert.ok(download); assert.deepEqual(JSON.parse(download).draft, imported);
  await page.click('#scope-form button[type="submit"]');
  assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
  const storage = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).map(x => x.name), workers: (await navigator.serviceWorker.getRegistrations()).length }));
  assert.deepEqual(storage, { local: 0, session: 0, databases: [], workers: 0 });
  assert.ok(blocked.length >= 1, 'The unchanged stylesheet font import is observed');
  assert.equal(blocked.length, before, 'File actions must not add cross-origin requests');
  assert.deepEqual(blocked.filter(x => x.url !== inheritedFont || x.method !== 'GET' || x.body !== null || x.resource_type !== 'stylesheet'), []);
  assert.equal(await page.$$eval('#scope-injected', nodes => nodes.length), 0); assert.deepEqual(pageErrors, []);
  result = { passed: true, browser: await browser.version(), node: process.version, storage, external_request_count_before_file_actions: before, external_request_count_after_file_actions: blocked.length, actual_download: { bytes: download.length, sha256: createHash('sha256').update(download).digest('hex') }, no_authored_content_in_external_requests: true };
} catch (error) { result = { passed: false, error: error.message, stack: error.stack }; }
finally {
  if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
  result.captured_at = new Date().toISOString(); result.blocked = blocked; result.page_errors = pageErrors; result.served_sha256 = served;
  result.provenance = 'Frozen candidate-v1 production unchanged. This focused supplement resolves the initial receiver assumption, not a product change. Initial 17-functional-pass/1-network-assumption-fail receipt is preserved.';
  await writeFile(join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result)); process.exitCode = result.passed ? 0 : 1;
}
