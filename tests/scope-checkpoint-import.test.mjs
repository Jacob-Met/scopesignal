import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReview } from '../src/scope-plan.mjs';
import { encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { readCheckpointSource, selectCheckpointDefinitions } from '../src/scope-checkpoint-import.mjs';

const draft = () => ({
  label: 'Saved terms — fictional', brief: 'Original source brief', cap: '0500.00',
  checkpoints: [
    { title: '  <proof> & layout  ', amount: '00125.50', evidence: 'Planned line 1\nPlanned line 2' },
    { title: 'Caption', amount: '25.00', evidence: 'Original caption evidence' },
    { title: 'Package', amount: '010.00', evidence: 'Original archive manifest' }
  ]
});
const asSource = value => readCheckpointSource(encodeScopeWorkspace({ draft: value }));

test('reviewed source yields only exact original checkpoint definition strings', () => {
  const original = draft();
  const review = createScopeReview(original);
  review.act('scope-1', 'approve', 'ACCEPTED text must not become planned evidence');
  review.act('scope-1', 'order');
  review.act('scope-1', 'request');
  review.act('scope-1', 'lose');
  const raw = encodeScopeWorkspace({ draft: original, review,
    evidenceDrafts: new Map([['scope-2', 'PENDING note must not transfer']]) });
  const source = readCheckpointSource(raw);
  assert.deepEqual(Object.keys(source), ['label', 'stage', 'checkpoints']);
  assert.equal(source.stage, 'review');
  assert.deepEqual(source.checkpoints, original.checkpoints);
  assert.deepEqual(selectCheckpointDefinitions(source, [2, 0], 2), [original.checkpoints[0], original.checkpoints[2]]);
  assert.equal(review.snapshot().approved, 1);
  assert.equal(review.snapshot().events.length, 4);
});

test('unfinished amounts, empty strings, surrounding spaces and LF evidence remain literal', () => {
  const original = draft();
  original.label = ''; original.cap = 'still deciding';
  original.checkpoints[0] = { title: '', amount: 'not set', evidence: '' };
  original.checkpoints[1].evidence = '  First line\n\nLast line  ';
  const source = asSource(original);
  assert.equal(source.stage, 'draft');
  assert.deepEqual(selectCheckpointDefinitions(source, [1, 0], 1), original.checkpoints.slice(0, 2));
});

test('equal rows are distinct selections and source order overrides selection order', () => {
  const original = draft();
  original.checkpoints[2] = { ...original.checkpoints[0] };
  const source = asSource(original);
  const result = selectCheckpointDefinitions(source, [2, 0], 3);
  assert.equal(result.length, 2);
  assert.deepEqual(result, [original.checkpoints[0], original.checkpoints[2]]);
  assert.notEqual(result[0], result[1]);
});

test('returned rows can be edited without altering admitted source or other copies', () => {
  const source = asSource(draft());
  const before = JSON.stringify(source);
  assert.equal(Object.isFrozen(source), true);
  assert.equal(Object.isFrozen(source.checkpoints), true);
  assert.equal(Object.isFrozen(source.checkpoints[0]), true);
  const result = selectCheckpointDefinitions(source, [0], 2);
  result[0].title = 'New destination title';
  assert.equal(JSON.stringify(source), before);
  assert.equal(selectCheckpointDefinitions(source, [0], 2)[0].title, draft().checkpoints[0].title);
});

test('the complete append must fit the existing 12-checkpoint limit', () => {
  const source = asSource(draft());
  assert.equal(selectCheckpointDefinitions(source, [1, 2], 10).length, 2);
  assert.throws(() => selectCheckpointDefinitions(source, [0, 1, 2], 10), /at most 12/);
  assert.throws(() => selectCheckpointDefinitions(source, [0], 12), /at most 12/);
  assert.deepEqual(source.checkpoints, draft().checkpoints);
});

test('empty, repeated, unknown or malformed selections are refused as a whole', () => {
  const source = asSource(draft());
  for (const value of [[], [0, 0], [-1], [3], [0.5], [true], ['0'], null, {}]) {
    assert.throws(() => selectCheckpointDefinitions(source, value, 1));
  }
  for (const count of [0, 13, 1.5, '1']) {
    assert.throws(() => selectCheckpointDefinitions(source, [0], count));
  }
});

test('workspace admission still rejects unsupported records and inconsistent review history', () => {
  const original = draft();
  const record = JSON.parse(encodeScopeWorkspace({ draft: original }));
  for (const mutate of [value => { value.version = 2; }, value => { value.paymentEvidence = true; },
    value => { value.draft.checkpoints[0].approved = true; },
    value => { value.events = [{ type: 'checkpoint.approved' }]; }]) {
    const bad = structuredClone(record); mutate(bad);
    assert.throws(() => readCheckpointSource(JSON.stringify(bad)));
  }
  const review = createScopeReview(original);
  review.act('scope-1', 'approve', 'Approved fixture proof');
  const bad = JSON.parse(encodeScopeWorkspace({ draft: original, review }));
  bad.events[0].checkpointId = 'scope-99';
  assert.throws(() => readCheckpointSource(JSON.stringify(bad)));
});
