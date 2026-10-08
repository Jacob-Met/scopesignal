import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE } from '../src/ledger.mjs';
import { MAX_CHECKPOINTS, draftFromFixture, parseDollars, formatUSD, draftBudget, validateScopeDraft, createScopeReview } from '../src/scope-plan.mjs';

function customDraft() {
  return {
    label: '  Fictional garden identity  ',
    brief: 'Create an identity and an accessible event poster for a fictional garden.',
    cap: '1500.50',
    checkpoints: [
      { title: 'Identity concepts', amount: '600.25', evidence: 'Two concepts with a written selection rationale.' },
      { title: 'Accessible event poster', amount: '700.00', evidence: 'Print and screen proofs plus contrast measurements.' }
    ]
  };
}

function act(session, id, ...actions) {
  for (const action of actions) session.act(id, action);
}

test('the example becomes a detached editable draft, with no inherited approvals', () => {
  const original = structuredClone(FIXTURE);
  const draft = draftFromFixture();
  draft.label = 'Changed draft';
  draft.checkpoints[0].title = 'Changed deliverable';
  assert.deepEqual(FIXTURE, original);
  const state = createScopeReview(draft).snapshot();
  assert.equal(state.plan.label, 'Changed draft');
  assert.equal(state.approved, 0);
  assert.equal(state.captured, 0);
  assert.deepEqual(state.events, []);
  assert(state.checkpoints.every(cp => cp.captureStatus === 'not_started'));
});

test('an authored brief and checkpoints produce a bounded ledger seed and explicit unallocated cap', () => {
  const draft = customDraft();
  const result = validateScopeDraft(draft);
  assert.equal(result.ok, true);
  assert.equal(result.seed.label, 'Fictional garden identity');
  assert.equal(result.seed.currency, 'USD');
  assert.equal(result.seed.amount, 150050);
  assert.deepEqual(result.seed.checkpoints.map(cp => [cp.id, cp.amount]), [['scope-1', 60025], ['scope-2', 70000]]);
  assert.deepEqual(draftBudget(draft), { cap: 150050, allocated: 130025, unallocated: 20025 });
  const state = createScopeReview(draft).snapshot();
  assert.equal(state.total, 130025);
  assert.equal(state.remaining, 130025);
  assert.equal(state.unallocated, 20025);
});

test('incomplete, malformed and over-cap drafts cannot enter review', () => {
  for (const transform of [
    draft => { draft.label = '  '; },
    draft => { draft.brief = ''; },
    draft => { draft.cap = '1000'; },
    draft => { draft.checkpoints[0].title = ''; },
    draft => { draft.checkpoints[0].evidence = '\n '; },
    draft => { draft.checkpoints[0].amount = '5.001'; },
    draft => { draft.checkpoints = []; },
    draft => { draft.checkpoints = Array.from({ length: MAX_CHECKPOINTS + 1 }, () => ({ title: 'x', amount: '1', evidence: 'y' })); }
  ]) {
    const draft = customDraft();
    transform(draft);
    const before = structuredClone(draft);
    const result = validateScopeDraft(draft);
    assert.equal(result.ok, false);
    assert.equal(result.seed, null);
    assert(result.errors.length > 0);
    assert.throws(() => createScopeReview(draft));
    assert.deepEqual(draft, before);
  }
});

test('field errors identify the actual editable checkpoint and budget', () => {
  const draft = customDraft();
  draft.cap = '10';
  draft.checkpoints[1].evidence = '';
  const fields = validateScopeDraft(draft).errors.map(error => error.field);
  assert.deepEqual(fields, ['checkpoints.1.evidence', 'cap']);
  assert.equal(validateScopeDraft(null).ok, false);
});

test('USD authoring rejects unsupported notation and avoids silently rounding sub-cent entries', () => {
  assert.equal(parseDollars(' 007.10 '), 710);
  assert.equal(parseDollars('0.01'), 1);
  assert.equal(parseDollars('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  for (const value of ['0', '-1', '5.001', '1e3', 'NaN', 'Infinity', '$20', '1,000', '', '90071992547409.92', 2, null]) {
    assert.equal(parseDollars(value), null, String(value));
  }
  const draft = customDraft();
  draft.checkpoints[0].amount = 'not an amount';
  assert.equal(draftBudget(draft).allocated, null);
});

test('generated identities remain distinct when titles match or resemble object keys', () => {
  const draft = customDraft();
  draft.checkpoints[0].title = '__proto__';
  draft.checkpoints[1].title = '__proto__';
  const review = createScopeReview(draft);
  review.act('scope-1', 'approve', 'Accepted first checkpoint');
  assert.equal(review.snapshot().checkpoints[1].approved, false);
  assert.throws(() => review.act('__proto__', 'approve', 'wrong identity'), /Unknown checkpoint/);
});

test('every accepted safe cent amount is displayed without floating-dollar rounding', () => {
  for (const [input, expected] of [
    ['90071992547409.91', '$90,071,992,547,409.91'],
    ['70368744177664.01', '$70,368,744,177,664.01'],
    ['0.01', '$0.01'], ['500.25', '$500.25']
  ]) assert.equal(formatUSD(parseDollars(input)), expected);
  assert.equal(formatUSD(0), '$0.00');
  assert.equal(formatUSD(-501), '-$5.01');
  assert.throws(() => formatUSD(Number.MAX_SAFE_INTEGER + 1), /safe integer cents/);
});

test('sparse or absent checkpoint rows are refused as incomplete drafts', () => {
  for (const checkpoints of [new Array(1), [undefined], [null]]) {
    const draft = { ...customDraft(), checkpoints };
    const result = validateScopeDraft(draft);
    assert.equal(result.ok, false);
    assert(result.errors.some(error => error.field === 'checkpoints.0.title'));
    assert.equal(draftBudget(draft).allocated, null);
    assert.throws(() => createScopeReview(draft), /Checkpoint 1 title is required/);
  }
});

test('approval uses the explicit reviewed evidence and refuses empty acceptance without any event', () => {
  const review = createScopeReview(customDraft());
  const before = review.snapshot();
  assert.throws(() => review.act('scope-1', 'approve', '\n '), /Acceptance evidence is required/);
  assert.deepEqual(review.snapshot(), before);
  review.act('scope-1', 'approve', '  Reviewed\n<literal> & “quoted” evidence 😀  ');
  const state = review.snapshot();
  assert.equal(state.checkpoints[0].acceptedEvidence, 'Reviewed\n<literal> & “quoted” evidence 😀');
  assert.equal(state.events[0].acceptedEvidence, state.checkpoints[0].acceptedEvidence);
  assert.equal(state.checkpoints[1].acceptedEvidence, null);
  assert.equal(state.captured, 0);
});

test('plan, approval evidence and prior events cannot be changed through caller-owned objects', () => {
  const draft = customDraft();
  const review = createScopeReview(draft);
  review.act('scope-1', 'approve', 'Agreed evidence');
  const saved = review.snapshot();
  draft.cap = '1';
  draft.checkpoints[0].title = 'Mutated';
  const exposed = review.snapshot();
  exposed.plan.checkpoints[0].amount = 1;
  exposed.checkpoints[0].approved = false;
  exposed.events[0].acceptedEvidence = 'Changed later';
  exposed.events.push({ type: 'invented' });
  assert.deepEqual(review.snapshot(), saved);
});

test('review controls advance one legal event at a time and do not repeat pending requests', () => {
  const review = createScopeReview(customDraft());
  assert.throws(() => review.act('scope-1', 'order'), /not available/);
  review.act('scope-1', 'approve', 'Evidence reviewed');
  assert.deepEqual(review.snapshot().checkpoints[0].actions, ['order']);
  review.act('scope-1', 'order');
  assert.deepEqual(review.snapshot().checkpoints[0].actions, ['request']);
  review.act('scope-1', 'request');
  const pending = review.snapshot();
  assert.deepEqual(pending.checkpoints[0].actions, ['receipt', 'lose']);
  for (const action of ['request', 'order', 'approve', 'reconcile', 'invented']) {
    assert.throws(() => review.act('scope-1', action, 'again'), /not available/);
    assert.deepEqual(review.snapshot(), pending);
  }
});

test('the authored lost-response path stays unknown through duplicate receipt and reconciles exactly once', () => {
  const review = createScopeReview(customDraft());
  review.act('scope-1', 'approve', 'Reviewed identity concepts');
  act(review, 'scope-1', 'order', 'request', 'lose', 'receipt', 'duplicate');
  const unknown = review.snapshot();
  assert.equal(unknown.events.length, 6);
  assert.equal(unknown.checkpoints[0].captureStatus, 'unknown');
  assert.equal(unknown.captured, 0);
  assert.deepEqual(unknown.checkpoints[0].actions, ['reconcile']);
  assert.equal(unknown.events[4].eventId, unknown.events[5].eventId);
  assert.equal(unknown.events[5].duplicate, true);
  assert.throws(() => review.act('scope-1', 'request'), /not available/);
  review.act('scope-1', 'reconcile');
  const captured = review.snapshot();
  assert.equal(captured.events.length, 7);
  assert.equal(captured.captured, 60025);
  assert.equal(captured.checkpoints[0].captureStatus, 'captured');
  assert.equal(captured.events[6].captureId, captured.events[4].captureId);
  assert.deepEqual(captured.checkpoints[0].actions, []);
  assert.throws(() => review.act('scope-1', 'reconcile'), /not available/);
  assert.deepEqual(review.snapshot(), captured);
});

test('independent checkpoints keep their amounts and receipt identities across mixed outcomes', () => {
  const review = createScopeReview(customDraft());
  review.act('scope-1', 'approve', 'First checkpoint accepted');
  act(review, 'scope-1', 'order', 'request', 'receipt', 'duplicate');
  review.act('scope-2', 'approve', 'Second checkpoint accepted');
  act(review, 'scope-2', 'order', 'request', 'lose', 'receipt');
  const mixed = review.snapshot();
  assert.equal(mixed.approved, 2);
  assert.equal(mixed.captured, 60025);
  assert.equal(mixed.remaining, 70000);
  const receipts = mixed.events.filter(event => event.type === 'paypal.webhook.received' && !event.duplicate);
  assert.notEqual(receipts[0].eventId, receipts[1].eventId);
  assert.notEqual(receipts[0].captureId, receipts[1].captureId);
  review.act('scope-2', 'reconcile');
  const final = review.snapshot();
  assert.equal(final.captured, 130025);
  assert.equal(final.remaining, 0);
  assert.equal(final.unallocated, 20025);
  assert.equal(final.plan.amount, 150050);
});

test('an unknown outcome can use the explicit simulated lookup without manufacturing a webhook', () => {
  const review = createScopeReview(customDraft());
  review.act('scope-1', 'approve', 'Reviewed');
  act(review, 'scope-1', 'order', 'request', 'lose', 'reconcile');
  const state = review.snapshot();
  assert.equal(state.captured, 60025);
  assert.equal(state.events.some(event => event.type === 'paypal.webhook.received'), false);
  assert.deepEqual(state.checkpoints[0].actions, []);
});
