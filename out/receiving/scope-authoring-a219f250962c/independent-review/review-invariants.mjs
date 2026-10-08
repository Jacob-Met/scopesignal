import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = resolve(process.env.SCOPESIGNAL_REVIEW_SOURCE || process.argv[2]);
const model = await import(pathToFileURL(resolve(source, 'src/scope-plan.mjs')));
const seedDraft = () => ({
  label: 'Independent acceptance review', brief: 'Two unequal milestones, reviewed explicitly.', cap: '15.00',
  checkpoints: [
    { title: '__proto__', amount: '0.01', evidence: 'First accepted proof' },
    { title: 'constructor', amount: '13.37', evidence: 'Second accepted proof' },
  ],
});
const ALL_ACTIONS = ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile'];

test('all reachable two-checkpoint combinations preserve approval, accounting and receipt custody', () => {
  const queue = [[]];
  const seen = new Set();
  let transitions = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const path = queue[cursor];
    const review = model.createScopeReview(seedDraft());
    for (const [id, action] of path) review.act(id, action, `Accepted ${id}`);
    const state = review.snapshot();
    const signature = JSON.stringify(state.checkpoints.map(cp => state.events.filter(event => event.checkpointId === cp.id).map(event => event.type)));
    if (seen.has(signature)) continue;
    seen.add(signature);
    const accounted = state.checkpoints.reduce((sum, cp) => sum + BigInt(cp.counted), 0n);
    assert.equal(BigInt(state.captured), accounted);
    assert.equal(state.total, 1338);
    assert.equal(state.unallocated, 162);
    assert.equal(state.remaining, 1338 - state.captured);
    assert(state.captured >= 0 && state.captured <= state.total && state.total <= state.plan.amount);
    assert.equal(state.approved, state.checkpoints.filter(cp => cp.approved).length);
    assert.deepEqual(state.events.map(event => event.seq), state.events.map((_, index) => index + 1));
    const captureOwners = new Map();
    const eventOwners = new Map();
    for (const event of state.events) {
      const local = state.events.filter(e => e.checkpointId === event.checkpointId);
      assert.equal(local[0].type, 'checkpoint.approved');
      assert.equal(local.filter(e => e.type === 'checkpoint.approved').length, 1);
      if (event.captureId) {
        assert([undefined, event.checkpointId].includes(captureOwners.get(event.captureId)));
        captureOwners.set(event.captureId, event.checkpointId);
      }
      if (event.eventId) {
        const prior = eventOwners.get(event.eventId);
        assert.equal(event.duplicate, prior !== undefined);
        if (prior) assert.deepEqual(prior, [event.checkpointId, event.captureId, event.amount]);
        eventOwners.set(event.eventId, [event.checkpointId, event.captureId, event.amount]);
      }
    }
    for (const cp of state.checkpoints) {
      if (cp.captureStatus === 'unknown') assert.equal(cp.counted, 0);
      if (cp.captureStatus === 'captured') {
        assert.equal(cp.approved, true);
        assert.equal(cp.counted, cp.amount);
      } else assert.equal(cp.counted, 0);
      assert.equal(cp.acceptedEvidence, cp.approved ? `Accepted ${cp.id}` : null);
      for (const action of ALL_ACTIONS) {
        if (cp.actions.includes(action)) {
          queue.push([...path, [cp.id, action]]);
          transitions++;
        } else {
          assert.throws(() => review.act(cp.id, action, 'Attempted overwrite'));
          assert.deepEqual(review.snapshot(), state, 'Refusal must preserve every prior event and field.');
        }
      }
    }
    for (const badId of ['__proto__', 'constructor', 'toString', 'scope-0', 'scope-13', undefined]) {
      assert.throws(() => review.act(badId, 'approve', 'Unexpected approval'));
      assert.deepEqual(review.snapshot(), state);
    }
  }
  assert.equal(seen.size, 169, 'All thirteen per-checkpoint histories pair independently.');
  console.log(JSON.stringify({ reachableCheckpointPairs: seen.size, legalTransitions: transitions }));
});

test('the full checkpoint limit has distinct identities even with hostile duplicate supplied IDs and titles', () => {
  const draft = seedDraft();
  draft.cap = '0.12';
  draft.checkpoints = Array.from({ length: 12 }, (_, index) => ({
    id: index % 2 ? '__proto__' : 'scope-1', title: 'same title', amount: '0.01', evidence: `Proof ${index}`,
  }));
  const review = model.createScopeReview(draft);
  const ids = review.snapshot().checkpoints.map(cp => cp.id);
  assert.equal(new Set(ids).size, 12);
  for (const [index, id] of ids.entries()) {
    for (const action of ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile']) {
      review.act(id, action, `Agreed proof ${index}`);
    }
  }
  const state = review.snapshot();
  assert.equal(state.captured, 12);
  assert.equal(state.remaining, 0);
  const captures = state.checkpoints.map(cp => cp.captureId);
  assert.equal(new Set(captures).size, 12);
  const receipts = state.events.filter(event => event.type === 'paypal.webhook.received' && !event.duplicate);
  assert.equal(new Set(receipts.map(event => event.eventId)).size, 12);
  assert.deepEqual(state.checkpoints.map(cp => cp.acceptedEvidence), ids.map((_, index) => `Agreed proof ${index}`));
});

test('cent parsing and rendering agree with decimal integer arithmetic across precision boundaries', () => {
  const cents = new Set([0n, 1n, 99n, 100n, 101n, 9007199254740991n, 9007199254740992n]);
  for (const exponent of [40n, 41n, 42n, 43n, 44n, 45n, 46n, 47n, 48n, 49n, 50n, 51n, 52n, 53n]) {
    for (let offset = -101n; offset <= 101n; offset++) cents.add((1n << exponent) + offset);
  }
  for (const value of cents) {
    const decimal = `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
    const valid = value > 0n && value <= 9007199254740991n;
    assert.equal(model.parseDollars(decimal), valid ? Number(value) : null, decimal);
    if (value <= 9007199254740991n && typeof model.formatUSD === 'function') {
      const grouped = String(value / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      assert.equal(model.formatUSD(Number(value)), `$${grouped}.${String(value % 100n).padStart(2, '0')}`, decimal);
    }
  }
  console.log(JSON.stringify({ independentDecimalCases: cents.size }));
});

test('sparse checkpoint input is refused before it can claim a valid ledger seed', () => {
  for (const rows of [new Array(1), [seedDraft().checkpoints[0], , seedDraft().checkpoints[1]]]) {
    const draft = { ...seedDraft(), checkpoints: rows };
    assert.equal(model.validateScopeDraft(draft).ok, false);
    assert.equal(model.validateScopeDraft(draft).seed, null);
    assert.equal(model.draftBudget(draft).allocated, null);
    assert.throws(() => model.createScopeReview(draft), /required|positive/i);
  }
});
