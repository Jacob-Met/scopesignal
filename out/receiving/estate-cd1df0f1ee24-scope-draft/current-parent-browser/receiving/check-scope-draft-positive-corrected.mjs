// One bounded receiving route for a current-parent composition or its public
// deployment. Uses actual downloaded files, DOM observations and response pins.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), puppeteer = require(process.env.SCOPESIGNAL_PUPPETEER);
const root = resolve(process.env.SCOPESIGNAL_SOURCE), output = resolve(process.env.SCOPESIGNAL_EVIDENCE);
const manifest = JSON.parse(await readFile(process.env.SCOPESIGNAL_MANIFEST, 'utf8'));
const pins = new Map(manifest.files.map(f => [f.path, f]));
const publicURL = process.env.SCOPESIGNAL_PUBLIC_URL;
const expectedCommit = process.env.SCOPESIGNAL_EXPECTED_COMMIT || null;
if (publicURL) assert.ok(expectedCommit, 'Public receiving requires an explicit deployed commit identity');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
const allowedAssets = new Set(['index.html', 'scope.html', 'app.mjs', 'styles.css', 'scope-workspace.css', 'fixture-timeline.css', 'src/agents.mjs', 'src/ledger.mjs', 'src/payment-status.mjs', 'src/fixture-record.mjs', 'src/scope-plan.mjs', 'src/scope-workspace.mjs', 'src/scope-draft-file.mjs', 'src/scope-draft-controls.mjs', 'src/fixture-timeline.mjs', 'src/fixture-timeline-view.mjs']);
await mkdir(output, { recursive: true }); const profile = await mkdtemp(join(output, 'private-browser-profile-'));
let server, browser, result;
const blocked = [], pageErrors = [], responseErrors = [], responses = [], pendingResponses = [];
let base;
if (publicURL) {
  base = new URL(publicURL); assert.equal(base.protocol, 'https:');
  assert.ok(base.pathname.endsWith('/'), 'Supply the established site directory URL, ending in /');
} else {
  server = createServer(async (request, response) => {
    try {
      const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname));
      assert.ok(path.startsWith(root + sep)); const bytes = await readFile(path);
      const type = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css' }[extname(path)];
      response.writeHead(200, { 'content-type': (type || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' }); response.end(bytes);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = new URL('http://127.0.0.1:' + server.address().port + '/');
}
function assetFor(url) {
  const u = new URL(url);
  return u.origin === base.origin && u.pathname.startsWith(base.pathname) ? u.pathname.slice(base.pathname.length) : null;
}
async function observedDraft(page) {
  return page.evaluate(() => ({ label: document.querySelector('#scope-label').value, brief: document.querySelector('#scope-brief').value, cap: document.querySelector('#scope-cap').value,
    checkpoints: [...document.querySelectorAll('.scope-row')].map(row => ({ title: row.querySelector('[data-field="title"]').value, amount: row.querySelector('[data-field="amount"]').value, evidence: row.querySelector('[data-field="evidence"]').value })) }));
}
async function fill(page, selector, value) {
  await page.$eval(selector, (node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function ensureResponses() {
  await Promise.all(pendingResponses);
  assert.deepEqual(responseErrors, [], 'Every observed declared source response must match its expected SHA256 and Git blob');
}
try {
  browser = await puppeteer.launch({ headless: true, userDataDir: profile, executablePath: process.env.SCOPESIGNAL_CHROME,
    args: ['--disable-background-networking', '--no-first-run', '--no-default-browser-check'] });
  const context = await browser.createBrowserContext(), page = await context.newPage();
  page.setDefaultTimeout(5000); await page.setViewport({ width: 390, height: 844 }); await page.setCacheEnabled(false);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url(), asset = assetFor(url);
    if (url.startsWith('blob:') || url.startsWith('data:')) return request.continue();
    if (asset && allowedAssets.has(asset) && request.method() === 'GET') return request.continue();
    blocked.push({ url, method: request.method(), body: request.postData() ?? null, resource_type: request.resourceType() }); return request.abort();
  });
  page.on('response', response => {
    const path = assetFor(response.url()); if (!path || !allowedAssets.has(path)) return;
    pendingResponses.push((async () => {
      try {
        const bytes = await response.buffer(), actual = { path, status: response.status(), bytes: bytes.length, sha256: digest(bytes), git_blob: gitBlob(bytes) };
        responses.push(actual); const expected = pins.get(path);
        assert.equal(actual.status, 200); assert.equal(actual.sha256, expected.sha256); assert.equal(actual.git_blob, expected.git_blob);
      } catch (error) { responseErrors.push({ path, error: error.message }); }
    })());
  });
  await page.goto(new URL('index.html', base).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#evidence-handoff'); await ensureResponses();
  assert.ok(responses.some(r => r.path === 'app.mjs' && r.git_blob === '7398ab71912a6e5e55a1da8ccef3f8fdee82c135'), 'Current PR15 app source must actually load unchanged');
  await page.goto(new URL('scope.html', base).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#draft-0-title'); await ensureResponses();
  const initial = await observedDraft(page);
  await fill(page, '#scope-label', '  Fictional composed scope 日本語 😀  ');
  await fill(page, '#scope-brief', '\nA saved unfinished scope\nSecond line α\n');
  await fill(page, '#scope-cap', 'not finished');
  await fill(page, '#draft-0-title', '');
  await fill(page, '#draft-0-evidence', '\nLiteral <proof> & “quoted” evidence 😀\n');
  const authored = await observedDraft(page);
  const cdp = await page.createCDPSession(); await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
  await page.click('#scope-draft-save');
  const downloadedPath = join(output, 'scopesignal-scope-draft-v1.json'); let bytes;
  for (let n = 0; n < 100; n++) { try { bytes = await readFile(downloadedPath); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  assert.ok(bytes, 'Native download finishes'); const file = JSON.parse(bytes);
  assert.deepEqual(Object.keys(file).sort(), ['draft', 'fixtureOnly', 'schema', 'version']); assert.deepEqual(file.draft, authored);
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#draft-0-title'); await ensureResponses();
  assert.deepEqual(await observedDraft(page), initial);
  const ready = page.waitForFileChooser(); await page.click('#scope-draft-open'); const chooser = await ready; await chooser.accept([downloadedPath]);
  await page.waitForFunction(() => !document.querySelector('#scope-file-preview').hidden);
  assert.deepEqual(await observedDraft(page), initial);
  assert.ok(await page.$eval('#scope-file-summary', node => node.textContent.includes('Unfinished draft')));
  await page.click('#scope-file-replace'); assert.deepEqual(await observedDraft(page), authored);
  const width = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth })); assert.equal(width.page, width.viewport);
  await page.screenshot({ path: join(output, 'phone-reopened.png'), fullPage: true });
  await fill(page, '#scope-cap', initial.cap); await fill(page, '#draft-0-title', 'Completed draft title for new review');
  await page.click('#scope-form button[type="submit"]');
  assert.equal(await page.$eval('#scope-review', node => node.hidden), false);
  assert.equal(await page.$eval('#scope-event-count', node => node.textContent), '0 events');
  assert.equal(await page.$eval('#scope-approved', node => node.textContent), '0 / ' + initial.checkpoints.length);
  assert.equal(await page.$eval('#scope-captured', node => node.textContent), '$0.00');
  await ensureResponses(); assert.deepEqual(pageErrors, []);
  assert.equal(new Set(responses.map(r => r.path)).size, allowedAssets.size, 'All16 declared runtime assets received');
  const inheritedFont = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap';
  const browserIcon = new URL('/favicon.ico', base).href;
  assert.deepEqual(blocked.filter(r => {
    const inherited = r.url === inheritedFont && r.resource_type === 'stylesheet';
    const browserGenerated = r.url === browserIcon && r.resource_type === 'other';
    return (!inherited && !browserGenerated) || r.method !== 'GET' || r.body !== null;
  }), []);
  result = { passed: true, browser: await browser.version(), node: process.version, current_app_loaded_exact: true, actual_unfinished_download_reopened_exact: true,
    preview_preserved_current_draft: true, fresh_review: { events: 0, approved: 0, captured_usd: '0.00' }, runtime_assets: allowedAssets.size,
    native_download: { bytes: bytes.length, sha256: digest(bytes) }, viewport: width };
} catch (error) { result = { passed: false, error: error.message, stack: error.stack }; }
finally {
  if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
  Object.assign(result, { captured_at: new Date().toISOString(), mode: publicURL ? 'public-route' : 'current-parent-loopback', expected_commit: expectedCommit,
    parent_commit: manifest.parent_commit, origin: base.href, responses, response_errors: responseErrors, blocked, page_errors: pageErrors,
    limits: 'One fresh native Chrome viewport and bounded positive workflow. Normal browser certificate verification. No asynchronous-suite rerun, no live payment/provider calls, no deployment dispatch or installed-state mutation.' });
  await writeFile(join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result)); process.exitCode = result.passed ? 0 : 1;
}
