import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, replayFixture } from '../src/ledger.mjs';
import { roles } from '../src/agents.mjs';

test('a reconciled fixture no longer asks the reviewer to keep its capture unknown', () => {
  const ledger = replayFixture();
  assert.equal(ledger.snapshot().checkpoints.journey.captureStatus, 'captured');
  assert.equal(ledger.snapshot().captured, 40000);
  const review = roles.recoveryReview(ledger.events);
  assert.match(review.guidance, /no uncertain capture remains/);
  assert.doesNotMatch(review.guidance, /Keep capture unknown/);
  assert.match(review.duplicateWebhook, /Duplicate event ignored/);
});

test('a lost response and both webhook receipts retain current unknown guidance until reconciliation', () => {
  const events = replayFixture().events;
  for (const length of [4, 5, 6]) {
    const review = roles.recoveryReview(events.slice(0, length));
    assert.match(review.guidance, /unknown/);
    assert.match(review.guidance, /Do not retry blindly/);
    assert.match(review.guidance, /reconcile once/);
    assert.doesNotMatch(review.guidance, /no uncertain capture remains/);
  }
});

test('another unresolved checkpoint still takes priority over an earlier reconciled capture', () => {
  const ledger = replayFixture();
  ledger.approve('accessibility');
  ledger.createOrder('accessibility');
  ledger.recordCaptureAttempt('accessibility');
  ledger.recordLostCaptureResponse('accessibility');
  assert.match(roles.recoveryReview(ledger.events).guidance, /unknown/);
  ledger.reconcile('accessibility', 'CAP-SECOND');
  assert.equal(ledger.snapshot().captured, 80000);
  assert.match(roles.recoveryReview(ledger.events).guidance, /no uncertain capture remains/);
});

test('pending and never-requested captures remain distinct from resolved captures', () => {
  const ledger = createLedger();
  assert.match(roles.recoveryReview(ledger.events).guidance, /No capture has been requested/);
  ledger.approve('journey');
  ledger.createOrder('journey');
  assert.match(roles.recoveryReview(ledger.events).guidance, /No capture has been requested/);
  ledger.recordCaptureAttempt('journey');
  assert.match(roles.recoveryReview(ledger.events).guidance, /pending/);
  assert.doesNotMatch(roles.recoveryReview(ledger.events).guidance, /no uncertain capture remains/);
});
