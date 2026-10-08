#!/usr/bin/env node
/**
 * Independent ScopeSignal saved-record receiving.
 * node scripts/verify-record-composition.mjs SOURCE_DIRECTORY NEW_OUTPUT_DIRECTORY
 * Requires an existing PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE. Installs nothing.
 * One production UI download is a control. Three combined records are explicitly
 * authored via the current native ledger/exporter; their oracle is written below
 * from the ordered operations, without consulting reduce() or the exported facts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const [sourceArgument, outputArgument] = process.argv.slice(2);
assert.ok(sourceArgument && outputArgument && process.env.CHROMIUM_EXECUTABLE,
  'Supply SOURCE_DIRECTORY NEW_OUTPUT_DIRECTORY and CHROMIUM_EXECUTABLE.');
const source = fs.realpathSync(sourceArgument);
const output = path.resolve(outputArgument);
assert.ok(!fs.existsSync(output), 'Use a new output directory so evidence cannot be overwritten.');
fs.mkdirSync(output, { recursive: true });
const inputs = path.join(output, 'inputs');
fs.mkdirSync(inputs);
const playwrightReference = process.env.PLAYWRIGHT_MODULE || 'playwright-core';
const { chromium } = require(playwrightReference);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileHash = filename => sha256(fs.readFileSync(filename));
const save = (filename, value) => fs.writeFileSync(path.join(output, filename), JSON.stringify(value, null, 2) + '\n');
const servedPaths = [
  'index.html', 'app.mjs', 'styles.css', 'fixture-timeline.css', 'src/agents.mjs',
  'src/fixture-record.mjs', 'src/fixture-timeline-view.mjs', 'src/fixture-timeline.mjs',
  'src/ledger.mjs', 'src/payment-status.mjs', 'record.html', 'record-view.css',
  'src/record-reader.mjs', 'src/record-view.mjs',
];
const sourcePins = () => Object.fromEntries(servedPaths.filter(filename => fs.existsSync(path.join(source, filename)))
  .map(filename => [filename, fileHash(path.join(source, filename))]));
const receipt = {
  schema: 'scopesignal.independent-record-composition.v1', startedAt: new Date().toISOString(),
  boundary: 'Real Chromium receives one actual fixture UI download plus labeled authored multi-checkpoint records through the native file picker. Native reader and rendered DOM are checked against independent operation-derived facts. No payment, AI, or authoring service is invoked.',
  source: { directory: source, declaredCommit: process.env.SCOPESIGNAL_SOURCE_COMMIT || null, before: sourcePins() },
  harnessSha256: fileHash(fileURLToPath(import.meta.url)), node: process.version,
  playwright: { entry: require.resolve(playwrightReference), entrySha256: fileHash(require.resolve(playwrightReference)) },
  browser: { executable: process.env.CHROMIUM_EXECUTABLE, sha256: fileHash(process.env.CHROMIUM_EXECUTABLE) },
  inputs: [], cases: [], served: {}, externalRequests: [], pageErrors: [],
};

// These values and event envelopes are the independent oracle. The exporter
// supplies input bytes only; it never supplies an expected summary or checkpoint.
const evidence = {
  journey: 'Journey proof J\nSame-price checkpoint, distinct origin.',
  accessibility: 'Accessibility proof A\r\nKeyboard state 02\tScreen reader trace Ω',
  handoff: 'Handoff proof H: ["literal", "<&>"]',
};
const instructions = [
  ['approve', 'journey', evidence.journey],
  ['approve', 'accessibility', evidence.accessibility],
  ['createOrder', 'accessibility'],
  ['createOrder', 'journey'],
  ['recordCaptureAttempt', 'journey'],
  ['approve', 'handoff', evidence.handoff],
  ['recordCaptureAttempt', 'accessibility'],
  ['recordLostCaptureResponse', 'accessibility'],
  ['recordLostCaptureResponse', 'journey'],
  ['recordWebhook', 'accessibility', 'WH-ACCESS-A', 'CAP-ACCESS-A'],
  ['createOrder', 'handoff'],
  ['recordWebhook', 'journey', 'WH-JOURNEY-A', 'CAP-JOURNEY-A'],
  ['recordWebhook', 'accessibility', 'WH-ACCESS-A', 'CAP-ACCESS-A'],
  ['recordWebhook', 'journey', 'WH-JOURNEY-A', 'CAP-JOURNEY-A'],
  ['reconcile', 'journey', 'CAP-JOURNEY-A'],
  ['recordWebhook', 'journey', 'WH-JOURNEY-SECOND', 'CAP-JOURNEY-A'],
];
const payloads = [
  { type: 'checkpoint.approved', checkpointId: 'journey', approver: 'human-reviewer', acceptedEvidence: evidence.journey },
  { type: 'checkpoint.approved', checkpointId: 'accessibility', approver: 'human-reviewer', acceptedEvidence: evidence.accessibility },
  { type: 'paypal.order.created', checkpointId: 'accessibility', orderId: 'SANDBOX-ACCESSIBILITY', amount: 40000, currency: 'USD', environment: 'sandbox' },
  { type: 'paypal.order.created', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', amount: 40000, currency: 'USD', environment: 'sandbox' },
  { type: 'paypal.capture.requested', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', environment: 'sandbox' },
  { type: 'checkpoint.approved', checkpointId: 'handoff', approver: 'human-reviewer', acceptedEvidence: evidence.handoff },
  { type: 'paypal.capture.requested', checkpointId: 'accessibility', orderId: 'SANDBOX-ACCESSIBILITY', environment: 'sandbox' },
  { type: 'paypal.capture.response_lost', checkpointId: 'accessibility', orderId: 'SANDBOX-ACCESSIBILITY', outcome: 'unknown' },
  { type: 'paypal.capture.response_lost', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', outcome: 'unknown' },
  { type: 'paypal.webhook.received', checkpointId: 'accessibility', eventId: 'WH-ACCESS-A', captureId: 'CAP-ACCESS-A', duplicate: false, amount: 40000, currency: 'USD' },
  { type: 'paypal.order.created', checkpointId: 'handoff', orderId: 'SANDBOX-HANDOFF', amount: 40000, currency: 'USD', environment: 'sandbox' },
  { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-JOURNEY-A', captureId: 'CAP-JOURNEY-A', duplicate: false, amount: 40000, currency: 'USD' },
  { type: 'paypal.webhook.received', checkpointId: 'accessibility', eventId: 'WH-ACCESS-A', captureId: 'CAP-ACCESS-A', duplicate: true, amount: 40000, currency: 'USD' },
  { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-JOURNEY-A', captureId: 'CAP-JOURNEY-A', duplicate: true, amount: 40000, currency: 'USD' },
  { type: 'paypal.capture.reconciled', checkpointId: 'journey', captureId: 'CAP-JOURNEY-A', outcome: 'captured', source: 'sandbox-transaction-lookup' },
  { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-JOURNEY-SECOND', captureId: 'CAP-JOURNEY-A', duplicate: false, amount: 40000, currency: 'USD' },
];
const envelope = (payload, index) => ({ seq: index + 1, at: 'T+' + String(index + 1).padStart(3, '0'), ...payload });
const expectedEvents = payloads.map(envelope);
const expectedCheckpoints = [
  { id: 'journey', title: 'First-run checklist', amount: 40000,
    approval: { source: 'checkpoint.approved', eventSequence: 1, approver: 'human-reviewer', acceptedEvidence: evidence.journey },
    capture: { status: 'captured', orderId: 'SANDBOX-JOURNEY', captureId: 'CAP-JOURNEY-A', counted: 40000 } },
  { id: 'accessibility', title: 'Accessible billing setup', amount: 40000,
    approval: { source: 'checkpoint.approved', eventSequence: 2, approver: 'human-reviewer', acceptedEvidence: evidence.accessibility },
    capture: { status: 'unknown', orderId: 'SANDBOX-ACCESSIBILITY', captureId: null, counted: 0 } },
  { id: 'handoff', title: 'Responsive handoff', amount: 40000,
    approval: { source: 'checkpoint.approved', eventSequence: 6, approver: 'human-reviewer', acceptedEvidence: evidence.handoff },
    capture: { status: 'ready', orderId: 'SANDBOX-HANDOFF', captureId: null, counted: 0 } },
];
const expectedFixture = { id: 'fixture-signal-studio', label: 'Northstar onboarding refresh', currency: 'USD', amount: 120000 };
const expectedMixed = { fixture: expectedFixture, summary: { total: 120000, approved: 3, captured: 40000, remaining: 80000 }, checkpoints: expectedCheckpoints, events: expectedEvents };
const expectedReconciled = structuredClone(expectedMixed);
expectedReconciled.summary.captured = 80000;
expectedReconciled.summary.remaining = 40000;
expectedReconciled.checkpoints[1].capture = { status: 'captured', orderId: 'SANDBOX-ACCESSIBILITY', captureId: 'CAP-ACCESS-A', counted: 40000 };
expectedReconciled.events.push(envelope({ type: 'paypal.capture.reconciled', checkpointId: 'accessibility', captureId: 'CAP-ACCESS-A', outcome: 'captured', source: 'sandbox-transaction-lookup' }, 16));
const expectedPending = structuredClone(expectedReconciled);
expectedPending.checkpoints[2].capture.status = 'pending';
expectedPending.events.push(envelope({ type: 'paypal.capture.requested', checkpointId: 'handoff', orderId: 'SANDBOX-HANDOFF', environment: 'sandbox' }, 17));

function verifyFacts(actual, expected) {
  assert.equal(actual.fixtureOnly, true);
  assert.equal(actual.paymentEvidence, false);
  for (const key of ['fixture', 'summary', 'checkpoints', 'events']) assert.deepEqual(actual[key], expected[key], key);
}
async function caseRun(id, run) {
  const current = { id, checks: [] };
  receipt.cases.push(current);
  const check = async (name, fn) => {
    try { await fn(); current.checks.push({ name, passed: true }); }
    catch (error) { current.checks.push({ name, passed: false, error: error.stack }); }
  };
  try { await run(check, current); }
  catch (error) { current.checks.push({ name: 'case execution', passed: false, error: error.stack }); }
  current.passed = current.checks.length > 0 && current.checks.every(check => check.passed);
}
function put(name, text, kind) {
  const bytes = Buffer.from(text, 'utf8');
  const filename = path.join(inputs, name);
  fs.writeFileSync(filename, bytes);
  receipt.inputs.push({ name, kind, bytes: bytes.length, sha256: sha256(bytes) });
  return { name, filename, text, record: JSON.parse(text) };
}
const { createLedger } = await import(pathToFileURL(path.join(source, 'src/ledger.mjs')).href);
const { serializeFixtureRecord } = await import(pathToFileURL(path.join(source, 'src/fixture-record.mjs')).href);
const ledger = createLedger();
for (const [operation, ...args] of instructions) ledger[operation](...args);
const mixed = put('authored-mixed-states.json', serializeFixtureRecord(ledger.events), 'Authored ordered operations through production ledger/exporter; not a UI-created payment or download.');
ledger.reconcile('accessibility', 'CAP-ACCESS-A');
const reconciled = put('authored-access-reconciled.json', serializeFixtureRecord(ledger.events), 'Authored single additional reconciliation through production ledger/exporter.');
ledger.recordCaptureAttempt('handoff');
const pending = put('authored-handoff-pending.json', serializeFixtureRecord(ledger.events), 'Authored single additional capture request through production ledger/exporter.');
const captureForgery = structuredClone(mixed.record);
[captureForgery.checkpoints[0].capture, captureForgery.checkpoints[1].capture] = [captureForgery.checkpoints[1].capture, captureForgery.checkpoints[0].capture];
const approvalForgery = structuredClone(mixed.record);
[approvalForgery.checkpoints[0].approval, approvalForgery.checkpoints[1].approval] = [approvalForgery.checkpoints[1].approval, approvalForgery.checkpoints[0].approval];
const forgeries = [
  put('authored-balanced-capture-swap.json', JSON.stringify(captureForgery, null, 2) + '\n', 'Authored inconsistent checkpoint capture tuples; aggregate totals, equal milestone amounts, and every event remain unchanged.'),
  put('authored-balanced-approval-swap.json', JSON.stringify(approvalForgery, null, 2) + '\n', 'Authored inconsistent approval origin/evidence tuples; aggregate approval counts and every event remain unchanged.'),
];
save('independent-expectations.json', { instructions, mixed: expectedMixed, reconciled: expectedReconciled, pending: expectedPending });
const hasReader = fs.existsSync(path.join(source, 'src/record-reader.mjs'));
const readFixtureRecord = hasReader ? (await import(pathToFileURL(path.join(source, 'src/record-reader.mjs')).href)).readFixtureRecord : null;
await caseRun('authored_input_controls', async check => {
  await check('Production exports match the independently enumerated operations, event metadata and checkpoint facts', () => {
    for (const [fixture, expected] of [[mixed, expectedMixed], [reconciled, expectedReconciled], [pending, expectedPending]]) verifyFacts(fixture.record, expected);
  });
  await check('Both forged records preserve totals, approvals, event history and sums while changing a checkpoint-owned fact', () => {
    for (const forged of forgeries) {
      assert.deepEqual(forged.record.summary, mixed.record.summary);
      assert.deepEqual(forged.record.events, mixed.record.events);
      assert.equal(forged.record.checkpoints.reduce((sum, checkpoint) => sum + checkpoint.capture.counted, 0), 40000);
      assert.equal(forged.record.checkpoints.filter(checkpoint => checkpoint.approval).length, 3);
      assert.notDeepEqual(forged.record.checkpoints, mixed.record.checkpoints);
    }
  });
});

const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!servedPaths.includes(relative) || !fs.existsSync(path.join(source, relative))) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const bytes = fs.readFileSync(path.join(source, relative));
  receipt.served[relative] = sha256(bytes);
  response.writeHead(200, { 'content-type': mime[path.extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(bytes);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
receipt.origin = origin;
let browser;

async function choose(page, filename) {
  const event = page.waitForEvent('filechooser');
  await page.locator('#record-file').click();
  await (await event).setFiles(filename);
  await page.waitForFunction(() => !document.querySelector('#record-status').textContent.startsWith('Opening '));
}
async function readDOM(page) {
  return page.evaluate(() => {
    const facts = selector => Object.fromEntries([...document.querySelectorAll(selector)].map(pair => [pair.querySelector('dt').textContent, pair.querySelector('dd').textContent]));
    return {
      title: document.querySelector('#record-title')?.textContent,
      filename: document.querySelector('.record-filename')?.textContent,
      notice: document.querySelector('.record-notice')?.textContent,
      totals: facts('.record-totals > div'),
      checkpoints: [...document.querySelectorAll('.saved-checkpoint')].map(card => ({
        id: card.dataset.checkpointId, title: card.querySelector('h4').textContent,
        amount: card.querySelector('.checkpoint-amount').textContent,
        approval: card.querySelector('.approval-state')?.textContent ?? null,
        evidence: card.querySelector('.accepted-evidence')?.textContent ?? null,
        state: card.querySelector('.saved-capture').dataset.captureState,
        stateLabel: card.querySelector('.capture-state').textContent,
        note: card.querySelector('.saved-capture p').textContent,
        identities: Object.fromEntries([...card.querySelectorAll('.record-identities > div')].map(pair => [pair.querySelector('dt').textContent, pair.querySelector('dd').textContent])),
      })),
      events: [...document.querySelectorAll('.event-json')].map(node => JSON.parse(node.textContent)),
      labels: [...document.querySelectorAll('.event-description strong')].map(node => node.textContent),
      checkpointLabels: [...document.querySelectorAll('.event-description > span')].map(node => node.textContent),
      footnote: document.querySelector('.record-footnote')?.textContent,
    };
  });
}
const dollars = { 0: '$0.00', 40000: '$400.00', 80000: '$800.00', 120000: '$1,200.00' };
const stateLabels = { captured: 'Capture recorded', unknown: 'Capture unknown', ready: 'Order ready', pending: 'Capture pending' };
function verifyDOM(actual, expected, filename) {
  assert.equal(actual.title, expected.fixture.label);
  assert.equal(actual.filename, filename);
  assert.equal(actual.notice, 'Synthetic fixture · Not payment evidence');
  assert.match(actual.footnote, /unsigned/);
  assert.deepEqual(actual.totals, { 'Project cap': '$1,200.00', 'Approvals recorded': '3 / 3', 'Captures recorded': dollars[expected.summary.captured], 'Remaining in fixture': dollars[expected.summary.remaining] });
  assert.equal(actual.checkpoints.length, 3);
  for (const [index, checkpoint] of expected.checkpoints.entries()) {
    const card = actual.checkpoints[index];
    assert.equal(card.id, checkpoint.id);
    assert.equal(card.title, checkpoint.title);
    assert.equal(card.amount, '$400.00');
    assert.equal(card.approval, 'Approval recorded · Event ' + checkpoint.approval.eventSequence + ' · human-reviewer');
    assert.equal(card.evidence, checkpoint.approval.acceptedEvidence);
    assert.equal(card.state, checkpoint.capture.status);
    assert.equal(card.stateLabel, stateLabels[checkpoint.capture.status]);
    assert.deepEqual(card.identities, { Order: checkpoint.capture.orderId, 'Confirmed capture': checkpoint.capture.captureId ?? 'None recorded', 'Counted amount': dollars[checkpoint.capture.counted] });
  }
  assert.deepEqual(actual.events, expected.events);
  assert.deepEqual(actual.labels.filter(label => label === 'Duplicate webhook recorded'), ['Duplicate webhook recorded', 'Duplicate webhook recorded']);
  assert.deepEqual(actual.checkpointLabels, expected.events.map(event => expected.checkpoints.find(checkpoint => checkpoint.id === event.checkpointId).title));
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, headless: true, args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  receipt.browser.version = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true, serviceWorkers: 'block' });
  context.setDefaultTimeout(5000);
  context.on('page', page => page.on('pageerror', error => receipt.pageErrors.push({ page: page.url(), error: error.message })));
  await context.route('**/*', route => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origin) return route.continue();
    receipt.externalRequests.push({ page: request.frame().url(), url });
    return route.abort();
  });
  const app = await context.newPage();
  await app.goto(origin, { waitUntil: 'networkidle' });
  let viewer;
  await caseRun('actual_download_navigation_control', async check => {
    const accepted = 'Download control: approval belongs to accessibility.';
    const draft = 'Unapproved draft retained in the original fixture.';
    await app.locator('#evidence-accessibility').fill(accepted);
    await app.locator('.approve[data-id="accessibility"]').click();
    await app.locator('#evidence-handoff').fill(draft);
    const event = app.waitForEvent('download');
    await app.locator('#export-record').click();
    const downloaded = await event;
    const filename = path.join(inputs, downloaded.suggestedFilename());
    await downloaded.saveAs(filename);
    const bytes = fs.readFileSync(filename);
    const actual = JSON.parse(bytes);
    receipt.download = { name: downloaded.suggestedFilename(), bytes: bytes.length, sha256: sha256(bytes), kind: 'Actual Blob download clicked in the unchanged production fixture UI.' };
    await check('Actual production download contains the clicked approval and excludes the unapproved draft', () => {
      assert.equal(actual.events.length, 8);
      assert.equal(actual.checkpoints[1].approval.acceptedEvidence, accepted);
      assert.equal(actual.checkpoints[1].approval.eventSequence, 8);
      assert.equal(actual.checkpoints[2].approval, null);
      assert.deepEqual(actual.summary, { total: 120000, approved: 2, captured: 40000, remaining: 80000 });
      assert.equal(bytes.includes(draft), false);
    });
    await check('Saved-record navigation exists at this source', async () => assert.equal(await app.locator('#inspect-record').count(), 1));
    if (await app.locator('#inspect-record').count() !== 1) return;
    const opened = context.waitForEvent('page');
    await app.locator('#inspect-record').click();
    viewer = await opened;
    await viewer.waitForLoadState('networkidle');
    await choose(viewer, filename);
    await check('Native file picker opens the actual downloaded approval in a separate viewer and preserves the original draft', async () => {
      assert.equal(await viewer.evaluate(() => window.opener), null);
      assert.equal(await app.locator('#evidence-handoff').inputValue(), draft);
      assert.equal(await viewer.locator('[data-checkpoint-id="accessibility"] .accepted-evidence').textContent(), accepted);
      assert.equal(await viewer.locator('.saved-event').count(), 8);
      assert.equal(await viewer.locator('#record-error').isVisible(), false);
    });
  });

  if (viewer && readFixtureRecord) {
    for (const [id, fixture, expected] of [
      ['mixed_equal_amount_checkpoints', mixed, expectedMixed],
      ['one_new_reconciliation_changes_only_its_checkpoint', reconciled, expectedReconciled],
      ['new_request_remains_pending_and_uncounted', pending, expectedPending],
    ]) {
      await caseRun(id, async (check, current) => {
        await check('Native reader preserves the independent event and checkpoint facts', () => verifyFacts(readFixtureRecord(fixture.text), expected));
        await choose(viewer, fixture.filename);
        const dom = await readDOM(viewer);
        save(id + '-dom.json', dom);
        current.filename = fixture.name;
        await check('Actual rendered record keeps each equal-price checkpoint tied to its own evidence, status, identity and amount', () => verifyDOM(dom, expected, fixture.name));
        await check('The unresolved/ready/pending outcomes do not claim an additional counted capture', () => {
          const handoff = dom.checkpoints.find(checkpoint => checkpoint.id === 'handoff');
          assert.equal(handoff.identities['Counted amount'], '$0.00');
          if (id === 'mixed_equal_amount_checkpoints') {
            const access = dom.checkpoints.find(checkpoint => checkpoint.id === 'accessibility');
            assert.equal(access.identities['Confirmed capture'], 'None recorded');
            assert.ok(dom.events.some(event => event.checkpointId === 'accessibility' && event.captureId === 'CAP-ACCESS-A'));
            assert.match(access.note, /No captured amount is counted/);
          }
        });
      });
    }

    for (const fixture of forgeries) {
      await caseRun(fixture.name.replace('.json', ''), async check => {
        await check('Native admission refuses the balanced forgery as inconsistent', () => assert.throws(() => readFixtureRecord(fixture.text), error => error.name === 'FixtureRecordError' && error.code === 'inconsistent'));
        await choose(viewer, mixed.filename);
        const before = await readDOM(viewer);
        await viewer.evaluate(() => { globalThis.receivingAcceptedTitle = document.querySelector('#record-title'); });
        await choose(viewer, fixture.filename);
        const after = await readDOM(viewer);
        save(fixture.name.replace('.json', '-dom.json'), after);
        await check('The browser refuses instead of announcing that the inconsistent saved fields match', async () => {
          assert.equal(await viewer.locator('#record-error').isVisible(), true);
          assert.match(await viewer.locator('#record-error').textContent(), /does not match the event history/);
          assert.equal(await viewer.locator('#record-status').textContent(), 'The previous record remains open.');
        });
        await check('Refusal preserves the exact prior record DOM, filename, evidence and every displayed event', async () => {
          assert.deepEqual(after, before);
          assert.equal(await viewer.evaluate(() => globalThis.receivingAcceptedTitle === document.querySelector('#record-title')), true);
        });
      });
    }
    await choose(viewer, mixed.filename);
    await viewer.screenshot({ path: path.join(output, 'mixed-record.png'), fullPage: true });
    await viewer.setViewportSize({ width: 390, height: 844 });
    await caseRun('combined_record_small_viewport', async check => {
      await check('The mixed record retains the same independent facts at 390 pixels', async () => verifyDOM(await readDOM(viewer), expectedMixed, mixed.name));
      await check('Record text remains inside the document viewport', async () => {
        const size = await viewer.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(size.scrollWidth <= size.width + 1, JSON.stringify(size));
      });
    });
    await viewer.screenshot({ path: path.join(output, 'mixed-record-phone.png'), fullPage: true });
  } else {
    receipt.unavailableBoundary = 'This source has no reachable saved-record viewer/reader. Combined display and admission cases were not executed.';
  }
  await caseRun('source_and_browser_integrity', async check => {
    await check('No script errors or viewer requests outside the served local source', () => {
      assert.deepEqual(receipt.pageErrors, []);
      assert.deepEqual(receipt.externalRequests.filter(request => request.page.includes('/record.html')), []);
      assert.ok(receipt.externalRequests.every(request => request.url.startsWith('https://fonts.googleapis.com/css2?')),
        'Only the preexisting fixture-page font request may be blocked.');
    });
    await check('Every served source byte matches the frozen starting source and remains unchanged', () => {
      assert.deepEqual(sourcePins(), receipt.source.before);
      for (const [filename, sha] of Object.entries(receipt.served)) assert.equal(sha, receipt.source.before[filename], filename);
    });
  });
  await context.close();
} catch (error) {
  receipt.fatal = error.stack;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  receipt.source.after = sourcePins();
  receipt.finishedAt = new Date().toISOString();
  receipt.counts = {
    cases: receipt.cases.length,
    passedCases: receipt.cases.filter(result => result.passed).length,
    checks: receipt.cases.reduce((sum, result) => sum + result.checks.length, 0),
    passedChecks: receipt.cases.reduce((sum, result) => sum + result.checks.filter(check => check.passed).length, 0),
  };
  receipt.passed = !receipt.fatal && !receipt.unavailableBoundary && receipt.cases.every(result => result.passed);
  save('receipt.json', receipt);
  console.log(JSON.stringify({ output, passed: receipt.passed, ...receipt.counts, fatal: receipt.fatal ?? null, failures: receipt.cases.filter(result => !result.passed).map(result => ({ id: result.id, failedChecks: result.checks.filter(check => !check.passed).map(check => check.name) })) }));
}
if (!receipt.passed) process.exitCode = 1;
