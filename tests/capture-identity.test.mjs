import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createLedger, replayFixture, reduce, FIXTURE } from '../src/ledger.mjs';

function ready(ledger = createLedger(), checkpointId = 'journey') {
  ledger.approve(checkpointId);
  ledger.createOrder(checkpointId);
  return ledger;
}

function unknown(ledger = createLedger(), checkpointId = 'journey') {
  ready(ledger, checkpointId);
  ledger.recordCaptureAttempt(checkpointId);
  ledger.recordLostCaptureResponse(checkpointId);
  return ledger;
}

function refusedWithoutChange(ledger, action, pattern) {
  const events = JSON.stringify(ledger.events);
  const state = JSON.stringify(ledger.snapshot());
  assert.throws(action, pattern);
  assert.equal(JSON.stringify(ledger.events), events, 'refusal must not append or change an event');
  assert.equal(JSON.stringify(ledger.snapshot()), state, 'refusal must not change the reduced state');
}

test('an unresolved pending capture cannot be requested a second time', () => {
  const ledger = ready();
  ledger.recordCaptureAttempt('journey');
  refusedWithoutChange(ledger, () => ledger.recordCaptureAttempt('journey'), /pending/);
  assert.equal(ledger.events.filter(event => event.type === 'paypal.capture.requested').length, 1);
  ledger.recordWebhook('journey', 'WH-PENDING', 'CAP-PENDING');
  assert.equal(ledger.snapshot().captured, 40000);
});

test('a delayed lost response cannot undo a confirmed capture or be recorded twice', () => {
  const captured = ready();
  captured.recordCaptureAttempt('journey');
  captured.recordWebhook('journey', 'WH-SETTLED', 'CAP-SETTLED');
  refusedWithoutChange(captured, () => captured.recordLostCaptureResponse('journey'), /pending/);
  assert.equal(captured.snapshot().checkpoints.journey.captureStatus, 'captured');
  assert.equal(captured.snapshot().captured, 40000);

  const unresolved = unknown();
  refusedWithoutChange(unresolved, () => unresolved.recordLostCaptureResponse('journey'), /pending/);
  unresolved.reconcile('journey', 'CAP-LOOKUP');
  refusedWithoutChange(unresolved, () => unresolved.recordLostCaptureResponse('journey'), /pending/);
});

test('a webhook event identity cannot be reused for a different capture or checkpoint', () => {
  const ledger = ready();
  ready(ledger, 'accessibility');
  ledger.recordWebhook('journey', 'WH-IDENTITY', 'CAP-JOURNEY');
  refusedWithoutChange(ledger, () => ledger.recordWebhook('journey', 'WH-IDENTITY', 'CAP-CHANGED'), /Webhook event identity conflict/);
  refusedWithoutChange(ledger, () => ledger.recordWebhook('accessibility', 'WH-IDENTITY', 'CAP-SECOND'), /Webhook event identity conflict/);
  ledger.recordWebhook('journey', 'WH-IDENTITY', 'CAP-JOURNEY');
  assert.equal(ledger.events.at(-1).duplicate, true);
  assert.equal(ledger.snapshot().captured, 40000);
});

test('a capture identity cannot count against two different checkpoints', () => {
  const ledger = ready();
  ready(ledger, 'accessibility');
  ledger.recordWebhook('journey', 'WH-FIRST', 'CAP-SHARED');
  refusedWithoutChange(ledger, () => ledger.recordWebhook('accessibility', 'WH-SECOND', 'CAP-SHARED'), /Capture identity conflict/);
  assert.equal(ledger.snapshot().captured, 40000);
  ledger.recordWebhook('accessibility', 'WH-SECOND', 'CAP-SECOND');
  assert.equal(ledger.snapshot().captured, 80000);
});

test('an unknown receipt reserves its capture identity before any amount is counted', () => {
  const ledger = unknown();
  unknown(ledger, 'accessibility');
  ledger.recordWebhook('journey', 'WH-UNKNOWN', 'CAP-OBSERVED');
  assert.equal(ledger.snapshot().captured, 0);
  refusedWithoutChange(ledger, () => ledger.recordWebhook('accessibility', 'WH-OTHER', 'CAP-OBSERVED'), /Capture identity conflict/);
  refusedWithoutChange(ledger, () => ledger.reconcile('accessibility', 'CAP-OBSERVED'), /Capture identity conflict/);
  refusedWithoutChange(ledger, () => ledger.reconcile('journey', 'CAP-DIFFERENT'), /Capture identity conflict/);
  ledger.reconcile('journey', 'CAP-OBSERVED');
  ledger.reconcile('accessibility', 'CAP-OTHER');
  assert.equal(ledger.snapshot().captured, 80000);
});

test('reconciliation and later receipts share the same capture binding', () => {
  const ledger = unknown();
  ledger.reconcile('journey', 'CAP-RECONCILED');
  ready(ledger, 'accessibility');
  refusedWithoutChange(ledger, () => ledger.recordWebhook('accessibility', 'WH-LATE-OTHER', 'CAP-RECONCILED'), /Capture identity conflict/);
  refusedWithoutChange(ledger, () => ledger.recordWebhook('journey', 'WH-LATE-CHANGE', 'CAP-CHANGED'), /Capture identity conflict/);
  ledger.recordWebhook('journey', 'WH-LATE-MATCH', 'CAP-RECONCILED');
  assert.equal(ledger.snapshot().captured, 40000);
  assert.equal(ledger.snapshot().checkpoints.journey.captureId, 'CAP-RECONCILED');
});

test('one checkpoint cannot acquire a second capture through a new webhook event ID', () => {
  const ledger = ready();
  ledger.recordWebhook('journey', 'WH-ONE', 'CAP-ONE');
  refusedWithoutChange(ledger, () => ledger.recordWebhook('journey', 'WH-TWO', 'CAP-TWO'), /Capture identity conflict/);
  ledger.recordWebhook('journey', 'WH-TWO', 'CAP-ONE');
  assert.equal(ledger.events.at(-1).duplicate, false, 'distinct matching provider events remain distinct audit records');
  assert.equal(ledger.snapshot().captured, 40000);
});

test('webhook and reconciliation identities must be nonempty canonical strings', () => {
  for (const invalid of ['', ' ', '\n', ' leading', 'trailing ', null, undefined, 0, {}, ['CAP']]) {
    const ledger = ready();
    refusedWithoutChange(ledger, () => ledger.recordWebhook('journey', invalid, 'CAP-VALID'), /Webhook event ID/);
    refusedWithoutChange(ledger, () => ledger.recordWebhook('journey', 'WH-VALID', invalid), /Capture ID/);
    const unresolved = unknown();
    refusedWithoutChange(unresolved, () => unresolved.reconcile('journey', invalid), /Capture ID/);
  }
});

test('exact duplicate webhook delivery remains auditable in every supported capture state', () => {
  for (const initial of ['ready', 'pending', 'unknown', 'reconciled']) {
    const ledger = ready();
    if (initial !== 'ready') ledger.recordCaptureAttempt('journey');
    if (initial === 'unknown' || initial === 'reconciled') ledger.recordLostCaptureResponse('journey');
    if (initial === 'reconciled') ledger.reconcile('journey', 'CAP-RETRY');
    ledger.recordWebhook('journey', 'WH-RETRY', 'CAP-RETRY');
    const state = ledger.snapshot();
    ledger.recordWebhook('journey', 'WH-RETRY', 'CAP-RETRY');
    assert.deepEqual(ledger.snapshot(), state, initial);
    assert.equal(ledger.events.at(-1).duplicate, true, initial);
    assert.equal(state.captured, initial === 'unknown' ? 0 : 40000, initial);
    if (initial === 'unknown') {
      ledger.reconcile('journey', 'CAP-RETRY');
      assert.equal(ledger.snapshot().captured, 40000);
    }
  }
});

test('the public append path and reducer refuse lifecycle violations too', () => {
  const ledger = ready();
  ledger.recordCaptureAttempt('journey');
  const retry = { checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', environment: 'sandbox' };
  refusedWithoutChange(ledger, () => ledger.append('paypal.capture.requested', retry), /pending/);
  assert.throws(() => reduce([...ledger.events, { ...retry, type: 'paypal.capture.requested' }]), /pending/);

  const complete = replayFixture();
  const late = { checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', outcome: 'unknown' };
  refusedWithoutChange(complete, () => complete.append('paypal.capture.response_lost', late), /pending/);
  assert.throws(() => reduce([...complete.events, { ...late, type: 'paypal.capture.response_lost' }]), /pending/);
});

test('replay derives receipt identity from history instead of trusting a duplicate flag', () => {
  const ledger = ready();
  ledger.recordWebhook('journey', 'WH-REPLAY', 'CAP-REPLAY');
  const first = ledger.events.at(-1);
  assert.throws(() => reduce([...ledger.events, { ...first, duplicate: false }]), /Webhook duplicate marker/);
  assert.throws(() => reduce([...ledger.events, { ...first, captureId: 'CAP-CONFLICT', duplicate: true }]), /Webhook event identity conflict/);
  assert.throws(() => reduce([...ledger.events.slice(0, -1), { ...first, duplicate: true }]), /Webhook duplicate marker/);
  assert.equal(reduce([...ledger.events, { ...first, duplicate: true }]).captured, 40000);
});

test('published events cannot be edited or removed and append owns sequence metadata', () => {
  const ledger = ready();
  const published = ledger.events;
  assert.ok(Object.isFrozen(published));
  assert.ok(published.every(Object.isFrozen));
  assert.throws(() => published.pop(), TypeError);
  assert.throws(() => { published[0].checkpointId = 'accessibility'; }, TypeError);
  refusedWithoutChange(ledger, () => ledger.append('checkpoint.approved', { checkpointId: 'accessibility', acceptedEvidence: 'Checked', approver: 'human-reviewer', type: 'paypal.capture.reconciled' }), /Reserved event metadata/);
  ledger.approve('accessibility');
  assert.equal(published.length, 2, 'a published snapshot stays unchanged after later appends');
  assert.equal(ledger.events.length, 3);
});

test('a ledger keeps its creation seed stable across caller mutation', () => {
  const seed = structuredClone(FIXTURE);
  const ledger = ready(createLedger(seed));
  seed.currency = 'NOT-A-CURRENCY';
  seed.checkpoints[0].amount = 1;
  seed.checkpoints[0].id = 'changed';
  seed.checkpoints.push({ id: 'extra', title: 'Extra', amount: 1, evidence: 'Changed later' });
  ledger.recordWebhook('journey', 'WH-STABLE', 'CAP-STABLE');
  assert.equal(ledger.snapshot().captured, 40000);
  assert.equal(ledger.snapshot().total, 120000);
  assert.equal(ledger.events.at(-1).currency, 'USD');
});

test('inherited object properties are not checkpoint identities', () => {
  // Run the negative control in another process: the original source writes to
  // Object.prototype when handed __proto__, which must not contaminate tests.
  const moduleUrl = new URL('../src/ledger.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {createLedger, reduce} from ${JSON.stringify(moduleUrl)};
    for (const id of ['__proto__', 'constructor', 'toString', '', null, 3]) {
      const ledger = createLedger();
      assert.throws(() => ledger.approve(id, 'Checked'), /Unknown checkpoint/);
      assert.throws(() => ledger.createOrder(id), /Unknown checkpoint/);
      assert.throws(() => ledger.recordCaptureAttempt(id), /Unknown checkpoint/);
      assert.throws(() => ledger.recordLostCaptureResponse(id), /Unknown checkpoint/);
      assert.throws(() => ledger.recordWebhook(id, 'WH-X', 'CAP-X'), /Unknown checkpoint/);
      assert.throws(() => ledger.reconcile(id, 'CAP-X'), /Unknown checkpoint/);
      assert.throws(() => reduce([{type:'checkpoint.approved',checkpointId:id,acceptedEvidence:'Checked',approver:'human-reviewer'}]), /Unknown checkpoint/);
      assert.equal(ledger.events.length, 0);
    }
    assert.equal(Object.hasOwn(Object.prototype, 'approved'), false);
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('three independent checkpoint capture paths compose without double counting', () => {
  for (const first of ['webhook', 'lost-and-webhook', 'lookup-only']) {
    for (const second of ['webhook', 'lost-and-webhook', 'lookup-only']) {
      const ledger = createLedger();
      const paths = [first, second, 'lost-and-webhook'];
      FIXTURE.checkpoints.forEach((cp, index) => {
        ready(ledger, cp.id);
        ledger.recordCaptureAttempt(cp.id);
        const captureId = `CAP-${index}`;
        if (paths[index] !== 'webhook') ledger.recordLostCaptureResponse(cp.id);
        if (paths[index] !== 'lookup-only') {
          ledger.recordWebhook(cp.id, `WH-${index}`, captureId);
          ledger.recordWebhook(cp.id, `WH-${index}`, captureId);
        }
        if (paths[index] !== 'webhook') ledger.reconcile(cp.id, captureId);
        assert.equal(ledger.snapshot().captured, (index + 1) * 40000);
      });
      assert.equal(ledger.snapshot().remaining, 0);
      assert.deepEqual(reduce(ledger.events), ledger.snapshot());
    }
  }
});
