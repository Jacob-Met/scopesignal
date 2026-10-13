import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, createLedger, replayFixture } from '../src/ledger.mjs';
import { createFixtureRecord, serializeFixtureRecord } from '../src/fixture-record.mjs';
import { FixtureRecordError, MAX_RECORD_BYTES, MAX_RECORD_EVENTS, readFixtureRecord } from '../src/record-reader.mjs';

const text = record => JSON.stringify(record);
const refused = (record, code) => assert.throws(() => readFixtureRecord(typeof record === 'string' ? record : text(record)),
  error => error instanceof FixtureRecordError && (!code || error.code === code));
const modified = change => { const record = createFixtureRecord(replayFixture().events); change(record); return record; };

test('saved fixture reader accepts all real recovery prefixes without advancing the outcome', () => {
  const events = replayFixture().events;
  const states = ['not_started', 'not_started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
  for (let count = 0; count <= events.length; count++) {
    const expected = createFixtureRecord(events.slice(0, count));
    const record = readFixtureRecord(serializeFixtureRecord(events.slice(0, count)));
    assert.deepEqual(record, expected);
    assert.equal(record.events.length, count);
    assert.equal(record.checkpoints[0].capture.status, states[count]);
    assert.equal(record.summary.captured, count === 7 ? 40000 : 0);
  }
});

test('accepted evidence is exact literal Unicode text and an unapproved draft is absent', () => {
  const ledger = replayFixture();
  const evidence = 'Reviewed </pre><img src=x onerror="throw 1"> & “quoted” 😀\nSecond line\twith a tab';
  ledger.approve('accessibility', evidence);
  const record = readFixtureRecord(serializeFixtureRecord(ledger.events));
  assert.equal(record.checkpoints[1].approval.acceptedEvidence, evidence);
  assert.equal(record.events.at(-1).acceptedEvidence, evidence);
  assert.equal(record.checkpoints[1].approval.eventSequence, 8);
  assert.equal(record.checkpoints[2].approval, null);
  assert(!text(record).includes(FIXTURE.checkpoints[2].evidence));
});

test('ordinary capture, lookup-only recovery and independent checkpoints use the existing ledger', () => {
  const ledger = createLedger();
  for (const [index, checkpoint] of FIXTURE.checkpoints.entries()) {
    ledger.approve(checkpoint.id, 'Accepted checkpoint ' + index);
    ledger.createOrder(checkpoint.id);
    ledger.recordCaptureAttempt(checkpoint.id);
    if (index) ledger.recordLostCaptureResponse(checkpoint.id);
    else ledger.recordWebhook(checkpoint.id, 'WH-' + index, 'CAP-' + index);
    if (index) ledger.reconcile(checkpoint.id, 'CAP-' + index);
    const record = readFixtureRecord(serializeFixtureRecord(ledger.events));
    assert.equal(record.summary.captured, (index + 1) * 40000);
    assert.equal(record.summary.remaining + record.summary.captured, 120000);
  }
});

test('JSON key order and whitespace do not change the record, and returned facts are immutable', () => {
  const original = createFixtureRecord(replayFixture().events);
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  const record = readFixtureRecord('\n' + JSON.stringify(reordered, null, 4) + '\n');
  assert.deepEqual(record, original);
  assert.throws(() => { record.summary.captured = 0; }, TypeError);
  assert.throws(() => { record.events[0].acceptedEvidence = 'Changed'; }, TypeError);
  assert.throws(() => record.checkpoints.pop(), TypeError);
  assert.equal(readFixtureRecord(text(original)).summary.captured, 40000);
});

test('invalid JSON, another document and unsupported record versions are refused', () => {
  refused('{', 'syntax');
  for (const value of [null, [], 42, { schema: 'another-record' }]) refused(value, 'format');
  for (const change of [record => { record.version = 2; }, record => { record.ledgerSpecVersion = 2; }]) {
    refused(modified(change), 'version');
  }
  refused(modified(record => { record.fixtureOnly = false; }), 'format');
  refused(modified(record => { record.paymentEvidence = true; }), 'format');
});

test('saved summaries, approvals, identities and fixture definitions must match recorded events', () => {
  const changes = [
    record => { record.summary.captured = 80000; record.summary.remaining = 40000; },
    record => { record.summary.approved = 3; },
    record => { record.checkpoints[0].approval.acceptedEvidence = 'Different evidence'; },
    record => { record.checkpoints[0].approval.eventSequence = 2; },
    record => { record.checkpoints[0].capture.captureId = 'CAP-OTHER'; },
    record => { record.checkpoints[1].approval = record.checkpoints[0].approval; },
    record => { record.fixture.amount = 1200; },
    record => { record.fixture.label = 'Another project'; },
    record => { record.checkpoints.reverse(); },
    record => { record.checkpoints[0].capture.counted = 0; },
    record => { record.events.pop(); },
    record => { record.notice = 'Paid in full'; },
  ];
  for (const change of changes) refused(modified(change), 'inconsistent');
});

test('missing, extra and inherited-property fields cannot become trusted record facts', () => {
  refused(modified(record => { delete record.summary; }), 'format');
  refused(modified(record => { record.checkpoints[0].draft = 'Unrecorded'; }), 'format');
  refused(modified(record => { record.events[0].unknownField = 'Unsupported'; }), 'format');
  refused(modified(record => { record.events[0].checkpointId = '__proto__'; }), 'history');
  const polluted = text(createFixtureRecord(replayFixture().events)).replace('"schema":', '"__proto__":{"approved":true},"schema":');
  refused(polluted, 'format');
  assert.equal(Object.hasOwn(Object.prototype, 'approved'), false);
});

test('event order, required metadata and payload types are checked before ledger replay', () => {
  const changes = [
    record => { record.events[0].seq = 2; },
    record => { record.events[0].at = '2026-10-08T00:00:00Z'; },
    record => { record.events[4].duplicate = 'false'; },
    record => { record.events[1].amount = '40000'; },
    record => { record.events[0].acceptedEvidence = {}; },
    record => { record.events[0].type = 'constructor'; },
  ];
  for (const change of changes) refused(modified(change), 'history');
  refused(modified(record => { delete record.events[0].at; }), 'format');
});

// These controls intentionally require the reviewed shared ledger (#8). The
// old reducer silently accepts several of these streams and must not qualify.
test('shared ledger refuses contradictory lifecycle, money and capture identities in a file', () => {
  const changes = [
    record => { record.events[0].approver = 'bot'; record.checkpoints[0].approval.approver = 'bot'; },
    record => { record.events[0].acceptedEvidence = ''; },
    record => { record.events[1].amount = 1; },
    record => { record.events[1].currency = 'EUR'; },
    record => { record.events[1].environment = 'live'; },
    record => { record.events[2].orderId = 'OTHER-ORDER'; },
    record => { record.events[5].captureId = 'OTHER-CAPTURE'; },
    record => { record.events[5].duplicate = false; },
    record => { record.events[6].captureId = 'OTHER-CAPTURE'; },
    record => { record.events[6].source = 'unverified'; },
    record => {
      record.events = record.events.filter(event => event.type !== 'checkpoint.approved');
      record.events.forEach((event, index) => { event.seq = index + 1; event.at = 'T+' + String(index + 1).padStart(3, '0'); });
    },
  ];
  for (const change of changes) refused(modified(change), 'history');
});

test('exact byte limit is inclusive and uses UTF-8 bytes rather than JavaScript characters', () => {
  const original = serializeFixtureRecord([]);
  const exact = original + ' '.repeat(MAX_RECORD_BYTES - new TextEncoder().encode(original).byteLength);
  assert.equal(new TextEncoder().encode(exact).byteLength, MAX_RECORD_BYTES);
  assert.equal(readFixtureRecord(exact).summary.captured, 0);
  refused(exact + ' ', 'size');
  const unicode = JSON.stringify({ value: '😀'.repeat(MAX_RECORD_BYTES / 4) });
  assert(unicode.length < MAX_RECORD_BYTES);
  refused(unicode, 'size');
});

test('event limit permits a bounded full history and rejects the next exact duplicate', () => {
  const ledger = replayFixture();
  while (ledger.events.length < MAX_RECORD_EVENTS) ledger.recordWebhook('journey', 'WH-EVT-FIXTURE-001', 'CAP-FIXTURE-001');
  const record = readFixtureRecord(serializeFixtureRecord(ledger.events));
  assert.equal(record.events.length, MAX_RECORD_EVENTS);
  assert.equal(record.summary.captured, 40000);
  ledger.recordWebhook('journey', 'WH-EVT-FIXTURE-001', 'CAP-FIXTURE-001');
  refused(serializeFixtureRecord(ledger.events), 'events');
});
