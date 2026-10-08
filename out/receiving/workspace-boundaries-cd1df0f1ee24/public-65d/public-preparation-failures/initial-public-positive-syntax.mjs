// Bounded public receiving derived from two previously frozen positive criteria.
// Expected outcomes use literal file values and observed DOM, never app imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.SCOPESIGNAL_PUPPETEER);
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE);
const manifest = JSON.parse(await readFile(process.env.SCOPESIGNAL_MANIFEST, 'utf8'));
const pins = new Map(manifest.files.map(f => [f.path, f]));
const base = new URL(process.env.SCOPESIGNAL_PUBLIC_URL);
const expectedCommit = process.env.SCOPESIGNAL_EXPECTED_COMMIT;
const release = JSON.parse(await readFile(process.env.SCOPESIGNAL_RELEASE_RECEIPT, 'utf8'));
assert.equal(base.href, 'https://jacobmetoyer.com/scopesignal/');
assert.match(expectedCommit ?? '', /^[0-9a-f]{40}$/);
assert.equal(manifest.commit, expectedCommit);
assert.match(manifest.tree ?? '', /^[0-9a-f]{40}$/);
assert.equal(release.commit, expectedCommit);
assert.equal(release.pages.head_sha, expectedCommit);
assert.equal(release.pages.status, 'completed');
assert.equal(release.pages.conclusion, 'success');
assert.equal(release.deployed_runtime_preflight.passed, true);
assert.equal(release.deployed_runtime_preflight.commit, expectedCommit);
assert.ok(release.baseline_release_custody?.source, 'Baseline release custody must be recorded');
function assetPath(url) {
  const value = new URL(url);
  return value.origin === base.origin && value.pathname.startsWith(base.pathname)
    ? value.pathname.slice(base.pathname.length) : null;
}
const hash = data => createHash('sha256').update(data).digest('hex');
const blob = data => createHash('sha1').update(Buffer.from('blob ' + data.length + '\0')).update(data).digest('hex');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(output, 'private-browser-profile-'));
const cases = [], blocked = [], pageErrors = [], responses = [], responseErrors = [], responsePromises = [];
let browser, fatal = null;

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
  await page.$eval(selector, (node, next) => {
    node.value = next;
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function state(page) {
  return { draft: await draft(page), ...await page.evaluate(() => ({
    preview: !document.querySelector('#scope-open-preview').hidden,
    status: document.querySelector('#scope-file-status').textContent,
    summary: document.querySelector('#scope-open-summary').textContent,
    review_visible: !document.querySelector('#scope-review').hidden,
    event_count: document.querySelector('#scope-event-count').textContent
  })) };
}
async function fresh(page) {
  await page.goto(new URL('scope.html', base).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#draft-0-title');
  await Promise.all(responsePromises);
  assert.deepEqual(responseErrors, [], 'Public runtime bytes must match the deployed commit before app actions');
}
async function chooser(page) {
  const pending = page.waitForFileChooser({ timeout: 5000 });
  await page.click('#scope-open');
  return pending;
}
async function settled(page) {
  await page.waitForFunction(() => {
    const status = document.querySelector('#scope-file-status').textContent;
    return !document.querySelector('#scope-open-preview').hidden ||
      (/Could not open|workspace changed|Opening canceled|choose.*again/i.test(status) && !/^Reading/.test(status));
  }, { timeout: 5000 });
}
async function download(page, name) {
  const directory = join(output, name);
  await mkdir(directory, { recursive: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
  await page.click('#scope-save');
  const path = join(directory, 'scopesignal-workspace-v1.json');
  let bytes;
  for (let n = 0; n < 100; n++) {
    try { bytes = await readFile(path); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.ok(bytes, 'Actual Chromium workspace download completes');
  await cdp.detach();
  return { path, file: JSON.parse(bytes), bytes: bytes.length, sha256: hash(bytes) };
}
async function run(name, work) {
  const observation = { name, started_at: new Date().toISOString() };
  try { await work(observation); observation.passed = true; }
  catch (error) { observation.passed = false; observation.error = error.message; observation.stack = error.stack; }
  cases.push(observation);
  await writeFile(join(output, name + '.json'), JSON.stringify(observation, null, 2) + '\n');
  console.log(JSON.stringify({ name, passed: observation.passed, error: observation.error }));
}
try {
  browser = await puppeteer.launch({
    headless: true, userDataDir: profile, executablePath: process.env.SCOPESIGNAL_CHROME,
    args: ['--disable-background-networking', '--no-first-run', '--no-default-browser-check']
  });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.setCacheEnabled(false);
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return request.continue();
    const path = assetPath(url);
    if (path && pins.has(path) && /\.(html|mjs|css)$/.test(path) && request.method() === 'GET') return request.continue();
    blocked.push({ url, method: request.method(), body: request.postData() ?? null, resource_type: request.resourceType() });
    return request.abort();
  });
  page.on('response', response => {
    const path = assetPath(response.url());
    if (!path || !pins.has(path)) return;
    responsePromises.push((async () => {
      try {
        const bytes = await response.buffer(), expected = pins.get(path);
        const actual = { path, status: response.status(), bytes: bytes.length, sha256: hash(bytes), git_blob: blob(bytes) };
        responses.push(actual);
        assert.equal(actual.status, 200);
        assert.equal(actual.sha256, expected.sha256);
        assert.equal(actual.git_blob, expected.sha ?? expected.git_blob);
      } catch (error) { responseErrors.push({ path, error: error.message }); }
    })());
  });

  await run('lf-unicode-download-roundtrip', async observation => {
    await fresh(page);
    const initial = await draft(page);
    await fill(page, '#scope-label', '  Fictional workspace 日本語 😀  ');
    await fill(page, '#scope-brief', '\nLF first line α\nLF second line 😀\n');
    await fill(page, '#scope-cap', 'unfinished');
    await fill(page, '#draft-0-title', '');
    await fill(page, '#draft-0-evidence', '\nLiteral <evidence> & “quotes”\n');
    observation.authored = await draft(page);
    observation.download = await download(page, 'positive-download');
    assert.equal(observation.download.file.schema, 'scopesignal.scope-workspace');
    assert.equal(observation.download.file.stage, 'draft');
    assert.deepEqual(observation.download.file.draft, observation.authored);
    await fresh(page);
    assert.deepEqual(await draft(page), initial);
    await (await chooser(page)).accept([observation.download.path]);
    await settled(page);
    observation.preview = await state(page);
    assert.equal(observation.preview.preview, true);
    assert.deepEqual(observation.preview.draft, initial, 'Preview preserves current draft');
    await page.click('#scope-open-apply');
    observation.applied = await state(page);
    assert.deepEqual(observation.applied.draft, observation.authored, 'Native LF and Unicode strings round trip exactly');
    assert.equal(observation.applied.review_visible, false);
    assert.equal(observation.applied.event_count, '0 events');
    await page.screenshot({ path: join(output, 'public-draft-reopened.png'), fullPage: true });
  });

  await run('review-history-download-roundtrip', async observation => {
    await fresh(page);
    await page.click('#scope-form button[type="submit"]');
    await page.waitForSelector('#review-evidence-scope-1');
    const accepted = 'Accepted fictional evidence α\nNative reviewed proof 😀';
    const pending = '\nPending human review 日本語\nLiteral <draft> & “quotes”\n';
    await fill(page, '#review-evidence-scope-1', accepted);
    await fill(page, '#review-evidence-scope-2', pending);
    await fill(page, '#review-evidence-scope-3', '');
    for (const action of ['approve', 'order', 'request', 'lose']) {
      await page.click('button[data-checkpoint="scope-1"][data-action="' + action + '"]');
    }
    async function reviewedState() {
      return page.evaluate(() => ({
        visible: !document.querySelector('#scope-review').hidden,
        title: document.querySelector('#review-title').textContent,
        brief: document.querySelector('#review-brief').textContent,
        approved: document.querySelector('#scope-approved').textContent,
        captured: document.querySelector('#scope-captured').textContent,
        remaining: document.querySelector('#scope-remaining').textContent,
        count: document.querySelector('#scope-event-count').textContent,
        edit_disabled: document.querySelector('#scope-edit').disabled,
        events: [...document.querySelectorAll('#scope-event-body tr')].map(row => [...row.cells].map(cell => cell.textContent)),
        checkpoints: [...document.querySelectorAll('.scope-review-card')].map(card => ({
          id: card.dataset.checkpoint,
          evidence: card.querySelector('textarea').value,
          read_only: card.querySelector('textarea').readOnly,
          status: card.querySelector('.scope-review-state').textContent,
          actions: [...card.querySelectorAll('button[data-action]')].map(button => ({ action: button.dataset.action, disabled: button.disabled }))
        }))
      }));
    }
    observation.before_download = await reviewedState();
    assert.equal(observation.before_download.count, '4 events');
    assert.equal(observation.before_download.approved, '1 / 3');
    assert.equal(observation.before_download.captured, '$0.00');
    assert.equal(observation.before_download.edit_disabled, true);
    assert.equal(observation.before_download.checkpoints[0].evidence, accepted);
    assert.equal(observation.before_download.checkpoints[0].read_only, true);
    assert.equal(observation.before_download.checkpoints[1].evidence, pending);
    assert.equal(observation.before_download.checkpoints[2].evidence, '');
    assert.ok(observation.before_download.checkpoints[0].actions.some(action => action.action === 'reconcile'));
    assert.ok(!observation.before_download.checkpoints[0].actions.some(action => action.action === 'request'));
    observation.download = await download(page, 'review-download');
    assert.equal(observation.download.file.schema, 'scopesignal.scope-workspace');
    assert.equal(observation.download.file.stage, 'review');
    assert.deepEqual(observation.download.file.events.map(event => event.type), [
      'checkpoint.approved', 'paypal.order.created', 'paypal.capture.requested', 'paypal.capture.response_lost'
    ]);
    assert.equal(observation.download.file.events[0].acceptedEvidence, accepted);
    assert.deepEqual(observation.download.file.evidenceDrafts, [
      { checkpointId: 'scope-2', text: pending }, { checkpointId: 'scope-3', text: '' }
    ]);
    await fresh(page);
    observation.fresh_before_open = await state(page);
    assert.equal(observation.fresh_before_open.review_visible, false);
    await (await chooser(page)).accept([observation.download.path]);
    await settled(page);
    observation.preview = await state(page);
    assert.equal(observation.preview.preview, true);
    assert.deepEqual(observation.preview.draft, observation.fresh_before_open.draft);
    assert.equal(observation.preview.review_visible, false);
    assert.ok(observation.preview.summary.includes('Reviewed fixture'));
    assert.ok(observation.preview.summary.includes('1 recorded approvals'));
    assert.ok(observation.preview.summary.includes('4 events'));
    await page.click('#scope-open-apply');
    observation.after_open = await reviewedState();
    assert.deepEqual(observation.after_open, observation.before_download,
      'Explicit workspace reopening preserves accepted evidence, pending evidence, canonical history, lock and unknown capture presentation');
    observation.redownload = await download(page, 'review-redownload');
    assert.deepEqual(observation.redownload.file, observation.download.file,
      'The actual reopened reviewed-workspace download is semantically identical');
    await page.screenshot({ path: join(output, 'reviewed-history-reopened.png'), fullPage: true });
  });
  await Promise.all(responsePromises);
  assert.deepEqual(responseErrors, [], 'All runtime responses match exact source pins');
  assert.deepEqual(pageErrors, [], 'No application JavaScript errors');
} catch (error) {
  fatal = { error: error.message, stack: error.stack };
} finally {
  const browserVersion = browser ? await browser.version() : null;
  if (browser) await browser.close();
  await rm(profile, { recursive: true, force: true });
  const result = {
    captured_at: new Date().toISOString(), mode: 'public-route', source_commit: manifest.commit, source_tree: manifest.tree, public_url: base.href,
    release_gate: release, expected_commit: expectedCommit,
    browser: browserVersion, node: process.version, viewport: { width: 1440, height: 1000 },
    passed: !fatal && cases.length === 2 && cases.every(item => item.passed),
    counts: { passed: cases.filter(item => item.passed).length, failed: cases.filter(item => !item.passed).length },
    cases, fatal, responses, response_errors: responseErrors, page_errors: pageErrors, blocked,
    limits: 'Two bounded public positives reuse previously frozen LF/Unicode draft and reviewed-history criteria. Actual native downloads and file selection use a fresh isolated Chromium profile with normal TLS. Pages exact-commit success and normal-TLS served-byte preflight are required before browser execution; every runtime response is independently pinned again before app actions. This does not rerun the original owner's baseline release or the two unchanged source-boundary negatives. No source, installed-state, payment/provider, GitHub or deployment mutation.'
  };
  await writeFile(join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, counts: result.counts, fatal }));
  process.exitCode = result.passed ? 0 : 1;
}
