import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLedger, reduce, replayFixture, FIXTURE } from '../src/ledger.mjs';

// Serialized source fixture pins from unchanged main 33f021aaacd6d7ed68c508d92901e7442d99586c.
const FIXTURE_PINS = {
  "events_sha256": "8327831a138dbb31d9442b09ef8177bf2d7c5cc92fb536b24d636069cb2a4afe",
  "snapshot_sha256": "3e38e07847d0880ae8bcfe9e241cf118f0f0a0ffa27efbe316946cde7fdd735f"
};
const shaJSON = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function prefix(state = 'ready', checkpoint = 'journey', ledger = createLedger()) {
  if (state === 'empty') return ledger;
  ledger.approve(checkpoint, 'Independent receiving review: human acceptance fixture.');
  if (state === 'approved') return ledger;
  ledger.createOrder(checkpoint);
  if (state === 'ready') return ledger;
  ledger.recordCaptureAttempt(checkpoint);
  if (state === 'pending') return ledger;
  ledger.recordLostCaptureResponse(checkpoint);
  if (state === 'unknown') return ledger;
  ledger.reconcile(checkpoint, `CAP-${checkpoint}`);
  return ledger;
}

function refused(ledger, event) {
  const before = JSON.stringify({ events: ledger.events, snapshot: ledger.snapshot() });
  const { type, ...payload } = event;
  assert.throws(() => ledger.append(type, payload));
  assert.equal(JSON.stringify({ events: ledger.events, snapshot: ledger.snapshot() }), before);
  assert.throws(() => reduce([...ledger.events, event]));
}

test('review: all deterministic fixture events and reduced values retain exact serialized bytes', () => {
  assert.equal(shaJSON(replayFixture().events), FIXTURE_PINS.events_sha256);
  assert.equal(shaJSON(replayFixture().snapshot()), FIXTURE_PINS.snapshot_sha256);
});

test('review: money and order identity cannot disagree with approved checkpoint evidence', () => {
  const invalid = [
    ['approved', { type: 'paypal.order.created', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', amount: 1, currency: 'USD', environment: 'sandbox' }],
    ['approved', { type: 'paypal.order.created', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', amount: 40000, currency: 'EUR', environment: 'sandbox' }],
    ['approved', { type: 'paypal.order.created', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', amount: 40000, currency: 'USD', environment: 'live' }],
    ['ready', { type: 'paypal.capture.requested', checkpointId: 'journey', orderId: 'UNRELATED-ORDER', environment: 'sandbox' }],
    ['ready', { type: 'paypal.capture.requested', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', environment: 'live' }],
    ['pending', { type: 'paypal.capture.response_lost', checkpointId: 'journey', orderId: 'UNRELATED-ORDER', outcome: 'unknown' }],
    ['ready', { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-ONE', captureId: 'CAP-ONE', duplicate: false, amount: 1, currency: 'USD' }],
    ['ready', { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-ONE', captureId: 'CAP-ONE', duplicate: false, amount: 40000, currency: 'EUR' }],
  ];
  for (const [state, event] of invalid) refused(prefix(state), event);
});

test('review: raw replay preserves approval, order, capture, and reconciliation prerequisites', () => {
  const invalid = [
    ['empty', { type: 'checkpoint.approved', checkpointId: 'journey', acceptedEvidence: '', approver: 'human-reviewer' }],
    ['empty', { type: 'paypal.order.created', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', amount: 40000, currency: 'USD', environment: 'sandbox' }],
    ['approved', { type: 'paypal.capture.requested', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', environment: 'sandbox' }],
    ['ready', { type: 'paypal.capture.response_lost', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', outcome: 'unknown' }],
    ['empty', { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-ONE', captureId: 'CAP-ONE', duplicate: false, amount: 40000, currency: 'USD' }],
    ['approved', { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-ONE', captureId: 'CAP-ONE', duplicate: false, amount: 40000, currency: 'USD' }],
    ['ready', { type: 'paypal.capture.reconciled', checkpointId: 'journey', captureId: 'CAP-ONE', outcome: 'captured', source: 'sandbox-transaction-lookup' }],
  ];
  for (const [state, event] of invalid) refused(prefix(state), event);
});

test('review: altered receipt money cannot be disguised as an exact duplicate', () => {
  const ledger = prefix();
  ledger.recordWebhook('journey', 'WH-ONE', 'CAP-ONE');
  const first = ledger.events.at(-1);
  for (const change of [{ amount: 1 }, { currency: 'EUR' }, { captureId: 'CAP-OTHER' }, { checkpointId: 'accessibility' }]) {
    const { seq, at, ...event } = first;
    refused(ledger, { ...event, ...change, duplicate: true });
  }
});

test('review: accepted independent capture paths serialize and replay at every prefix', () => {
  for (const paths of [['direct', 'lookup', 'received'], ['received', 'direct', 'lookup'], ['lookup', 'received', 'direct']]) {
    const ledger = createLedger();
    let counted = 0;
    for (const [index, cp] of FIXTURE.checkpoints.entries()) {
      prefix('pending', cp.id, ledger);
      const before = ledger.events.length;
      if (paths[index] !== 'direct') ledger.recordLostCaptureResponse(cp.id);
      if (paths[index] !== 'lookup') ledger.recordWebhook(cp.id, `WH-${cp.id}`, `CAP-${cp.id}`);
      if (paths[index] !== 'direct') ledger.reconcile(cp.id, `CAP-${cp.id}`);
      ledger.recordWebhook(cp.id, `WH-${cp.id}`, `CAP-${cp.id}`);
      ledger.recordWebhook(cp.id, `WH-${cp.id}`, `CAP-${cp.id}`);
      for (let length = before; length <= ledger.events.length; length += 1) {
        const events = ledger.events.slice(0, length);
        const state = reduce(JSON.parse(JSON.stringify(events)));
        assert.ok(Number.isSafeInteger(state.captured));
        assert.ok(state.captured >= 0 && state.captured <= state.total);
        assert.equal(state.captured + state.remaining, state.total);
      }
      counted += cp.amount;
      assert.equal(ledger.snapshot().captured, counted);
      assert.deepEqual(reduce(JSON.parse(JSON.stringify(ledger.events))), ledger.snapshot());
    }
    assert.equal(ledger.snapshot().remaining, 0);
  }
});

test('review: seed admission rejects checkpoint IDs that generate the same fixture order', () => {
  for (const ids of [['journey', 'JOURNEY'], ['ss', '\u00df']]) {
    const seed = structuredClone(FIXTURE);
    seed.checkpoints[0].id = ids[0];
    seed.checkpoints[1].id = ids[1];
    assert.throws(() => createLedger(seed));
    assert.throws(() => reduce([], seed));
  }
  const seed = structuredClone(FIXTURE);
  seed.checkpoints[0].id = 'One';
  seed.checkpoints[1].id = 'Two';
  const ledger = createLedger(seed);
  for (const cp of seed.checkpoints) {
    ledger.approve(cp.id);
    ledger.createOrder(cp.id);
  }
  assert.equal(new Set(Object.values(ledger.snapshot().checkpoints).map(cp => cp.orderId)).size, 3);
});

test('review: event payload accessors cannot execute a nested append while metadata is reserved', () => {
  const ledger = createLedger();
  let invoked = 0;
  const payload = {
    checkpointId: 'journey',
    approver: 'human-reviewer',
    get acceptedEvidence() {
      invoked += 1;
      ledger.approve('accessibility');
      return 'Accepted through a callback';
    },
  };
  assert.throws(() => ledger.append('checkpoint.approved', payload));
  assert.equal(invoked, 0, 'admission must refuse the accessor without invoking it');
  assert.equal(ledger.events.length, 0, 'refused payload leaves the event journal unchanged');
  ledger.approve('journey');
  assert.equal(ledger.events[0].seq, 1);
  assert.equal(ledger.events[0].at, 'T+001');
});
