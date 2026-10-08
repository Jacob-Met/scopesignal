import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReview } from '../src/scope-plan.mjs';
import { decodeScopeWorkspace, encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeRevisionDraft, SCOPE_REVISION_FILENAME } from '../src/scope-revision-draft.mjs';

function terms() {
  return {
    label: '  Atelier Δ — revision  ',
    brief: 'Original brief\nKeep this exact line.  ',
    cap: ' 00100.0 ',
    checkpoints: [
      { title: '  Design <draft>  ', amount: '00040.00', evidence: 'Planned proof A\nSecond line  ' },
      { title: 'Delivery & review', amount: ' 30.0 ', evidence: 'Original planned proof B' }
    ]
  };
}

function approved() {
  const draft = terms();
  const review = createScopeReview(draft);
  review.act('scope-1', 'approve', 'Accepted result A — different from its plan');
  const evidenceDrafts = new Map([
    ['scope-1', 'A stale editor value is not accepted evidence'],
    ['scope-2', 'Pending result B — not the planned evidence']
  ]);
  return { draft, review, evidenceDrafts };
}

function originalState(workspace) {
  return {
    draft: structuredClone(workspace.draft),
    snapshot: workspace.review?.snapshot() ?? null,
    evidenceDrafts: [...workspace.evidenceDrafts]
  };
}

function inspect(workspace) {
  const before = originalState(workspace);
  const original = encodeScopeWorkspace(workspace);
  const contents = createScopeRevisionDraft(workspace);
  const record = JSON.parse(contents);
  assert.deepEqual(originalState(workspace), before);
  assert.equal(encodeScopeWorkspace(workspace), original);
  assert.deepEqual(record.draft, workspace.draft);
  assert.equal(record.stage, 'draft');
  assert.equal(record.schema, 'scopesignal.scope-workspace');
  assert.equal(record.version, 1);
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.paymentEvidence, false);
  assert.deepEqual(record.events, []);
  assert.deepEqual(record.evidenceDrafts, []);
  const reopened = decodeScopeWorkspace(contents);
  assert.equal(reopened.review, null);
  assert.equal(reopened.summary.approved, 0);
  assert.equal(reopened.summary.events, 0);
  assert.equal(reopened.evidenceDrafts.size, 0);
  assert.deepEqual(reopened.draft, workspace.draft);
  return { record, contents, reopened };
}

test('revision retains raw original terms, order and amount spelling, not accepted or pending evidence', () => {
  const workspace = approved();
  const { record, contents } = inspect(workspace);
  assert.equal(SCOPE_REVISION_FILENAME, 'scopesignal-revision-draft-v1.json');
  assert.equal(record.draft.cap, ' 00100.0 ');
  assert.equal(record.draft.checkpoints[0].evidence, 'Planned proof A\nSecond line  ');
  assert.equal(contents.includes('Accepted result A'), false);
  assert.equal(contents.includes('Pending result B'), false);
  assert.equal(contents.includes('stale editor'), false);
  assert.equal(contents.endsWith('\n'), true);
});

for (const [name, actions] of [
  ['approved', []],
  ['order ready', ['order']],
  ['pending capture', ['order', 'request']],
  ['unknown capture', ['order', 'request', 'lose']],
  ['unknown with duplicate receipts', ['order', 'request', 'lose', 'receipt', 'duplicate']],
  ['reconciled capture', ['order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile']],
  ['direct captured receipt', ['order', 'request', 'receipt', 'duplicate']]
]) {
  test('revision from ' + name + ' preserves the original current history and creates no inherited events', () => {
    const workspace = approved();
    for (const action of actions) workspace.review.act('scope-1', action);
    const original = workspace.review.snapshot();
    const { reopened } = inspect(workspace);
    const fresh = createScopeReview(reopened.draft);
    const state = fresh.snapshot();
    assert.equal(state.approved, 0);
    assert.equal(state.captured, 0);
    assert.equal(state.events.length, 0);
    assert.ok(state.checkpoints.every(cp => cp.acceptedEvidence === null
      && cp.captureStatus === 'not_started'
      && JSON.stringify(cp.actions) === '["approve"]'));
    assert.throws(() => fresh.act('scope-1', 'order'), /not available/);
    fresh.act('scope-1', 'approve', 'Fresh explicit approval');
    assert.equal(fresh.snapshot().events.length, 1);
    assert.equal(fresh.snapshot().checkpoints[0].acceptedEvidence, 'Fresh explicit approval');
    assert.deepEqual(workspace.review.snapshot(), original);
  });
}

test('unapproved reviews and editable drafts refuse a revision and retain their state', () => {
  const draft = terms();
  for (const review of [null, createScopeReview(draft)]) {
    const workspace = { draft, review, evidenceDrafts: new Map() };
    const before = originalState(workspace);
    assert.throws(() => createScopeRevisionDraft(workspace), /after the first checkpoint/);
    assert.deepEqual(originalState(workspace), before);
  }
});

test('a reopened approved workspace produces the same revision and the existing format can open it again', () => {
  const workspace = approved();
  workspace.review.act('scope-1', 'order');
  workspace.review.act('scope-1', 'request');
  workspace.review.act('scope-1', 'lose');
  const expected = createScopeRevisionDraft(workspace);
  const admitted = decodeScopeWorkspace(encodeScopeWorkspace(workspace));
  assert.equal(createScopeRevisionDraft(admitted), expected);
  assert.equal(encodeScopeWorkspace(decodeScopeWorkspace(expected)), expected);
});

test('original source terms may be frozen and repeated revision downloads stay identical', () => {
  const workspace = approved();
  for (const checkpoint of workspace.draft.checkpoints) Object.freeze(checkpoint);
  Object.freeze(workspace.draft.checkpoints);
  Object.freeze(workspace.draft);
  const first = inspect(workspace);
  assert.equal(createScopeRevisionDraft(workspace), first.contents);
  first.reopened.draft.checkpoints[0].title = 'Edit in a new copy';
  assert.equal(workspace.draft.checkpoints[0].title, '  Design <draft>  ');
  assert.equal(createScopeRevisionDraft(workspace), first.contents);
});

test('current review/terms inconsistency refuses before producing a derivative', () => {
  const workspace = approved();
  workspace.draft.checkpoints[0].amount = '39.00';
  const before = originalState(workspace);
  assert.throws(() => createScopeRevisionDraft(workspace), /match/);
  assert.deepEqual(originalState(workspace), before);
});

test('invalid pending evidence or current event facts are not silently discarded to create a revision', () => {
  const workspace = approved();
  workspace.evidenceDrafts.set('scope-2', 'x'.repeat(5001));
  assert.throws(() => createScopeRevisionDraft(workspace), /5000/);
  workspace.evidenceDrafts.set('scope-2', 'valid pending note');
  const snapshot = workspace.review.snapshot();
  snapshot.events[0].checkpointId = 'missing-checkpoint';
  const invalid = { ...workspace, review: { snapshot: () => structuredClone(snapshot) } };
  assert.throws(() => createScopeRevisionDraft(invalid), /checkpoint/);
  assert.equal(snapshot.events[0].checkpointId, 'missing-checkpoint');
});

test('existing JSON-preservable Unicode, NUL and lone-surrogate draft text remain exact', () => {
  const workspace = approved();
  workspace.draft.label = '\uFEFFAtelier 😀';
  workspace.draft.brief = 'Combining e\u0301\nNUL \0 and lone \uD800 are draft text';
  workspace.draft.checkpoints[0].evidence = 'Original \u2028 proof \u2029 \uDFFF';
  workspace.review = createScopeReview(workspace.draft);
  workspace.review.act('scope-1', 'approve', 'Ordinary accepted text');
  const { contents } = inspect(workspace);
  const utf8 = new TextEncoder().encode(contents);
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(utf8);
  assert.deepEqual(decodeScopeWorkspace(decoded).draft, workspace.draft);
});

test('all twelve reordered checkpoint definitions and maximum admitted text remain original terms', () => {
  const draft = {
    label: 'L'.repeat(120), brief: 'B'.repeat(8000), cap: '12.00',
    checkpoints: Array.from({ length: 12 }, (_, i) => ({
      title: String(12 - i) + ' ' + 'T'.repeat(156),
      amount: '01.00',
      evidence: String(i) + '\n' + 'E'.repeat(4996)
    }))
  };
  const review = createScopeReview(draft);
  for (let i = 1; i <= 12; i++) {
    for (const action of ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile']) {
      review.act('scope-' + i, action, 'Accepted ' + i);
    }
  }
  const workspace = { draft, review, evidenceDrafts: new Map() };
  const before = review.snapshot();
  assert.equal(before.events.length, 84);
  assert.equal(before.captured, 1200);
  const { record } = inspect(workspace);
  assert.equal(record.draft.checkpoints.length, 12);
  assert.deepEqual(record.draft.checkpoints.map(cp => cp.title), draft.checkpoints.map(cp => cp.title));
});
