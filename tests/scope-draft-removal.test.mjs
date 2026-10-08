import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftRemovalRecovery } from '../src/scope-draft-removal.mjs';
import { MAX_CHECKPOINTS, validateScopeDraft } from '../src/scope-plan.mjs';

const checkpoint = n => ({ title: 'Deliverable ' + n, amount: '1.00', evidence: 'Evidence ' + n });
const rows = n => Array.from({ length: n }, (_, index) => checkpoint(index + 1));

test('removed fields return at their original position with later survivor edits intact', () => {
  const recovery = createDraftRemovalRecovery();
  const original = rows(3);
  original[1] = { title: '  literal <row> 🧭  ', amount: 'unfinished', evidence: 'line one\n<&> line two' };
  const before = structuredClone(original);
  const removed = recovery.remove(original, 1);
  assert.deepEqual(original, before);
  assert.equal(recovery.available, true);
  removed.checkpoints[0].title = 'Revised surviving deliverable';
  removed.checkpoints[1].evidence = 'Revised surviving evidence';
  original[1].title = 'External mutation does not change the retained copy';
  const restored = recovery.restore(removed.checkpoints);
  assert.equal(restored.index, 1);
  assert.deepEqual(restored.checkpoints, [removed.checkpoints[0], before[1], removed.checkpoints[1]]);
  assert.notEqual(restored.checkpoints[0], removed.checkpoints[0]);
  assert.equal(recovery.available, false);
  assert.equal(recovery.restore(removed.checkpoints), null);
});

test('every admitted row position restores without changing order or fields', () => {
  for (let count = 2; count <= MAX_CHECKPOINTS; count += 1) {
    for (let index = 0; index < count; index += 1) {
      const recovery = createDraftRemovalRecovery(), original = rows(count);
      const removed = recovery.remove(original, index);
      assert.deepEqual(removed.checkpoints, original.filter((_, i) => i !== index));
      assert.deepEqual(recovery.restore(removed.checkpoints), { checkpoints: original, index });
    }
  }
});

test('a newer removal replaces the older recovery, without resurrecting both rows', () => {
  const recovery = createDraftRemovalRecovery(), original = rows(4);
  const first = recovery.remove(original, 1);
  const second = recovery.remove(first.checkpoints, 2);
  const restored = recovery.restore(second.checkpoints);
  assert.deepEqual(restored, { checkpoints: [original[0], original[2], original[3]], index: 2 });
  assert.equal(recovery.available, false);
});

test('clear retires recovery at controller lifecycle boundaries', () => {
  const recovery = createDraftRemovalRecovery();
  const removed = recovery.remove(rows(3), 0);
  recovery.clear();
  assert.equal(recovery.available, false);
  assert.equal(recovery.restore(removed.checkpoints), null);
  recovery.clear();
  assert.equal(recovery.available, false);
});

test('last-row, out-of-range and malformed removal requests make no change', () => {
  const recovery = createDraftRemovalRecovery();
  for (const current of [[], rows(1), rows(MAX_CHECKPOINTS + 1), null, [{ title: 'x', amount: 1, evidence: 'x' }, checkpoint(2)]]) {
    const before = structuredClone(current);
    assert.equal(recovery.remove(current, 0), null);
    assert.deepEqual(current, before);
  }
  for (const index of [-1, 3, 0.5, NaN, Infinity, '1', null]) assert.equal(recovery.remove(rows(3), index), null);
  assert.equal(recovery.available, false);
});

test('invalid extra actions do not replace a valid pending removal', () => {
  const recovery = createDraftRemovalRecovery(), original = rows(3);
  const removed = recovery.remove(original, 1);
  assert.equal(recovery.remove(removed.checkpoints, 7), null);
  assert.equal(recovery.remove(rows(1), 0), null);
  assert.deepEqual(recovery.restore(removed.checkpoints).checkpoints, original);
});

test('restoration refuses an incompatible row count and keeps caller input intact', () => {
  const recovery = createDraftRemovalRecovery();
  recovery.remove(rows(3), 1);
  for (const current of [rows(1), rows(3), rows(MAX_CHECKPOINTS), null]) {
    const before = structuredClone(current);
    assert.equal(recovery.restore(current), null);
    assert.deepEqual(current, before);
  }
  recovery.clear();
  assert.equal(recovery.restore(rows(2)), null);
});

test('restored unfinished values still face unchanged scope validation', () => {
  const recovery = createDraftRemovalRecovery(), original = rows(2);
  original[1].amount = 'unfinished';
  const removed = recovery.remove(original, 1);
  const validDraft = { label: 'Fictional project', brief: 'Describe the work', cap: '10.00', checkpoints: removed.checkpoints };
  assert.equal(validateScopeDraft(validDraft).ok, true);
  const restored = recovery.restore(removed.checkpoints);
  const validation = validateScopeDraft({ ...validDraft, checkpoints: restored.checkpoints });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some(error => error.field === 'checkpoints.1.amount'));
  assert.equal(restored.checkpoints[1].amount, 'unfinished');
});
