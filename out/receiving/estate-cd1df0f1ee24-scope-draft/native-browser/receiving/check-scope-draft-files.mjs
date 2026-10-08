// Independent native browser receiving for ScopeSignal authored draft files.
// Uses an existing Chromium/Puppeteer installation, private loopback source,
// actual browser DOM and disposable contexts. No provider or storage service.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { hostname, release } from 'node:os';

const require = createRequire(import.meta.url);
const puppeteerEntry = process.env.SCOPESIGNAL_PUPPETEER;
if (!puppeteerEntry) throw Error('Set SCOPESIGNAL_PUPPETEER to an existing module.');
const puppeteer = require(puppeteerEntry);
const root = resolve(process.env.SCOPESIGNAL_SOURCE);
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE);
const mode = process.env.SCOPESIGNAL_RECEIVING_MODE || 'baseline';
if (mode !== 'baseline') throw Error('Only the frozen baseline is received by this revision.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
const served = new Map(), external = [], pageErrors = [], cases = [], downloads = [];
await mkdir(output, { recursive: true });
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
let browser, browserVersion, fatal = null;
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
async function fill(page, selector, value) {
  await page.$eval(selector, (node, value) => {
    node.value = value;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
try {
  browser = await puppeteer.launch({
    headless: true, userDataDir: profile, executablePath: process.env.SCOPESIGNAL_CHROME,
    args: ['--disable-background-networking', '--no-first-run', '--no-default-browser-check']
  });
  browserVersion = await browser.version();
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport(viewport);
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => pageErrors.push({ viewport: label, message: error.message }));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origin) return request.continue();
      external.push({ viewport: label, url }); return request.abort();
    });
    await page.goto(origin + '/scope.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#draft-0-title');
    const initial = await draft(page);
    await fill(page, '#scope-label', '  Fictional draft α 😀 ' + label + '  ');
    await fill(page, '#scope-brief', '\nA proposed scope\r\nwith Unicode 日本語 and a second line\n');
    await fill(page, '#scope-cap', 'not finished');
    await fill(page, '#draft-0-title', 'Launch <concept> & design');
    await fill(page, '#draft-0-amount', '0040.10');
    await fill(page, '#draft-0-evidence', '\n\nProof </textarea><img id="draft-injected" src="https://example.invalid/should-not-load"> & “quoted” 😀\n');
    await page.click('#scope-add');
    const authored = await draft(page);
    assert.equal(authored.checkpoints.length, 4);
    assert.equal(authored.checkpoints[3].title, '');
    assert.equal(authored.cap, 'not finished');
    assert.equal(await page.$$eval('#draft-injected', nodes => nodes.length), 0);
    const controls = await page.$$eval('button, input[type="file"], a[download]', nodes => nodes.map(node => ({
      tag: node.tagName, id: node.id, text: node.textContent.trim(), type: node.getAttribute('type')
    })));
    const hasSave = controls.some(node => /save draft/i.test(node.text));
    const hasOpen = controls.some(node => /open draft/i.test(node.text) || node.type === 'file');
    await writeFile(join(output, label + '-authored-dom.json'), JSON.stringify(authored, null, 2) + '\n');
    await page.screenshot({ path: join(output, label + '-authored.png'), fullPage: true });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#draft-0-title');
    const reloaded = await draft(page);
    assert.deepEqual(reloaded, initial);
    assert.notDeepEqual(reloaded, authored);
    await writeFile(join(output, label + '-reloaded-dom.json'), JSON.stringify(reloaded, null, 2) + '\n');
    cases.push({
      viewport: label, authored_fields_survive_row_addition: true,
      save_draft_present: hasSave, open_draft_present: hasOpen,
      incomplete_authored_draft_lost_on_reload: true,
      intended_save_open_gate: hasSave && hasOpen ? 'present' : 'failed: controls absent',
      fixture_review_visible: await page.$eval('#scope-review', node => !node.hidden)
    });
    await context.close();
  }
} catch (error) {
  fatal = { name: error.name, message: error.message, stack: error.stack };
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  const receipt = {
    captured_at: new Date().toISOString(), mode, source: root,
    node: process.version, host: hostname(), os: release(), browser: browserVersion,
    puppeteer_entry: puppeteerEntry, source_commit: '317c1aad0bc6d68e4f4d3c70863b481741a61fb5',
    cases, production_downloads: downloads, served: Object.fromEntries(served),
    external_requests_blocked: external, page_errors: pageErrors, fatal,
    baseline_negative: 'Both viewports lack draft Save/Open and reload erases authored fields. DOM JSON files are observation artifacts, not product downloads.',
    limits: 'Fresh isolated native Chromium contexts; no signed-in browser, provider, live payment or browser-storage use. No candidate qualification in this revision.'
  };
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
  process.exitCode = fatal || pageErrors.length ? 2 : 1;
}
