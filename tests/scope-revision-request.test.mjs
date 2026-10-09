import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, reduce } from '../src/ledger.mjs';
import { createScopeReview, validateScopeDraft } from '../src/scope-plan.mjs';
import {
  encodeScopeWorkspace, decodeScopeWorkspace, MAX_WORKSPACE_EVENTS
} from '../src/scope-workspace-record.mjs';
import { createScopeHistory } from '../src/scope-history.mjs';
import { createScopeReviewDocument } from '../src/scope-review-export.mjs';
import { createScopeRevisionDraft } from '../src/scope-revision-draft.mjs';
import { readComparisonWorkspace, compareWorkspaces } from '../src/scope-compare.mjs';

// Independent controls frozen before candidate exposure. These are fictional
// authored workspaces; no provider, browser, persistence shim or alternate
// ledger is used. Expected accounting is integer cents.
const TYPE = 'checkpoint.revision_requested';
const ACTION = 'request_revision';
const reason = ' \nPlease revise <reason> & Ω before acceptance.\n ';
const reviewedEvidence = '\nReviewed </textarea><script>literal</script> e\u0301\n';

function plan() {
  return {
    label: 'Studio Ω — authored scope',
    brief: 'A fictional project.\nKeep literal <b>markup</b> and 🌿.',
    cap: '100.00',
    checkpoints: [
      { title: 'First delivery', amount: '42.05', evidence: 'A reviewed recording.' },
      { title: 'Second delivery', amount: '15.10', evidence: 'A keyboard walkthrough.' },
      { title: 'Third delivery', amount: '20.00', evidence: 'Draft handoff notes.' }
    ]
  };
}

function seed(draft = plan()) {
  const validation = validateScopeDraft(draft);
  assert.equal(validation.ok, true);
  return validation.seed;
}

function payload(overrides = {}) {
  return {
    checkpointId: 'scope-1', reviewer: 'human-reviewer',
    reason, reviewedEvidence, ...overrides
  };
}

function request(review, id = 'scope-1', values = { reason, reviewedEvidence }) {
  return review.act(id, ACTION, values);
}

function checkpoint(review, id = 'scope-1') {
  return review.snapshot().checkpoints.find(row => row.id === id);
}

function unchanged(review, operation) {
  const before = review.snapshot();
  assert.throws(operation, Error);
  assert.deepEqual(review.snapshot(), before);
}

function roundTrip(draft, review, evidenceDrafts = new Map()) {
  const before = review.snapshot();
  const beforeDraft = structuredClone(draft);
  const beforePending = [...evidenceDrafts];
  const encoded = encodeScopeWorkspace({ draft, review, evidenceDrafts });
  const opened = decodeScopeWorkspace(encoded);
  assert.deepEqual(opened.review.snapshot(), before);
  assert.deepEqual(opened.draft, beforeDraft);
  assert.equal(encodeScopeWorkspace(opened), encoded);
  assert.deepEqual(review.snapshot(), before);
  assert.deepEqual(draft, beforeDraft);
  assert.deepEqual([...evidenceDrafts], beforePending);
  return { encoded, opened };
}

function eventFor(seq, fields = payload()) {
  return { seq, type: TYPE, at: 'T+' + String(seq).padStart(3, '0'), ...fields };
}

function ledgerFrom(review) {
  const state = review.snapshot();
  const ledger = createLedger(state.plan);
  for (const event of state.events) {
    const { seq, at, type, ...data } = event;
    ledger.append(type, data);
  }
  assert.deepEqual(ledger.events, state.events);
  return ledger;
}

function htmlText(value) {
  return value.replace(/[&<>"'\r]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    "'": '&#39;', '\r': '&#13;'
  })[character]);
}

test('direct ledger request is one immutable event with no approval or accounting effect', () => {
  const nativeSeed = seed();
  const ledger = createLedger(nativeSeed);
  const before = ledger.snapshot();
  const data = payload();
  const event = ledger.append(TYPE, data);
  assert.deepEqual(event, eventFor(1));
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(ledger.events), true);
  assert.deepEqual(ledger.snapshot(), before);
  assert.deepEqual(reduce(ledger.events, nativeSeed), before);

  data.reason = 'Caller mutation must not alter the event';
  const exposed = ledger.snapshot();
  exposed.checkpoints['scope-1'].approved = true;
  assert.equal(ledger.events[0].reason, reason);
  assert.deepEqual(ledger.snapshot(), before);
  assert.throws(() => ledger.createOrder('scope-1'), /Human approval required/);
  assert.throws(() => ledger.recordCaptureAttempt('scope-1'), /Approved PayPal order required/);
  assert.equal(ledger.events.length, 1);

  assert.throws(() => ledger.append(TYPE, payload()), Error);
  assert.deepEqual(ledger.events, [eventFor(1)]);
  ledger.approve('scope-1', '  Fresh acceptance  ');
  assert.equal(ledger.events[1].seq, 2);
  assert.equal(ledger.events[1].at, 'T+002');
  assert.equal(ledger.events[1].acceptedEvidence, 'Fresh acceptance');
  assert.deepEqual(ledger.events[0], eventFor(1));
});

test('direct admission and reducer refuse invalid new event text, provenance and extra fields atomically', () => {
  const bad = [
    payload({ checkpointId: 'missing' }),
    payload({ reviewer: 'bot' }),
    payload({ reason: '' }),
    payload({ reason: ' \n\t ' }),
    payload({ reason: null }),
    payload({ reason: 7 }),
    payload({ reason: 'x'.repeat(5001) }),
    payload({ reason: 'Reason\r\nnot LF-only' }),
    payload({ reviewedEvidence: undefined }),
    payload({ reviewedEvidence: null }),
    payload({ reviewedEvidence: false }),
    payload({ reviewedEvidence: 'x'.repeat(5001) }),
    payload({ reviewedEvidence: 'Evidence\rnot LF-only' }),
    { ...payload(), acceptedEvidence: 'This must not become an approval' }
  ];
  for (const key of ['checkpointId', 'reviewer', 'reason', 'reviewedEvidence']) {
    const missing = payload();
    delete missing[key];
    bad.push(missing);
  }
  for (const data of bad) {
    const nativeSeed = seed();
    const ledger = createLedger(nativeSeed);
    const before = ledger.snapshot();
    assert.throws(() => ledger.append(TYPE, data), Error);
    assert.throws(() => reduce([eventFor(1, data)], nativeSeed), Error);
    assert.deepEqual(ledger.events, []);
    assert.deepEqual(ledger.snapshot(), before);
    assert.deepEqual(ledger.append(TYPE, payload()), eventFor(1));
  }
  for (const data of [
    { ...payload(), seq: 10 },
    { ...payload(), at: 'T+999' },
    { ...payload(), type: 'checkpoint.approved' }
  ]) {
    const ledger = createLedger(seed());
    assert.throws(() => ledger.append(TYPE, data), /Reserved event metadata/);
    assert.deepEqual(ledger.events, []);
    assert.equal(ledger.append(TYPE, payload()).seq, 1);
  }
});

test('authored action requires its strict two-field payload and preserves state on refusal', () => {
  const inherited = Object.create({ reason });
  inherited.reviewedEvidence = reviewedEvidence;
  const bad = [
    undefined, null, [], 'reason', 1, true,
    {}, { reason }, { reviewedEvidence },
    { reason, reviewedEvidence, extra: true },
    inherited,
    { reason: ' \n ', reviewedEvidence: '' },
    { reason: null, reviewedEvidence: '' },
    { reason: 'x'.repeat(5001), reviewedEvidence: '' },
    { reason: 'Fix\rthis', reviewedEvidence: '' },
    { reason, reviewedEvidence: undefined },
    { reason, reviewedEvidence: 1 },
    { reason, reviewedEvidence: 'x'.repeat(5001) },
    { reason, reviewedEvidence: '\r\n' }
  ];
  for (const values of bad) {
    const review = createScopeReview(plan());
    unchanged(review, () => review.act('scope-1', ACTION, values));
    assert.deepEqual(request(review).events, [eventFor(1)]);
  }
  const review = createScopeReview(plan());
  unchanged(review, () => request(review, 'missing'));
  assert.equal(request(review).events[0].seq, 1);
});

test('exact text, empty reviewed evidence and UTF-16 length boundaries match the declared interface', () => {
  for (const evidence of ['', ' \n\t ', reviewedEvidence]) {
    const draft = plan();
    const review = createScopeReview(draft);
    const values = { reason, reviewedEvidence: evidence };
    request(review, 'scope-1', values);
    values.reason = 'Later caller edit';
    assert.deepEqual(review.snapshot().events, [eventFor(1, payload({ reviewedEvidence: evidence }))]);
    const cp = checkpoint(review);
    assert.equal(cp.approved, false);
    assert.equal(cp.acceptedEvidence, null);
    assert.equal(cp.captureStatus, 'not_started');
    assert.equal(cp.orderId, null);
    assert.equal(cp.captureId, null);
    assert.equal(cp.counted, 0);
    assert.deepEqual(cp.actions, ['approve']);
    roundTrip(draft, review);
  }

  const maxText = '😀'.repeat(2500);
  assert.equal(maxText.length, 5000);
  const review = createScopeReview(plan());
  request(review, 'scope-1', { reason: maxText, reviewedEvidence: maxText });
  assert.equal(review.snapshot().events[0].reason, maxText);
  assert.equal(review.snapshot().events[0].reviewedEvidence, maxText);
  roundTrip(plan(), review);
  for (const values of [
    { reason: maxText + 'x', reviewedEvidence: '' },
    { reason: 'Fix this', reviewedEvidence: maxText + 'x' }
  ]) {
    const other = createScopeReview(plan());
    unchanged(other, () => request(other, 'scope-1', values));
    assert.equal(request(other).events[0].seq, 1);
  }
});

test('one request keeps all payment actions unavailable and later approval has its own evidence', () => {
  const review = createScopeReview(plan());
  assert.equal(checkpoint(review).actions.includes(ACTION), true);
  request(review);
  const savedRequest = structuredClone(review.snapshot().events[0]);
  for (const action of [ACTION, 'order', 'request', 'receipt', 'duplicate', 'lose', 'reconcile']) {
    unchanged(review, () => review.act('scope-1', action, { reason, reviewedEvidence }));
  }
  assert.equal(review.snapshot().approved, 0);
  assert.equal(review.snapshot().captured, 0);
  assert.equal(review.snapshot().remaining, 7715);
  assert.equal(review.snapshot().unallocated, 2285);
  review.act('scope-1', 'approve', ' \nA later explicit acceptance\n ');
  assert.equal(review.snapshot().events[1].seq, 2);
  assert.equal(checkpoint(review).acceptedEvidence, 'A later explicit acceptance');
  assert.deepEqual(checkpoint(review).actions, ['order']);
  assert.deepEqual(review.snapshot().events[0], savedRequest);
  assert.equal(review.snapshot().captured, 0);
  review.act('scope-1', 'order');
  assert.equal(checkpoint(review).captureStatus, 'ready');
  assert.equal(review.snapshot().captured, 0);
});

test('request after approval refuses in every existing payment phase in facade, append and reduce', () => {
  const phases = [
    [],
    ['order'],
    ['order', 'request'],
    ['order', 'request', 'lose'],
    ['order', 'request', 'lose', 'receipt', 'duplicate'],
    ['order', 'request', 'receipt'],
    ['order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile']
  ];
  for (const route of phases) {
    const review = createScopeReview(plan());
    review.act('scope-1', 'approve', 'Approved before attempted request');
    for (const action of route) review.act('scope-1', action);
    unchanged(review, () => request(review));
    const ledger = ledgerFrom(review);
    const before = ledger.snapshot();
    const events = structuredClone(ledger.events);
    assert.throws(() => ledger.append(TYPE, payload()), Error);
    assert.throws(() => reduce([...events, eventFor(events.length + 1)], review.snapshot().plan), Error);
    assert.deepEqual(ledger.events, events);
    assert.deepEqual(ledger.snapshot(), before);
    // A refused request must not consume the next logical sequence.
    const other = ledger.append(TYPE, payload({ checkpointId: 'scope-3' }));
    assert.equal(other.seq, events.length + 1);
    assert.equal(other.at, 'T+' + String(events.length + 1).padStart(3, '0'));
  }
});

test('all 32 prefixes of request plus the four ordinary capture routes round-trip exactly', () => {
  const routes = [
    ['approve', 'order', 'request', 'receipt', 'duplicate'],
    ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile'],
    ['approve', 'order', 'request', 'lose', 'reconcile'],
    ['approve', 'order', 'request', 'lose', 'receipt', 'reconcile', 'duplicate']
  ];
  let prefixes = 0;
  for (const route of routes) {
    const draft = plan();
    const review = createScopeReview(draft);
    const actions = [ACTION, ...route];
    for (let i = 0; i <= actions.length; i += 1) {
      const { opened } = roundTrip(draft, review);
      prefixes += 1;
      if (i < actions.length) {
        const action = actions[i];
        const argument = action === ACTION ? { reason, reviewedEvidence }
          : action === 'approve' ? 'Fresh explicit evidence' : undefined;
        assert.deepEqual(opened.review.act('scope-1', action, argument),
          review.act('scope-1', action, argument));
      }
    }
    assert.deepEqual(review.snapshot().events[0], eventFor(1));
    assert.equal(review.snapshot().captured, 4205);
  }
  assert.equal(prefixes, 32);
});

test('mixed checkpoint request and unknown capture preserve exact 1510/6205 accounting', () => {
  const draft = plan();
  const review = createScopeReview(draft);
  request(review);
  const retained = structuredClone(review.snapshot().events[0]);
  assert.equal(review.snapshot().approved, 0);
  assert.equal(review.snapshot().total, 7715);
  assert.equal(review.snapshot().captured, 0);
  assert.equal(review.snapshot().remaining, 7715);
  assert.equal(review.snapshot().unallocated, 2285);
  for (const action of ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate']) {
    review.act('scope-2', action, 'Second checkpoint accepted');
    roundTrip(draft, review);
    assert.deepEqual(review.snapshot().events[0], retained);
    assert.equal(checkpoint(review).approved, false);
    assert.equal(checkpoint(review).captureStatus, 'not_started');
    assert.equal(review.snapshot().captured, 0);
  }
  assert.equal(checkpoint(review, 'scope-2').captureStatus, 'unknown');
  assert.equal(review.snapshot().approved, 1);
  unchanged(review, () => review.act('scope-2', 'request'));
  review.act('scope-2', 'reconcile');
  assert.equal(review.snapshot().captured, 1510);
  assert.equal(review.snapshot().remaining, 6205);
  assert.equal(review.snapshot().unallocated, 2285);
  assert.equal(checkpoint(review, 'scope-3').approved, false);
  unchanged(review, () => review.act('scope-2', 'reconcile'));
  roundTrip(draft, review);
  assert.deepEqual(review.snapshot().events[0], retained);
});

test('original ordinary version-1 wire records reopen and re-encode without new fields', () => {
  const draft = plan();
  const legacy = {
    schema: 'scopesignal.scope-workspace', version: 1,
    fixtureOnly: true, paymentEvidence: false, stage: 'review', draft,
    events: [
      { seq: 1, type: 'checkpoint.approved', at: 'T+001',
        checkpointId: 'scope-1', approver: 'human-reviewer', acceptedEvidence: 'Legacy accepted evidence' },
      { seq: 2, type: 'paypal.order.created', at: 'T+002',
        checkpointId: 'scope-1', orderId: 'SANDBOX-SCOPE-1',
        amount: 4205, currency: 'USD', environment: 'sandbox' }
    ],
    evidenceDrafts: [{ checkpointId: 'scope-3', text: '\nUnapproved old pending text\n' }]
  };
  const contents = JSON.stringify(legacy, null, 2) + '\n';
  const opened = decodeScopeWorkspace(contents);
  assert.equal(encodeScopeWorkspace(opened), contents);
  assert.deepEqual(opened.review.snapshot().events, legacy.events);
  assert.equal(opened.review.snapshot().approved, 1);
  assert.equal(opened.review.snapshot().captured, 0);
  assert.equal(opened.review.snapshot().remaining, 7715);
  assert.equal(checkpoint(opened.review).acceptedEvidence, 'Legacy accepted evidence');
  assert.deepEqual(checkpoint(opened.review).actions, ['request']);
  assert.equal(opened.evidenceDrafts.get('scope-3'), '\nUnapproved old pending text\n');

  const oldDraft = { ...legacy, stage: 'draft', events: [], evidenceDrafts: [] };
  oldDraft.draft = { ...draft, label: '  ', cap: 'unfinished' };
  const rawDraft = JSON.stringify(oldDraft, null, 2) + '\n';
  const restoredDraft = decodeScopeWorkspace(rawDraft);
  assert.equal(restoredDraft.review, null);
  assert.equal(encodeScopeWorkspace(restoredDraft), rawDraft);
});

test('recorded request, current pending text and later acceptance remain distinct in history and HTML', () => {
  const draft = plan();
  const review = createScopeReview(draft);
  const pending = new Map([['scope-1', 'Current pending evidence — not the reviewed snapshot'],
    ['scope-3', '\nOther checkpoint remains pending\n']]);
  const beforeRequest = encodeScopeWorkspace({ draft, review, evidenceDrafts: pending });
  request(review);
  const record = structuredClone(review.snapshot().events[0]);
  const { encoded, opened } = roundTrip(draft, review, pending);
  assert.deepEqual([...opened.evidenceDrafts], [...pending]);
  pending.set('scope-1', 'Later unrecorded evidence edit');
  const changedPending = roundTrip(draft, review, pending).encoded;
  assert.deepEqual(decodeScopeWorkspace(changedPending).review.snapshot().events[0], record);

  const history = createScopeHistory(changedPending);
  const zero = history.step(0);
  assert.equal(zero.event, null);
  assert.equal(JSON.stringify(zero).includes(JSON.stringify(reason)), false);
  assert.equal(JSON.stringify(zero).includes(JSON.stringify(reviewedEvidence)), false);
  const requestStep = history.step(1);
  assert.equal(typeof requestStep.label, 'string');
  assert.ok(requestStep.label.length > 0);
  assert.equal(typeof requestStep.description, 'string');
  assert.ok(requestStep.description.length > 0);
  assert.deepEqual(requestStep.event, record);
  assert.equal(requestStep.snapshot.approved, 0);
  assert.equal(requestStep.snapshot.captured, 0);
  assert.equal(requestStep.checkpoints[0].acceptedEvidence, null);
  assert.equal(JSON.stringify(requestStep).includes('Later unrecorded evidence edit'), false);

  const html = createScopeReviewDocument({ draft, review, evidenceDrafts: pending });
  for (const [key, value] of [['reason', reason], ['reviewedEvidence', reviewedEvidence]]) {
    assert.ok(html.includes('<dt>' + key + '</dt><dd>' + htmlText(value) + '</dd>'));
  }
  assert.ok(html.includes('<dt>Pending evidence — not approved</dt><dd>Later unrecorded evidence edit</dd>'));
  assert.equal(html.includes('<dt>Accepted evidence — from recorded approval</dt>'), false);
  assert.equal(/<script\b|<iframe\b|<img\b|<form\b|<button\b/i.test(html), false);
  assert.ok(html.includes('Fictional snapshot · no live payments'));
  assert.equal(encodeScopeWorkspace({ draft, review, evidenceDrafts: pending }), changedPending);

  const left = readComparisonWorkspace(beforeRequest);
  const right = readComparisonWorkspace(encoded);
  assert.deepEqual(right.events, [record]);
  const compared = compareWorkspaces(left, right);
  assert.equal(compared.history.kind, 'a-prefix');
  assert.equal(compared.history.commonEvents, 0);
  assert.equal(compared.history.rightEvents, 1);
  assert.ok(compared.rows.every(row => row.changed === false));

  review.act('scope-1', 'approve', '  Later acceptance is separate  ');
  const accepted = roundTrip(draft, review, pending);
  assert.equal(accepted.opened.evidenceDrafts.has('scope-1'), false);
  assert.equal(accepted.opened.evidenceDrafts.get('scope-3'), pending.get('scope-3'));
  const afterHistory = createScopeHistory(accepted.encoded);
  assert.deepEqual(afterHistory.step(1).event, record);
  assert.equal(afterHistory.step(1).checkpoints[0].acceptedEvidence, null);
  assert.equal(afterHistory.step(2).checkpoints[0].acceptedEvidence, 'Later acceptance is separate');
  assert.deepEqual(review.snapshot().events[0], record);
  const acceptedHtml = createScopeReviewDocument({ draft, review, evidenceDrafts: pending });
  assert.ok(acceptedHtml.includes('<dt>Accepted evidence — from recorded approval</dt><dd>Later acceptance is separate</dd>'));
  assert.ok(acceptedHtml.includes('<dt>reviewedEvidence</dt><dd>' + htmlText(reviewedEvidence) + '</dd>'));
  assert.equal(acceptedHtml.includes('Later unrecorded evidence edit'), false);
});

test('new event replay rejects forged facts before history and permits only honest unsigned claims', () => {
  const draft = plan();
  const review = createScopeReview(draft);
  request(review);
  const valid = encodeScopeWorkspace({ draft, review });
  const record = JSON.parse(valid);
  const changes = [
    event => { event.reviewer = 'bot'; },
    event => { event.checkpointId = 'missing'; },
    event => { event.reason = ''; },
    event => { event.reason = 'Reason\rtext'; },
    event => { event.reason = 'x'.repeat(5001); },
    event => { event.reviewedEvidence = null; },
    event => { event.reviewedEvidence = 'Text\r\n'; },
    event => { event.reviewedEvidence = 'x'.repeat(5001); },
    event => { event.seq = 2; },
    event => { event.at = 'T+002'; },
    event => { event.acceptedEvidence = 'Forged acceptance'; },
    event => { event.type = 'checkpoint.rejected'; }
  ];
  for (const key of Object.keys(record.events[0])) {
    changes.push(event => { delete event[key]; });
  }
  for (const change of changes) {
    const edited = structuredClone(record);
    change(edited.events[0]);
    const raw = JSON.stringify(edited);
    assert.throws(() => decodeScopeWorkspace(raw), Error);
    assert.throws(() => createScopeHistory(raw), Error);
    assert.equal(encodeScopeWorkspace({ draft, review }), valid);
  }
  const repeated = structuredClone(record);
  repeated.events.push(eventFor(2));
  assert.throws(() => decodeScopeWorkspace(JSON.stringify(repeated)), Error);
  const laterBad = structuredClone(record);
  laterBad.events.push({ seq: 2, type: 'checkpoint.approved', at: 'T+002',
    checkpointId: 'scope-2', approver: 'bot', acceptedEvidence: 'Bad later fact' });
  assert.throws(() => createScopeHistory(JSON.stringify(laterBad)), Error);

  // Files are unsigned fictional claims. Valid text replacement and harmless
  // object key order are not evidence of identity and must not be called fraud.
  const changedClaim = structuredClone(record);
  changedClaim.events[0].reason = 'A different internally consistent fictional reason';
  changedClaim.events[0] = Object.fromEntries(Object.entries(changedClaim.events[0]).reverse());
  const reopened = decodeScopeWorkspace(JSON.stringify(changedClaim));
  assert.equal(reopened.review.snapshot().events[0].reason, changedClaim.events[0].reason);
  assert.equal(reopened.review.snapshot().approved, 0);
  assert.equal(changedClaim.fixtureOnly, true);
  assert.equal(changedClaim.paymentEvidence, false);
});

test('request alone does not enable clean revision draft and later approval retains the original guard', () => {
  const draft = plan();
  const review = createScopeReview(draft);
  request(review);
  const evidenceDrafts = new Map([['scope-1', 'Unrecorded current evidence']]);
  const workspace = { draft, review, evidenceDrafts };
  const before = encodeScopeWorkspace(workspace);
  assert.throws(() => createScopeRevisionDraft(workspace), /after the first checkpoint/);
  assert.equal(encodeScopeWorkspace(workspace), before);
  review.act('scope-2', 'approve', 'Fresh second-checkpoint acceptance');
  const accepted = encodeScopeWorkspace(workspace);
  const revision = decodeScopeWorkspace(createScopeRevisionDraft(workspace));
  assert.deepEqual(revision.draft, draft);
  assert.equal(revision.review, null);
  assert.equal(revision.summary.stage, 'draft');
  assert.equal(revision.summary.approved, 0);
  assert.equal(revision.summary.events, 0);
  assert.equal(revision.evidenceDrafts.size, 0);
  assert.equal(encodeScopeWorkspace(workspace), accepted);
  assert.deepEqual(review.snapshot().events[0], eventFor(1));
});

test('twelve once-only requests and full existing routes fit all 96 event positions without increasing limits', () => {
  assert.equal(MAX_WORKSPACE_EVENTS, 96);
  const draft = {
    label: 'Twelve request controls', brief: 'Fictional bounded review only.', cap: '0.13',
    checkpoints: Array.from({ length: 12 }, (_, index) => ({
      title: 'Repeated title', amount: '0.01', evidence: 'Planned ' + index
    }))
  };
  const review = createScopeReview(draft);
  let observed = 0;
  roundTrip(draft, review);
  for (let index = 1; index <= 12; index += 1) {
    const id = 'scope-' + index;
    const actions = [ACTION, 'approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile'];
    for (const action of actions) {
      review.act(id, action, action === ACTION
        ? { reason: 'Revise ' + index, reviewedEvidence: '' }
        : action === 'approve' ? 'Fresh accepted ' + index : undefined);
      observed += 1;
      const result = roundTrip(draft, review);
      assert.equal(result.opened.summary.events, observed);
      assert.equal(review.snapshot().events.at(-1).seq, observed);
    }
  }
  assert.equal(observed, 96);
  const final = review.snapshot();
  assert.equal(final.events.filter(event => event.type === TYPE).length, 12);
  assert.equal(final.approved, 12);
  assert.equal(final.captured, 12);
  assert.equal(final.remaining, 0);
  assert.equal(final.unallocated, 1);
  for (let index = 1; index <= 12; index += 1) {
    unchanged(review, () => request(review, 'scope-' + index));
  }
  const over = JSON.parse(encodeScopeWorkspace({ draft, review }));
  over.events.push(eventFor(97));
  assert.throws(() => decodeScopeWorkspace(JSON.stringify(over)), /history.*large/);
  assert.deepEqual(review.snapshot(), final);
});
