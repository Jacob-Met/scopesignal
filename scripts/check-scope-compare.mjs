// Optional native browser receiver. Reuses an existing Playwright and Chromium;
// no dependencies are installed and only this run's source/fixture paths are used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, lstat, rm } from 'node:fs/promises';
import { resolve, extname, sep, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const output = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/receiving/scope-compare');
const baseline = process.env.SCOPESIGNAL_BASELINE ? resolve(process.env.SCOPESIGNAL_BASELINE) : null;
const profile = process.env.SCOPESIGNAL_PROFILE ? resolve(process.env.SCOPESIGNAL_PROFILE) : resolve(output, 'browser-profile');
const { chromium } = await import(process.env.SCOPESIGNAL_PLAYWRIGHT
  ? pathToFileURL(process.env.SCOPESIGNAL_PLAYWRIGHT).href : 'playwright');
const { draftFromFixture, createScopeReview } = await import(pathToFileURL(resolve(root, 'src/scope-plan.mjs')).href);
const { encodeScopeWorkspace, decodeScopeWorkspace } = await import(pathToFileURL(resolve(root, 'src/scope-workspace-record.mjs')).href);
const checks = [], failures = [], pageErrors = [], externalRequests = [], served = new Map();
const launchArgs = ['--disk-cache-size=1048576'];
if (process.env.SCOPESIGNAL_RECEIVER_RESOURCE_LIMITS === '1') {
  launchArgs.push('--renderer-process-limit=1', '--num-raster-threads=1');
}
const fixtures = resolve(output, 'fixtures');
const browserDownloads = resolve(output, 'browser-downloads');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['scope.html', 'scope-compare.html', 'scope-compare.css',
  'src/scope-compare.mjs', 'src/scope-compare-ui.mjs', 'src/scope-workspace-record.mjs',
  'src/scope-workspace.mjs', 'src/scope-plan.mjs', 'src/ledger.mjs'];
const sourceBefore = Object.fromEntries(await Promise.all(sourcePaths.map(async path =>
  [path, sha(await readFile(resolve(root, path)))])));
try {
  await lstat(profile);
  throw new Error('Receiver profile must be a new dedicated directory: ' + profile);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(fixtures, { recursive: true });
await mkdir(browserDownloads, { recursive: true });
const fixtureHashes = {};
async function fixture(name, contents) {
  const path = resolve(fixtures, name);
  await writeFile(path, contents);
  fixtureHashes[name] = sha(await readFile(path));
  return path;
}
const freshDraft = () => structuredClone(draftFromFixture());
async function saved(name, draft = freshDraft(), actions = null, pending = new Map()) {
  const review = actions === null ? null : createScopeReview(draft);
  for (const [id, action, evidence] of actions ?? []) review.act(id, action, evidence);
  return fixture(name, encodeScopeWorkspace({ draft, review, evidenceDrafts: pending }));
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const isBaseline = url.pathname.startsWith('/baseline/') && baseline;
    const base = isBaseline ? baseline : root;
    const pathname = isBaseline ? url.pathname.slice('/baseline'.length) : url.pathname;
    const file = resolve(base, '.' + (pathname === '/' ? '/scope.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(base + sep)) throw new Error('Outside source');
    const bytes = await readFile(file);
    served.set((isBaseline ? 'baseline/' : '') + file.slice(base.length + 1), sha(bytes));
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
let context, page, author, browserVersion = null;
async function check(name, run) {
  console.log('START ' + name);
  await run();
  checks.push({ name, result: 'pass' });
  console.log('PASS ' + name);
}
const text = async selector => page.locator(selector).innerText();
const total = (field, side) => text('#totals tr[data-field="' + field + '"] td[data-side="' + side + '"]');
const field = (pair, key, side) => text('[data-pair="' + pair + '"] tr[data-field="' + key + '"] td[data-side="' + side + '"]');
const history = () => page.locator('#history-summary').getAttribute('data-relationship');
async function opened(side, path) {
  await page.locator('#file-' + side).setInputFiles(path);
  await page.waitForFunction(({ side, name }) =>
    document.querySelector('#status-' + side).textContent.startsWith('Opened ' + name + '.'),
  { side, name: basename(path) });
}
async function refused(side, path) {
  await page.locator('#file-' + side).setInputFiles(path);
  await page.waitForFunction(({ side, name }) =>
    document.querySelector('#status-' + side).textContent.startsWith('Could not open ' + name + '.'),
  { side, name: basename(path) });
}
async function visibleState() {
  return page.evaluate(() => ({
    a: document.querySelector('#name-a').textContent,
    b: document.querySelector('#name-b').textContent,
    content: document.querySelector('#comparison').innerText,
    choices: [...document.querySelectorAll('#pair-controls select')].map(node => [node.id, node.value])
  }));
}
async function authorState() {
  return author.evaluate(() => ({
    label: document.querySelector('#scope-label').value,
    brief: document.querySelector('#scope-brief').value,
    evidence: [...document.querySelectorAll('[id^="review-evidence-"]')].map(node => [node.id, node.value, node.readOnly]),
    events: document.querySelector('#scope-event-body').innerText,
    captured: document.querySelector('#scope-captured').innerText,
    eventCount: document.querySelector('#scope-event-count').innerText
  }));
}
const accepted = 'Accepted A\n<literal> & “quoted” 雪';
const pending = 'Pending second\n<img id="compare-injected" src=x onerror="globalThis.compareInjected=true">';
let beforeAuthor, fileA, fileB;
try {
  console.log('START isolated Chromium launch');
  context = await chromium.launchPersistentContext(profile, {
    timeout: 30000,
    headless: true, chromiumSandbox: true, acceptDownloads: true,
    downloadsPath: browserDownloads,
    executablePath: process.env.SCOPESIGNAL_CHROME || undefined,
    viewport: { width: 1360, height: 1000 },
    args: launchArgs
  });
  browserVersion = context.browser()?.version() ?? null;
  await context.route('**/*', route => {
    const url = route.request().url();
    if (new URL(url).origin === origin) return route.continue();
    externalRequests.push({ url, frame: route.request().frame().url() });
    return route.abort();
  });
  context.on('page', tab => {
    tab.setDefaultTimeout(6000);
    tab.on('pageerror', error => pageErrors.push({ url: tab.url(), message: error.message }));
  });
  if (baseline) await check('parent has one-file replacement and no two-file comparison entry', async () => {
    const tab = await context.newPage();
    await tab.goto(origin + '/baseline/scope.html');
    await tab.locator('#draft-0-title').waitFor();
    assert.equal(await tab.locator('input[type="file"]').count(), 1);
    assert.equal(await tab.locator('a[href="./scope-compare.html"]').count(), 0);
    assert.match(await tab.locator('#scope-open-preview').textContent(), /Replace workspace/);
    const result = await tab.request.get(origin + '/baseline/scope-compare.html');
    assert.equal(result.status(), 404);
    await tab.close();
  });
  await check('actual authoring downloads preserve unknown and reconciled saved states', async () => {
    author = await context.newPage();
    await author.goto(origin + '/scope.html');
    await author.getByRole('button', { name: 'Review this scope', exact: true }).click();
    await author.locator('#review-evidence-scope-2').fill(pending);
    await author.locator('#review-evidence-scope-1').fill(accepted);
    const action = value => author.locator('button[data-checkpoint="scope-1"][data-action="' + value + '"]').click();
    for (const value of ['approve', 'order', 'request', 'lose']) await action(value);
    assert.equal(await author.locator('#scope-event-count').innerText(), '4 events');
    assert.equal(await author.locator('#scope-captured').innerText(), '$0.00');
    const save = async name => {
      const event = author.waitForEvent('download');
      await author.locator('#scope-save').click();
      const download = await event;
      assert.equal(download.suggestedFilename(), 'scopesignal-workspace-v1.json');
      const path = resolve(fixtures, name);
      await download.saveAs(path);
      assert.equal(await download.failure(), null);
      fixtureHashes[name] = sha(await readFile(path));
      return path;
    };
    fileA = await save('download-unknown-A.json');
    for (const value of ['receipt', 'duplicate', 'reconcile']) await action(value);
    assert.equal(await author.locator('#scope-event-count').innerText(), '7 events');
    assert.equal(await author.locator('#scope-captured').innerText(), '$400.00');
    fileB = await save('download-reconciled-B.json');
    const a = decodeScopeWorkspace(await readFile(fileA, 'utf8'));
    const b = decodeScopeWorkspace(await readFile(fileB, 'utf8'));
    assert.equal(a.review.snapshot().events.length, 4);
    assert.equal(b.review.snapshot().events.length, 7);
    assert.equal(a.review.snapshot().captured, 0);
    assert.equal(b.review.snapshot().captured, 40000);
    assert.equal(a.evidenceDrafts.get('scope-2'), pending);
    beforeAuthor = await authorState();
    const popup = context.waitForEvent('page');
    await author.locator('a[href="./scope-compare.html"]').click();
    page = await popup;
    await page.locator('#file-a').waitFor();
    assert.equal(await page.evaluate(() => window.opener), null);
  });
  await check('two real saved files expose exact accepted, pending, unknown and captured values', async () => {
    await opened('a', fileA);
    assert.equal(await page.locator('#comparison').isVisible(), false);
    await opened('b', fileB);
    assert.equal(await history(), 'a-prefix');
    assert.equal(await total('captured', 'a'), '$0.00');
    assert.equal(await total('captured', 'b'), '$400.00');
    assert.equal(await field('0-0', 'acceptedEvidence', 'a'), accepted);
    assert.equal(await field('1-1', 'pendingEvidence', 'b'), pending);
    assert.equal(await field('0-0', 'captureStatus', 'a'), 'unknown');
    assert.equal(await page.locator('#events-a .event-list > details').count(), 4);
    assert.equal(await page.locator('#events-b .event-list > details').count(), 7);
    assert.equal(await page.locator('#compare-injected').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.compareInjected), undefined);
    await page.screenshot({ path: resolve(output, 'desktop-files.png') });
    await page.locator('#project-title').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, 'desktop-amounts.png') });
  });
  await check('side swap retains the chosen pairs and reverses event-prefix direction', async () => {
    await page.locator('#swap').click();
    assert.equal(await history(), 'b-prefix');
    assert.equal(await total('captured', 'a'), '$400.00');
    assert.equal(await page.locator('#pair-0').inputValue(), '0');
    assert.deepEqual(await authorState(), beforeAuthor);
    await page.locator('#swap').click();
  });
  await check('same-plan divergent facts and different plans remain distinct', async () => {
    const divergent = await saved('divergent.json', freshDraft(), [['scope-1', 'approve', 'Different accepted fact']]);
    await opened('b', divergent);
    assert.equal(await history(), 'divergent');
    assert.match(await text('#history-summary'), /after 0 matching events/);
    assert.equal(await field('0-0', 'acceptedEvidence', 'b'), 'Different accepted fact');
    const changed = freshDraft(); changed.checkpoints[0].title = 'A different first deliverable';
    const other = await saved('different-plan.json', changed, [['scope-1', 'approve', accepted]]);
    await opened('b', other);
    assert.equal(await history(), 'different-plans');
    assert.equal(await page.locator('#pair-0').inputValue(), '');
    await page.locator('#pair-0').selectOption('0');
    assert.equal(await history(), 'different-plans');
    assert.match(await text('[data-pair="0-0"] h4'), /Paired for review/);
  });
  await check('unique exact definitions follow reordered rows while inserted rows stay unpaired', async () => {
    const draft = await saved('original-draft.json');
    const revised = freshDraft();
    revised.checkpoints.reverse();
    revised.checkpoints.splice(1, 0, { title: 'Added review item', amount: '25.00', evidence: 'New proof' });
    await opened('a', draft);
    await opened('b', await saved('reordered-inserted.json', revised));
    assert.equal(await history(), 'not-reviewed');
    assert.deepEqual(await page.locator('#pair-controls select').evaluateAll(nodes => nodes.map(node => node.value)), ['3', '2', '0']);
    assert.equal(await page.locator('[data-unpaired="b-1"]').count(), 1);
    assert.match(await text('[data-unpaired="b-1"]'), /no addition or removal is inferred/);
    assert.equal(await page.locator('.definition-tag').filter({ hasText: 'Same definition' }).count(), 3);
    await page.locator('#changes-only').check();
    assert.equal(await page.locator('.pair-card').count(), 3);
    await page.locator('#changes-only').uncheck();
  });
  await check('duplicate definitions require explicit one-to-one keyboard pairing', async () => {
    const duplicate = freshDraft();
    duplicate.checkpoints = [structuredClone(duplicate.checkpoints[0]), structuredClone(duplicate.checkpoints[0])];
    const path = await saved('duplicate-definitions.json', duplicate);
    await opened('a', path); await opened('b', path);
    assert.deepEqual(await page.locator('#pair-controls select').evaluateAll(nodes => nodes.map(node => node.value)), ['', '']);
    await page.locator('#pair-0').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#pair-0').inputValue(), '0');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'pair-0');
    assert.equal(await page.locator('#pair-1 option[value="0"]').isDisabled(), true);
    await page.locator('#pair-0').selectOption('');
    await page.locator('#pair-0').selectOption('1');
    await page.locator('#swap').click();
    assert.deepEqual(await page.locator('#pair-controls select').evaluateAll(nodes => nodes.map(node => node.value)), ['', '0']);
    assert.match(await text('#pair-summary'), /1 pairs.*1 unpaired in A.*1 unpaired in B/);
  });
  await check('invalid version, inconsistent replay, UTF-8 and oversized files retain both files and pairing', async () => {
    const held = await visibleState();
    const unsupported = JSON.parse(await readFile(fileB, 'utf8')); unsupported.version = 2;
    const inconsistent = JSON.parse(await readFile(fileB, 'utf8')); inconsistent.events[0].seq = 2;
    const paths = [
      await fixture('unsupported.json', JSON.stringify(unsupported)),
      await fixture('inconsistent.json', JSON.stringify(inconsistent)),
      await fixture('invalid-utf8.json', Buffer.from([0xff, 0xfe, 0x7b])),
      await fixture('oversized.json', Buffer.alloc(1024 * 1024 + 1, 0x20))
    ];
    for (const path of paths) {
      await refused('a', path);
      assert.deepEqual(await visibleState(), held);
    }
    await page.evaluate(() => {
      const original = File.prototype.arrayBuffer;
      globalThis.receiverDeferred = {};
      File.prototype.arrayBuffer = function () {
        if (this.name === 'read-error.json') return Promise.reject(new Error('Receiver-authored file read failure'));
        const actualBytes = original.call(this);
        if (!this.name.startsWith('slow-')) return actualBytes;
        return new Promise((resolve, reject) => {
          globalThis.receiverDeferred[this.name] = () => actualBytes.then(resolve, reject);
        });
      };
    });
    const readError = await fixture('read-error.json', await readFile(fileA));
    await refused('b', readError);
    assert.deepEqual(await visibleState(), held);
  });
  await check('current native field admission rejects lossy line breaks and accepts CRLF JSON formatting', async () => {
    const held = await visibleState();
    const source = await readFile(fileA, 'utf8');
    const invalid = [
      record => { record.draft.brief = 'First\rSecond'; },
      record => { record.draft.label = 'First\nSecond'; },
      record => { record.evidenceDrafts = [{ checkpointId: 'scope-2', text: 'Pending\rtext' }]; }
    ];
    for (const [index, mutate] of invalid.entries()) {
      const record = JSON.parse(source); mutate(record);
      await refused('a', await fixture('native-line-refusal-' + index + '.json', JSON.stringify(record)));
      assert.deepEqual(await visibleState(), held);
    }
    const formatted = await fixture('crlf-json-format.json', source.replaceAll('\n', '\r\n'));
    await opened('a', formatted); await opened('b', fileB);
    assert.equal(await history(), 'a-prefix');
    assert.equal(await field('0-0', 'acceptedEvidence', 'a'), accepted);
    assert.equal(await field('1-1', 'pendingEvidence', 'a'), pending);
  });
  const defer = async (side, name, from) => {
    const path = await fixture(name, await readFile(from));
    await page.locator('#file-' + side).setInputFiles(path);
    await page.waitForFunction(name => Boolean(globalThis.receiverDeferred[name]), name);
  };
  const release = name => page.evaluate(name => globalThis.receiverDeferred[name](), name);
  await check('a slower prior selection cannot replace a newer file on the same side', async () => {
    await defer('a', 'slow-old-A.json', fileA);
    await opened('a', fileB);
    const held = await visibleState();
    await release('slow-old-A.json');
    await page.waitForTimeout(30);
    assert.deepEqual(await visibleState(), held);
  });
  await check('simultaneous A and B reads have independent ownership', async () => {
    await defer('a', 'slow-independent-A.json', fileA);
    await defer('b', 'slow-independent-B.json', fileB);
    await release('slow-independent-B.json');
    await page.waitForFunction(() => document.querySelector('#name-b').textContent === 'slow-independent-B.json');
    await release('slow-independent-A.json');
    await page.waitForFunction(() => document.querySelector('#name-a').textContent === 'slow-independent-A.json');
    assert.equal(await history(), 'a-prefix');
    assert.equal(await total('captured', 'a'), '$0.00');
    assert.equal(await total('captured', 'b'), '$400.00');
  });
  await check('clear cancels an initial pending read without changing the other file', async () => {
    await page.locator('#clear-a').click();
    const other = await text('#name-b');
    await defer('a', 'slow-empty-A.json', fileA);
    assert.equal(await page.locator('#clear-a').isEnabled(), true);
    await page.locator('#clear-a').click();
    await release('slow-empty-A.json');
    await page.waitForTimeout(30);
    assert.equal(await text('#name-a'), 'No file opened');
    assert.equal(await text('#name-b'), other);
    assert.equal(await page.locator('#comparison').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'file-a');
    await opened('a', fileA);
  });
  await check('swap and a newer file-chooser intent cancel older pending reads', async () => {
    await defer('a', 'slow-swap-A.json', fileB);
    await defer('b', 'slow-swap-B.json', fileA);
    await page.locator('#swap').click();
    const swapped = await visibleState();
    await release('slow-swap-A.json'); await release('slow-swap-B.json');
    await page.waitForTimeout(30);
    assert.deepEqual(await visibleState(), swapped);
    await defer('a', 'slow-chooser-A.json', fileA);
    const choose = page.waitForEvent('filechooser');
    await page.locator('#file-a').click();
    const chooser = await choose;
    await chooser.setFiles([]);
    await release('slow-chooser-A.json');
    await page.waitForTimeout(30);
    assert.deepEqual(await visibleState(), swapped);
  });
  await check('literal draft text, unavailable amounts and empty strings remain readable', async () => {
    const draft = freshDraft();
    draft.label = ''; draft.cap = 'not decided';
    draft.brief = '<img id="compare-injected" src=x onerror="globalThis.compareInjected=true">\n雪 & “text”';
    draft.checkpoints[0].amount = '';
    const path = await saved('unfinished-draft.json', draft);
    await opened('a', path); await opened('b', fileB);
    assert.equal(await total('cap', 'a'), 'Not available');
    assert.equal(await total('captured', 'a'), 'Not available');
    assert.equal(await text('#project-fields tr[data-field="label"] td[data-side="a"]'), '(empty text)');
    assert.equal(await text('#project-fields tr[data-field="brief"] td[data-side="a"]'), draft.brief);
    assert.equal(await page.locator('#compare-injected').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.compareInjected), undefined);
  });
  await check('desktop and phone comparisons fit the viewport and retain keyboard controls', async () => {
    await opened('a', fileA); await opened('b', fileB);
    await page.locator('#changes-only').check();
    assert.equal(await page.locator('#paired-rows .pair-card').count(), 1);
    assert.equal(await field('0-0', 'captureStatus', 'a'), 'unknown');
    await page.locator('#changes-only').uncheck();
    for (const [label, viewport] of [['desktop', { width: 1360, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(size.document <= size.viewport + 1, JSON.stringify({ label, ...size }));
      await page.locator('#pairing-title').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(output, label + '-pairing.png') });
      await page.locator('#reset-pairs').focus();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-pairs');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#pair-0').inputValue(), '0');
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, 'phone-files.png') });
  });
  await check('the original authoring tab and served runtime remain unchanged', async () => {
    assert.deepEqual(await authorState(), beforeAuthor);
    assert.deepEqual(pageErrors, []);
    const comparisonExternal = externalRequests.filter(request => new URL(request.frame).pathname === '/scope-compare.html');
    assert.deepEqual(comparisonExternal, []);
    assert(externalRequests.every(request => request.url.startsWith('https://fonts.googleapis.com/')));
    for (const path of sourcePaths) assert.equal(sha(await readFile(resolve(root, path))), sourceBefore[path], path);
  });
} catch (error) {
  failures.push({ after: checks.at(-1)?.name ?? null, error: error.stack });
  if (page) {
    await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
    await writeFile(resolve(output, 'failure-dom.html'), await page.content().catch(() => '')).catch(() => {});
  }
} finally {
  await context?.close().catch(() => {});
  await new Promise(done => server.close(done));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  const receipt = {
    schema: 'scopesignal.scope-compare-receiving.v1', at: new Date().toISOString(),
    source: root, sourceCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null,
    node: process.version, nodeExecutable: process.execPath,
    browser: browserVersion, browserExecutable: process.env.SCOPESIGNAL_CHROME || null,
    chromiumSandbox: true, launchArgs,
    playwright: process.env.SCOPESIGNAL_PLAYWRIGHT || null,
    sourceBefore, servedSha256: Object.fromEntries([...served].sort()),
    fixtureSha256: fixtureHashes, checks, failures, pageErrors, externalRequests,
    notes: ['Node drives the receiver; page modules execute in Chromium.',
      'Deferred/error reads instrument File.arrayBuffer only inside the isolated browser receiver.',
      'All model files use the project codec; A and B are actual authoring-page downloads.'],
    passed: failures.length === 0
  };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
}
if (failures.length) process.exitCode = 1;

