import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, SPEC_VERSION, createLedger, replayFixture } from '../src/ledger.mjs';
import { FIXTURE_RECORD_FILENAME, createFixtureRecord, serializeFixtureRecord } from '../src/fixture-record.mjs';

test('download has a fixed safe filename and explicit fixture schema and provenance', () => {
  assert.equal(FIXTURE_RECORD_FILENAME, 'scopesignal-fixture-record-v1.json');
  assert.match(FIXTURE_RECORD_FILENAME, /^[a-z0-9-]+\.json$/);
  const record = createFixtureRecord(replayFixture().events);
  assert.equal(record.schema, 'scopesignal.fixture-record');
  assert.equal(record.version, 1);
  assert.equal(record.ledgerSpecVersion, SPEC_VERSION);
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.paymentEvidence, false);
  assert.match(record.notice, /not a payment receipt or evidence of a real transaction/);
  assert.equal(record.fixture.id, FIXTURE.id);
});

test('export records the actual replay events and reduced counted outcome', () => {
  const ledger = replayFixture();
  const record = createFixtureRecord(ledger.events);
  assert.deepEqual(record.events, ledger.events);
  assert.deepEqual(record.summary, { total: 120000, approved: 1, captured: 40000, remaining: 80000 });
  const journey = record.checkpoints.find(checkpoint => checkpoint.id === 'journey');
  assert.deepEqual(journey.approval, { source: 'checkpoint.approved', eventSequence: 1, approver: 'human-reviewer', acceptedEvidence: ledger.events[0].acceptedEvidence });
  assert.deepEqual(journey.capture, { status: 'captured', orderId: 'SANDBOX-JOURNEY', captureId: 'CAP-FIXTURE-001', counted: 40000 });
});

test('accepted multiline and literal evidence comes from the exact approval event', () => {
  const ledger = replayFixture();
  const typed = '  Reviewed evidence\n</textarea><script>literal</script> & “quoted” 😀\n  ';
  ledger.approve('accessibility', typed);
  const accepted = ledger.events.at(-1).acceptedEvidence;
  assert.equal(accepted, typed.trim());
  const record = JSON.parse(serializeFixtureRecord(ledger.events));
  assert.equal(record.checkpoints.find(checkpoint => checkpoint.id === 'accessibility').approval.acceptedEvidence, accepted);
  assert.equal(record.events.at(-1).acceptedEvidence, accepted);
  assert.notEqual(accepted, FIXTURE.checkpoints[1].evidence);
});

test('unapproved checkpoints have no approval evidence and no authored draft field', () => {
  const record = createFixtureRecord(replayFixture().events);
  const handoff = record.checkpoints.find(checkpoint => checkpoint.id === 'handoff');
  assert.equal(handoff.approval, null);
  assert.equal(Object.hasOwn(handoff, 'evidence'), false);
  assert.equal(Object.hasOwn(handoff, 'draft'), false);
  assert(!serializeFixtureRecord(replayFixture().events).includes(FIXTURE.checkpoints[2].evidence));
});

test('every capture prefix exports the current outcome without advancing or inventing events', () => {
  const events = replayFixture().events;
  const expected = ['not_started', 'not_started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
  for (let count = 0; count <= events.length; count++) {
    const prefix = events.slice(0, count);
    const record = createFixtureRecord(prefix);
    assert.equal(record.events.length, count);
    assert.deepEqual(record.events, prefix);
    assert.equal(record.checkpoints[0].capture.status, expected[count]);
    assert.equal(record.summary.captured, count === 7 ? 40000 : 0);
  }
});

test('repeated exports are deterministic and detached from the live in-memory ledger', () => {
  const ledger = replayFixture();
  const before = structuredClone(ledger.events);
  const first = serializeFixtureRecord(ledger.events);
  assert.equal(serializeFixtureRecord(ledger.events), first);
  assert(first.endsWith('\n'));
  const record = createFixtureRecord(ledger.events);
  record.events[0].acceptedEvidence = 'Changed exported object';
  record.checkpoints[0].approval.acceptedEvidence = 'Changed exported view';
  assert.deepEqual(ledger.events, before);
  assert.equal(serializeFixtureRecord(ledger.events), first);
});

test('an empty fixture exports no approval and never represents a successful payment', () => {
  const record = createFixtureRecord(createLedger().events);
  assert.equal(record.summary.approved, 0);
  assert.equal(record.summary.captured, 0);
  assert(record.checkpoints.every(checkpoint => checkpoint.approval === null && checkpoint.capture.counted === 0));
  assert.deepEqual(record.events, []);
  assert.equal(record.paymentEvidence, false);
});
