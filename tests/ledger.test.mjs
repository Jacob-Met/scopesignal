import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, createLedger, replayFixture, reduce } from '../src/ledger.mjs';
import { roles } from '../src/agents.mjs';
import { interpretWithWorkersAI, validateBriefResult } from '../src/workers-ai.mjs';

test('fixture deterministically replays lost response, duplicate webhook, and one reconcile', () => {
  const a = replayFixture(); const b = replayFixture();
  assert.deepEqual(a.events, b.events);
  const state = a.snapshot();
  assert.equal(state.checkpoints.journey.captureStatus, 'captured');
  assert.equal(state.checkpoints.journey.counted, 40000);
  assert.equal(state.captured, 40000);
  assert.equal(state.remaining, 80000);
  assert.equal(a.events.filter(e => e.type === 'paypal.webhook.received' && e.duplicate).length, 1);
  assert.equal(a.events.find(e => e.type === 'paypal.capture.response_lost').outcome, 'unknown');
});

test('order and capture require prior explicit human approval and order', () => {
  const ledger = createLedger();
  assert.throws(() => ledger.createOrder('journey'), /Human approval required/);
  assert.throws(() => ledger.recordCaptureAttempt('journey'), /Approved PayPal order required/);
  ledger.approve('journey'); ledger.createOrder('journey'); ledger.recordCaptureAttempt('journey');
  assert.equal(ledger.snapshot().checkpoints.journey.captureStatus, 'pending');
});

test('lost response cannot be blindly captured again; reconcile is one-time', () => {
  const ledger = createLedger(); ledger.approve('journey'); ledger.createOrder('journey'); ledger.recordCaptureAttempt('journey'); ledger.recordLostCaptureResponse('journey');
  assert.equal(ledger.snapshot().checkpoints.journey.captureStatus, 'unknown');
  assert.throws(() => ledger.recordCaptureAttempt('journey'), /reconcile first/);
  ledger.reconcile('journey', 'CAP-LOOKUP-1');
  assert.throws(() => ledger.reconcile('journey', 'CAP-LOOKUP-1'), /Only an unknown capture/);
  assert.equal(ledger.snapshot().captured, 40000);
});

test('same webhook event ID is idempotent and cannot double count', () => {
  const ledger = createLedger(); ledger.approve('journey'); ledger.createOrder('journey');
  ledger.recordWebhook('journey', 'WH-1', 'CAP-1'); ledger.recordWebhook('journey', 'WH-1', 'CAP-1');
  assert.equal(ledger.snapshot().captured, 40000);
  assert.equal(ledger.snapshot().checkpoints.journey.captureId, 'CAP-1');
});

test('reducer never counts duplicate webhook in fixture stream', () => {
 const fixture = replayFixture(); assert.equal(reduce(fixture.events).captured, FIXTURE.checkpoints[0].amount);
});

test('role previews are explicit local rules and never claim AI output', () => {
 assert.equal(roles.briefInterpreter().mode, 'local rule preview');
 assert.equal(roles.paymentPolicy(FIXTURE.checkpoints[0]).executable, false);
 assert.match(roles.recoveryReview(replayFixture().events).guidance, /no uncertain capture remains/);
 assert.match(roles.recoveryReview(replayFixture().events.slice(0, 4)).guidance, /Do not retry blindly/);
});

test('Workers AI adapter fails closed without binding and has no paid fallback', async () => {
 await assert.rejects(() => interpretWithWorkersAI('brief', {}), /disconnected.*No paid fallback/);
});

test('schema validation rejects malformed model output', () => {
 assert.deepEqual(validateBriefResult({ checkpoints: [{ title: 'Checklist', evidence: 'Screen recording' }] }).checkpoints.length, 1);
 assert.throws(() => validateBriefResult({ checkpoints: [{ title: '', evidence: 'x' }] }), /schema validation/);
 assert.throws(() => validateBriefResult({ checkpoints: [], extra: true }), /required schema/);
});
