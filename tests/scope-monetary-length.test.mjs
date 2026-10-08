import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromFixture, validateScopeDraft, createScopeReview } from '../src/scope-plan.mjs';
import { encodeScopeWorkspace, decodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeReviewDocument } from '../src/scope-review-export.mjs';
import { createScopeRevisionDraft } from '../src/scope-revision-draft.mjs';

for (const field of ['cap', 'amount']) {
  test('an overlong ' + field + ' stays editable before any approval can lock it', () => {
    const draft = draftFromFixture();
    if (field === 'cap') draft.cap = draft.cap.padStart(65, '0');
    else draft.checkpoints[1].amount = draft.checkpoints[1].amount.padStart(65, '0');
    const before = structuredClone(draft);
    const result = validateScopeDraft(draft);
    assert.equal(result.ok, false);
    assert.equal(result.seed, null);
    assert.deepEqual(result.errors.map(error => error.field),
      [field === 'cap' ? 'cap' : 'checkpoints.1.amount']);
    assert.match(result.errors[0].message, /64 characters/);
    assert.throws(() => createScopeReview(draft), /64 characters/);
    assert.deepEqual(draft, before);
  });
}

test('normal and 64-character monetary fields survive approval and all three exports', () => {
  const normal = draftFromFixture();
  const padded = draftFromFixture();
  padded.cap = padded.cap.padStart(64, '0');
  padded.checkpoints.forEach(cp => { cp.amount = cp.amount.padStart(64, '0'); });
  const maximum = draftFromFixture();
  maximum.cap = '90071992547409.91'.padStart(64, '0');
  maximum.checkpoints = [{ title: 'Fictional maximum-cent control',
    amount: maximum.cap, evidence: 'One deliberately bounded fictional milestone.' }];
  for (const draft of [normal, padded, maximum]) {
    const before = structuredClone(draft);
    assert.equal(validateScopeDraft(draft).ok, true);
    const review = createScopeReview(draft);
    review.act('scope-1', 'approve', 'Explicitly reviewed fictional evidence.');
    const recorded = review.snapshot();
    const workspace = { draft, review };
    const restored = decodeScopeWorkspace(encodeScopeWorkspace(workspace));
    assert.deepEqual(restored.draft, before);
    assert.deepEqual(restored.review.snapshot(), recorded);
    assert.equal(restored.summary.approved, 1);
    assert.equal(restored.summary.events, 1);
    assert.match(createScopeReviewDocument(workspace), /Explicitly reviewed fictional evidence\./);
    const revision = decodeScopeWorkspace(createScopeRevisionDraft(workspace));
    assert.deepEqual(revision.draft, before);
    assert.equal(revision.summary.stage, 'draft');
    assert.equal(revision.summary.approved, 0);
    assert.equal(revision.summary.events, 0);
    assert.deepEqual(review.snapshot(), recorded);
    assert.deepEqual(draft, before);
  }
});

test('unfinished monetary text within the saved limit remains an exact editable draft', () => {
  const draft = draftFromFixture();
  draft.cap = ' unfinished cap '.padEnd(64, ' ');
  draft.checkpoints[0].amount = ' unfinished amount '.padEnd(64, ' ');
  draft.checkpoints[1].amount = '';
  const before = structuredClone(draft);
  assert.equal(validateScopeDraft(draft).ok, false);
  const restored = decodeScopeWorkspace(encodeScopeWorkspace({ draft }));
  assert.deepEqual(restored.draft, before);
  assert.equal(restored.review, null);
  assert.equal(restored.summary.approved, 0);
  assert.equal(restored.summary.events, 0);
  assert.deepEqual(draft, before);
});
