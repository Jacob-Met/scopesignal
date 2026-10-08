// Real local UI -> native JSON download -> existing file chooser and fresh review.
// Requires an existing Playwright module and Chromium; installs nothing.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const SOURCE = resolve(process.env.SCOPESIGNAL_SOURCE ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const OUT = resolve(process.env.SCOPESIGNAL_EVIDENCE ?? join(SOURCE, 'out/revision-draft-receiving'));
const MODE = process.env.SCOPESIGNAL_REVISION_MODE ?? 'candidate';
assert.ok(['baseline', 'candidate'].includes(MODE));
if (!process.env.SCOPESIGNAL_PLAYWRIGHT || !process.env.SCOPESIGNAL_CHROME) {
  throw new Error('Set SCOPESIGNAL_PLAYWRIGHT and SCOPESIGNAL_CHROME to existing installations.');
}
const { chromium } = await import(pathToFileURL(resolve(process.env.SCOPESIGNAL_PLAYWRIGHT)));
const hash = value => createHash('sha256').update(value).digest('hex');
const checks = [], failures = [], downloads = [], errors = [], external = [], served = new Map();
const draft = {
  label: '  Atelier Δ <original>  ',
  brief: 'Two fictional rooms\nKeep the original planned terms.  ',
  cap: ' 00100.0 ',
  checkpoints: [
    { title: '  Design & proof  ', amount: '00040.00', evidence: 'Original planned proof A\nSecond line  ' },
    { title: 'Delivery — room B', amount: ' 30.0 ', evidence: 'Original planned proof B' }
  ]
};
const revisionName = 'scopesignal-revision-draft-v1.json';
await mkdir(join(OUT, 'downloads'), { recursive: true });
const mime = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'scope.html';
    const path = resolve(SOURCE, relative);
    if (!path.startsWith(SOURCE + sep)) throw new Error('Outside source');
    const bytes = await readFile(path);
    served.set(relative, { bytes: bytes.length, sha256: hash(bytes) });
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
async function check(name, action) {
  await action();
  checks.push({ name, pass: true });
}
async function pageIn(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(origin + '/scope.html', { waitUntil: 'networkidle' });
  return page;
}
async function context(viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  return ctx;
}
async function enterTerms(page) {
  await page.locator('#scope-label').fill(draft.label);
  await page.locator('#scope-brief').fill(draft.brief);
  await page.locator('#scope-cap').fill(draft.cap);
  while (await page.locator('.scope-row').count() > 2) {
    await page.locator('button[data-remove]').last().click();
  }
  for (let index = 0; index < 2; index++) {
    for (const field of ['title', 'amount', 'evidence']) {
      await page.locator('#draft-' + index + '-' + field).fill(draft.checkpoints[index][field]);
    }
  }
}
async function reviewTerms(page) {
  await page.locator('#scope-form button[type=submit]').click();
  assert.equal(await page.locator('#scope-review').isVisible(), true);
}
async function act(page, id, action) {
  await page.locator('button[data-checkpoint="' + id + '"][data-action="' + action + '"]').click();
}
async function approveAndLose(page) {
  await page.locator('#review-evidence-scope-1').fill('Accepted result A; it is not the original planned text.');
  await act(page, 'scope-1', 'approve');
  await page.locator('#review-evidence-scope-2').fill('Pending result B; it is not approved or a planned term.');
  for (const action of ['order', 'request', 'lose']) await act(page, 'scope-1', action);
}
async function save(page, selector, name, keyboard = false) {
  const pending = page.waitForEvent('download');
  if (keyboard) { await page.locator(selector).focus(); await page.locator(selector).press('Enter'); }
  else await page.locator(selector).click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  const path = join(OUT, 'downloads', name);
  await download.saveAs(path);
  const bytes = await readFile(path);
  downloads.push({ name, suggested: download.suggestedFilename(), bytes: bytes.length, sha256: hash(bytes) });
  return { path, bytes, record: JSON.parse(bytes.toString('utf8')), suggested: download.suggestedFilename() };
}
async function choose(page, path) {
  const event = page.waitForEvent('filechooser');
  await page.locator('#scope-open').click();
  await (await event).setFiles(path);
  await page.locator('#scope-open-apply').waitFor({ state: 'visible' });
}
function freshRecord(file) {
  assert.equal(file.suggested, revisionName);
  assert.deepEqual(Object.keys(file.record).sort(), ['schema', 'version', 'fixtureOnly', 'paymentEvidence', 'stage', 'draft', 'events', 'evidenceDrafts'].sort());
  assert.equal(file.record.schema, 'scopesignal.scope-workspace');
  assert.equal(file.record.version, 1);
  assert.equal(file.record.fixtureOnly, true);
  assert.equal(file.record.paymentEvidence, false);
  assert.equal(file.record.stage, 'draft');
  assert.deepEqual(file.record.draft, draft);
  assert.deepEqual(file.record.events, []);
  assert.deepEqual(file.record.evidenceDrafts, []);
}
async function renderedState(page) {
  return page.evaluate(() => ({
    title: document.querySelector('#review-title').textContent,
    brief: document.querySelector('#review-brief').textContent,
    eventRows: document.querySelector('#scope-event-body').textContent,
    counts: ['scope-total', 'scope-approved', 'scope-captured', 'scope-remaining', 'scope-unallocated']
      .map(id => [id, document.getElementById(id).textContent]),
    evidence: [...document.querySelectorAll('[data-evidence]')].map(e => [e.id, e.value, e.readOnly]),
    actions: [...document.querySelectorAll('[data-action]')].map(e => [e.dataset.checkpoint, e.dataset.action, e.disabled]),
    editDisabled: document.querySelector('#scope-edit').disabled
  }));
}
try {
  browser = await chromium.launch({
    executablePath: process.env.SCOPESIGNAL_CHROME, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disk-cache-size=1048576', '--media-cache-size=1048576']
  });
  const desktop = await context({ width: 1280, height: 900 });
  const page = await pageIn(desktop);
  await enterTerms(page);
  if (MODE === 'candidate') assert.equal(await page.locator('#scope-revision-download').isDisabled(), true);
  else assert.equal(await page.locator('#scope-revision-download').count(), 0);
  await reviewTerms(page);
  if (MODE === 'candidate') assert.equal(await page.locator('#scope-revision-download').isDisabled(), true);
  await approveAndLose(page);
  const original = await save(page, '#scope-save', 'original-reviewed.json');
  assert.deepEqual(original.record.draft, draft);
  assert.equal(original.record.stage, 'review');
  assert.equal(original.record.events.length, 4);
  assert.equal(original.record.evidenceDrafts.length, 1);
  assert.equal(await page.locator('#scope-edit').isDisabled(), true);
  await check('original reviewed download retains locked terms, one approval, unknown capture and pending evidence', async () => {
    assert.equal(original.record.events.at(-1).type, 'paypal.capture.response_lost');
    assert.equal(original.record.evidenceDrafts[0].checkpointId, 'scope-2');
  });
  if (MODE === 'baseline') {
    await check('current product has no revision download and fresh fixture navigation replaces the authored terms', async () => {
      assert.equal(await page.locator('#scope-revision-download').count(), 0);
      await page.screenshot({ path: join(OUT, 'locked-baseline.png'), fullPage: true });
      const navigation = page.waitForEvent('domcontentloaded');
      await page.locator('#scope-review a[href="./scope.html"]').click();
      await navigation;
      await page.locator('#scope-label').waitFor({ state: 'visible' });
      assert.notEqual(await page.locator('#scope-label').inputValue(), draft.label);
      assert.equal(await page.locator('.scope-row').count(), 3);
      assert.equal(hash(await readFile(original.path)), hash(original.bytes));
    });
  } else {
    const before = await renderedState(page);
    let revision;
    await check('keyboard revision download retains exact planned terms and no approval, payment or review-evidence state', async () => {
      assert.equal(await page.locator('#scope-revision-download').isEnabled(), true);
      revision = await save(page, '#scope-revision-download', 'revision-draft.json', true);
      freshRecord(revision);
      assert.deepEqual(await renderedState(page), before);
      const after = await save(page, '#scope-save', 'original-after-revision.json');
      assert.deepEqual(after.bytes, original.bytes);
    });
    await check('actual file chooser reopens the revision as editable fields and requires a fresh explicit approval', async () => {
      const copy = await pageIn(desktop);
      await choose(copy, revision.path);
      assert.match(await copy.locator('#scope-open-summary').innerText(), /Editable draft.*0 recorded approvals.*0 events/);
      await copy.locator('#scope-open-apply').click();
      assert.equal(await copy.locator('#scope-form').isVisible(), true);
      assert.equal(await copy.locator('#scope-revision-download').isDisabled(), true);
      assert.equal(await copy.locator('#scope-label').inputValue(), draft.label);
      assert.equal(await copy.locator('#scope-cap').inputValue(), draft.cap);
      for (let i = 0; i < 2; i++) for (const f of ['title', 'amount', 'evidence']) {
        assert.equal(await copy.locator('#draft-' + i + '-' + f).inputValue(), draft.checkpoints[i][f]);
      }
      await copy.locator('#draft-0-title').fill('Revised deliverable — fresh decision');
      await reviewTerms(copy);
      assert.equal(await copy.locator('button[data-action=order]').count(), 0);
      assert.equal(await copy.locator('button[data-action=approve]').count(), 2);
      assert.equal(await copy.locator('#scope-revision-download').isDisabled(), true);
      await copy.locator('#review-evidence-scope-1').fill('Fresh approval only for this revised plan.');
      await act(copy, 'scope-1', 'approve');
      const saved = await save(copy, '#scope-save', 'newly-approved-revision.json');
      assert.equal(saved.record.events.length, 1);
      assert.equal(saved.record.events[0].type, 'checkpoint.approved');
      assert.equal(saved.record.events[0].acceptedEvidence, 'Fresh approval only for this revised plan.');
      assert.equal(saved.record.draft.checkpoints[0].title, 'Revised deliverable — fresh decision');
      assert.deepEqual(await renderedState(page), before);
      await copy.close();
    });
    await check('download leaves an admitted replacement preview and the complete original workspace intact', async () => {
      await choose(page, revision.path);
      const summary = await page.locator('#scope-open-summary').innerText();
      const saved = await save(page, '#scope-revision-download', 'with-preview.json');
      freshRecord(saved);
      assert.deepEqual(saved.bytes, revision.bytes);
      assert.equal(await page.locator('#scope-open-preview').isVisible(), true);
      assert.equal(await page.locator('#scope-open-summary').innerText(), summary);
      assert.equal(await page.locator('#scope-open-apply').isEnabled(), true);
      assert.deepEqual(await renderedState(page), before);
    });
    await check('preparation refusal preserves the source and pending preview, then ordinary retry succeeds', async () => {
      await page.evaluate(() => {
        window.revisionOriginalURL = URL.createObjectURL;
        URL.createObjectURL = () => { throw new Error('Synthetic revision URL refusal'); };
      });
      await page.locator('#scope-revision-download').click();
      assert.match(await page.locator('#scope-file-status').innerText(), /Could not prepare.*Synthetic revision URL refusal/);
      assert.equal(await page.locator('#scope-open-preview').isVisible(), true);
      assert.deepEqual(await renderedState(page), before);
      await page.evaluate(() => { URL.createObjectURL = window.revisionOriginalURL; delete window.revisionOriginalURL; });
      const retried = await save(page, '#scope-revision-download', 'after-url-refusal.json');
      assert.deepEqual(retried.bytes, revision.bytes);
    });
    await check('a link refusal removes its temporary anchor and revokes its URL without mutating the current review', async () => {
      await page.evaluate(() => {
        window.revisionFailure = {
          click: HTMLAnchorElement.prototype.click, create: URL.createObjectURL, revoke: URL.revokeObjectURL,
          allocated: null, revoked: []
        };
        URL.createObjectURL = blob => {
          const url = window.revisionFailure.create.call(URL, blob);
          window.revisionFailure.allocated = url; return url;
        };
        URL.revokeObjectURL = url => { window.revisionFailure.revoked.push(url); window.revisionFailure.revoke.call(URL, url); };
        HTMLAnchorElement.prototype.click = function () {
          if (this.download === 'scopesignal-revision-draft-v1.json') throw new Error('Synthetic revision link refusal');
          return window.revisionFailure.click.call(this);
        };
      });
      await page.locator('#scope-revision-download').click();
      assert.match(await page.locator('#scope-file-status').innerText(), /Synthetic revision link refusal/);
      assert.equal(await page.locator('a[download]').count(), 0);
      await page.waitForFunction(() => window.revisionFailure.revoked.includes(window.revisionFailure.allocated));
      assert.deepEqual(await renderedState(page), before);
      assert.equal(await page.locator('#scope-open-preview').isVisible(), true);
      await page.evaluate(() => {
        HTMLAnchorElement.prototype.click = window.revisionFailure.click;
        URL.createObjectURL = window.revisionFailure.create;
        URL.revokeObjectURL = window.revisionFailure.revoke;
        delete window.revisionFailure;
      });
      const saved = await save(page, '#scope-revision-download', 'after-link-refusal.json');
      assert.deepEqual(saved.bytes, revision.bytes);
      await page.locator('#scope-open-cancel').click();
      const after = await save(page, '#scope-save', 'original-after-failures.json');
      assert.deepEqual(after.bytes, original.bytes);
      await page.screenshot({ path: join(OUT, 'desktop-revision.png'), fullPage: true });
    });
    await check('390px phone control is keyboard-operable without overflow and downloads the same unapproved terms', async () => {
      const phone = await context({ width: 390, height: 844 });
      const narrow = await pageIn(phone);
      await enterTerms(narrow); await reviewTerms(narrow); await approveAndLose(narrow);
      await narrow.locator('#scope-revision-download').scrollIntoViewIfNeeded();
      const geometry = await narrow.locator('#scope-revision-download').evaluate(button => {
        const box = button.getBoundingClientRect();
        return { x: box.x, right: box.right, width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      assert.ok(geometry.x >= 0 && geometry.right <= geometry.width && geometry.overflow <= 1, JSON.stringify(geometry));
      const saved = await save(narrow, '#scope-revision-download', 'phone-revision.json', true);
      freshRecord(saved); assert.deepEqual(saved.bytes, revision.bytes);
      assert.equal(await narrow.evaluate(() => document.activeElement.id), 'scope-revision-download');
      await narrow.screenshot({ path: join(OUT, 'phone-revision.png'), fullPage: true });
      await phone.close();
    });
  }
  assert.deepEqual(errors, []);
} catch (error) {
  failures.push({ message: error.message, stack: error.stack });
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
  const receipt = {
    mode: MODE, source: SOURCE, output: OUT, node: process.version,
    browserExecutable: process.env.SCOPESIGNAL_CHROME, playwrightModule: process.env.SCOPESIGNAL_PLAYWRIGHT,
    checks, failures, pageErrors: errors, blockedExternalRequests: external,
    served: Object.fromEntries([...served].sort()), downloads,
    harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    fictionalInputsOnly: true, providerCalls: false
  };
  await writeFile(join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ mode: MODE, passed: checks.length, failed: failures.length, failures,
    downloads: downloads.length, receipt: join(OUT, 'receipt.json') }));
}
