import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReview, draftFromFixture } from '../src/scope-plan.mjs';
import { encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import {
  readComparisonWorkspace, sameDefinitionPairs, validatePairing,
  pairCheckpoint, compareWorkspaces, checkpointFields
} from '../src/scope-compare.mjs';

const original = () => structuredClone(draftFromFixture());
function workspace(draft = original(), actions = null, pending = new Map()) {
  const review = actions === null ? null : createScopeReview(draft);
  for (const [id, action, evidence] of actions ?? []) review.act(id, action, evidence);
  return encodeScopeWorkspace({ draft, review, evidenceDrafts: pending });
}
const read = (...args) => readComparisonWorkspace(workspace(...args));
const rowField = (comparison, name) => comparison.rows[0].fields.find(f => f.key === name);
const lifecycle = [
  ['scope-1', 'approve', 'Reviewed recording'],
  ['scope-1', 'order'],
  ['scope-1', 'request'],
  ['scope-1', 'lose'],
  ['scope-1', 'receipt'],
  ['scope-1', 'duplicate'],
  ['scope-1', 'reconcile']
];

test('unfinished strings remain literal and invalid amounts stay unknown', () => {
  const draft = original();
  draft.label = '';
  draft.brief = '  <img src=x onerror=alert(1)>\n雪  ';
  draft.cap = 'not decided';
  draft.checkpoints[0] = { title: '  Draft  ', amount: '', evidence: '\nPending\n' };
  const a = read(draft), b = read(draft);
  assert.deepEqual(a.draft, draft);
  assert.equal(a.totals.cap, null);
  assert.equal(a.totals.allocated, null);
  assert.equal(a.rows[0].amountCents, null);
  assert.equal(a.rows[0].approved, null);
  assert.equal(a.rows[0].counted, null);
  assert.equal(compareWorkspaces(a, b).history.kind, 'not-reviewed');
  assert.equal(checkpointFields(a.rows[0]).find(f => f.key === 'plannedEvidence').value, '\nPending\n');
});

test('accepted and empty pending evidence retain their native meanings', () => {
  assert.throws(() => read(original(), [['scope-1', 'approve', '']]), /required/);
  const a = read(original(), [['scope-1', 'approve', 'Accepted proof']], new Map([
    ['scope-1', 'unrecorded later text'],
    ['scope-2', '']
  ]));
  assert.equal(a.rows[0].approved, true);
  assert.equal(a.rows[0].acceptedEvidence, 'Accepted proof');
  assert.equal(a.rows[0].pendingEvidence, null);
  assert.equal(a.rows[1].approved, false);
  assert.equal(a.rows[1].acceptedEvidence, null);
  assert.equal(a.rows[1].pendingEvidence, '');
  const b = read(original(), [], new Map([['scope-1', 'not accepted']]));
  const c = compareWorkspaces(a, b);
  assert.equal(rowField(c, 'acceptedEvidence').left, 'Accepted proof');
  assert.equal(rowField(c, 'acceptedEvidence').right, null);
  assert.equal(rowField(c, 'pendingEvidence').right, 'not accepted');
});

test('all real lifecycle prefixes retain exact history and capture accounting', () => {
  const full = read(original(), lifecycle);
  assert.equal(full.totals.captured, 40000);
  for (let length = 0; length <= lifecycle.length; length++) {
    const prefix = read(original(), lifecycle.slice(0, length));
    const c = compareWorkspaces(prefix, full);
    assert.equal(c.history.kind, length === lifecycle.length ? 'equal' : 'a-prefix');
    assert.equal(c.history.commonEvents, length);
    assert.equal(compareWorkspaces(full, prefix).history.kind, length === lifecycle.length ? 'equal' : 'b-prefix');
    if (length >= 4 && length < 7) {
      assert.equal(prefix.rows[0].captureStatus, 'unknown');
      assert.equal(prefix.totals.captured, 0);
    }
  }
  assert.equal(full.rows[0].counted, 40000);
});

test('different accepted facts produce divergent histories under the same plan', () => {
  const a = read(original(), [['scope-1', 'approve', 'Recording A']]);
  const b = read(original(), [['scope-1', 'approve', 'Recording B']]);
  const c = compareWorkspaces(a, b);
  assert.equal(c.history.kind, 'divergent');
  assert.equal(c.history.commonEvents, 0);
  assert.equal(rowField(c, 'acceptedEvidence').changed, true);
});

test('different plans never gain a common history from positional IDs or manual pairing', () => {
  const draft = original();
  draft.checkpoints[0].title = 'An unrelated first deliverable';
  const a = read(original(), lifecycle), b = read(draft, lifecycle);
  assert.equal(a.plan.checkpoints[0].id, b.plan.checkpoints[0].id);
  assert.equal(compareWorkspaces(a, b, [[0, 0], [1, 1], [2, 2]]).history.kind, 'different-plans');
  assert.equal(compareWorkspaces(a, b, [[0, 0]]).history.commonEvents, null);
});

test('same-definition pairing follows unique literal content across row numbers', () => {
  const draft = original();
  draft.checkpoints.reverse();
  const a = read(), b = read(draft);
  assert.deepEqual(sameDefinitionPairs(a, b), [[0, 2], [1, 1], [2, 0]]);
  const c = compareWorkspaces(a, b);
  assert.equal(c.rows[0].sameDefinition, true);
  assert.equal(c.rows[0].differentRowNumbers, true);
  assert.equal(c.rows[0].changed, false);
  assert.equal(c.unpairedLeft.length + c.unpairedRight.length, 0);
});

test('duplicate definitions and titles never force a positional pairing', () => {
  const draft = original();
  draft.checkpoints = [draft.checkpoints[0], structuredClone(draft.checkpoints[0])];
  const a = read(draft), b = read(draft);
  assert.deepEqual(sameDefinitionPairs(a, b), []);
  const c = compareWorkspaces(a, b);
  assert.equal(c.unpairedLeft.length, 2);
  assert.equal(c.unpairedRight.length, 2);
  const distinct = original();
  distinct.checkpoints[1].title = distinct.checkpoints[0].title;
  assert.equal(sameDefinitionPairs(read(distinct), read()).some(([left]) => left === 1), false);
});

test('inserting or removing a row leaves explicit unpaired definitions', () => {
  const draft = original();
  draft.checkpoints.splice(1, 0, { title: 'New scope', amount: '25.00', evidence: 'New proof' });
  const c = compareWorkspaces(read(), read(draft));
  assert.deepEqual(c.rows.map(row => [row.leftIndex, row.rightIndex]), [[0, 0], [1, 2], [2, 3]]);
  assert.deepEqual(c.unpairedRight.map(row => row.index), [1]);
  assert.equal(c.unpairedRight[0].title, 'New scope');
  const reversed = compareWorkspaces(read(draft), read());
  assert.deepEqual(reversed.unpairedLeft.map(row => row.index), [1]);
});

test('manual pairing is injective, reversible, and leaves caller choices intact', () => {
  const a = read(), b = read(), initial = sameDefinitionPairs(a, b);
  const initialCopy = structuredClone(initial);
  assert.throws(() => pairCheckpoint(a, b, initial, 0, 1), /only once/);
  const released = pairCheckpoint(a, b, initial, 1, null);
  const paired = pairCheckpoint(a, b, released, 0, 1);
  assert.deepEqual(paired, [[0, 1], [2, 2]]);
  assert.deepEqual(initial, initialCopy);
  assert.deepEqual(pairCheckpoint(a, b, paired, 0, null), [[2, 2]]);
  assert.equal(compareWorkspaces(a, b, paired).rows[0].sameDefinition, false);
});

test('malformed pairing maps are refused before comparison', () => {
  const a = read(), b = read();
  for (const value of [null, {}, [[0]], [[0, 0, 1]], [[-1, 0]], [[0, 3]],
    [['0', 0]], [[0, false]], [[0.5, 0]], [[NaN, 0]], [[0, 0], [0, 1]],
    [[0, 0], [1, 0]], Array(1)]) {
    assert.throws(() => validatePairing(a, b, value));
    assert.throws(() => compareWorkspaces(a, b, value));
  }
  assert.throws(() => pairCheckpoint(a, b, [], 0, undefined));
});

test('textual amount changes remain visible even when parsed cents agree', () => {
  const draft = original();
  draft.checkpoints[0].amount = '400';
  const c = compareWorkspaces(read(), read(draft), [[0, 0]]);
  assert.equal(c.rows[0].sameDefinition, false);
  assert.equal(rowField(c, 'amountText').changed, true);
  assert.equal(rowField(c, 'amountCents').changed, false);
});

test('money fields preserve native safe cents without a lossy difference calculation', () => {
  const a = original(), b = original();
  a.cap = '90071992547409.91';
  b.cap = '90071992547409.90';
  a.checkpoints = [{ title: 'One', amount: '0.01', evidence: 'Proof' }];
  b.checkpoints = structuredClone(a.checkpoints);
  const c = compareWorkspaces(read(a), read(b));
  const cap = c.totals.find(f => f.key === 'cap');
  assert.equal(cap.left, 9007199254740991);
  assert.equal(cap.right, 9007199254740990);
  assert.equal(cap.changed, true);
});

test('the original strict decoder refuses changed envelope and event facts', () => {
  const valid = workspace(original(), lifecycle);
  const variants = [];
  for (const mutate of [
    record => { record.version = 2; },
    record => { record.paymentEvidence = true; },
    record => { record.extra = 'not supported'; },
    record => { record.events[1].amount += 1; },
    record => { record.events[0].acceptedEvidence = 'tampered after later events'; record.events[0].seq = 2; },
    record => { record.draft.checkpoints[0].amount = '401.00'; }
  ]) {
    const record = JSON.parse(valid); mutate(record); variants.push(JSON.stringify(record));
  }
  for (const contents of ['{', ...variants]) assert.throws(() => readComparisonWorkspace(contents));
  assert.throws(() => readComparisonWorkspace(' '.repeat(1024 * 1024 + 1)));
  assert.throws(() => readComparisonWorkspace(JSON.stringify({ ...JSON.parse(valid), draft: { ...JSON.parse(valid).draft, brief: '雪'.repeat(400000) } })));
});

test('draft and review quantities remain distinguishable, including zero events', () => {
  const draft = read(), reviewed = read(original(), []);
  const c = compareWorkspaces(draft, reviewed);
  assert.equal(c.history.kind, 'not-reviewed');
  const approvals = c.totals.find(f => f.key === 'approved');
  assert.equal(approvals.left, null);
  assert.equal(approvals.right, 0);
  assert.equal(c.rows[0].fields.find(f => f.key === 'approved').right, false);
});

test('canonical history checks ignore JSON field order but retain exact event values', () => {
  const encoded = workspace(original(), lifecycle);
  const record = JSON.parse(encoded);
  record.events = record.events.map(event => Object.fromEntries(Object.entries(event).reverse()));
  const a = readComparisonWorkspace(encoded), b = readComparisonWorkspace(JSON.stringify(record));
  assert.equal(compareWorkspaces(a, b).history.kind, 'equal');
  const changed = original(); changed.label = '  ' + changed.label + '  ';
  const c = compareWorkspaces(a, read(changed, lifecycle));
  assert.equal(c.project.find(f => f.key === 'label').changed, true);
  assert.equal(c.history.kind, 'equal');
});

test('read and compare return immutable values without mutating live source review', () => {
  const draft = original(), review = createScopeReview(draft);
  review.act('scope-1', 'approve', 'Original accepted text');
  const before = review.snapshot();
  const encoded = encodeScopeWorkspace({ draft, review });
  const a = readComparisonWorkspace(encoded), b = readComparisonWorkspace(encoded);
  const c = compareWorkspaces(a, b);
  assert.throws(() => { a.rows[0].title = 'Changed'; }, TypeError);
  assert.throws(() => { a.events[0].acceptedEvidence = 'Changed'; }, TypeError);
  assert.throws(() => { c.rows[0].fields[0].left = 'Changed'; }, TypeError);
  assert.equal('review' in a, false);
  assert.deepEqual(review.snapshot(), before);
  assert.deepEqual(draft, original());
});

