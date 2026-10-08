import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Independently authored by root. Consume the real serializer, review commands,
// and revision producer from an explicit frozen source root; no implementation
// substitutions or browser mocks are used by this direct lifecycle receiver.
const root = resolve(process.argv[2]);
const mod = name => import(pathToFileURL(resolve(root, 'src', name)).href);
const { createScopeRevisionDraft, SCOPE_REVISION_FILENAME } = await mod('scope-revision-draft.mjs');
const { createScopeReview } = await mod('scope-plan.mjs');
const { encodeScopeWorkspace, decodeScopeWorkspace } = await mod('scope-workspace-record.mjs');
let assertions = 0;
const equal = (actual, expected, why) => { assertions++; assert.deepEqual(actual, expected, why); };
const refuses = (action, why) => { assertions++; assert.throws(action, undefined, why); };
const sourcePins = ['scope-revision-draft.mjs', 'scope-workspace.mjs',
  'scope-workspace-record.mjs', 'scope-plan.mjs', 'ledger.mjs'].map(name => {
  const bytes = readFileSync(resolve(root, 'src', name));
  return { path: 'src/' + name, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') };
});
const draft = {
  label: '  Atlas / 北極星  ',
  brief: '  First line\n第二行\n  third line with trailing spaces  ',
  cap: ' 00100.50 ',
  checkpoints: [
    { title: '  Zeta first  ', amount: '0007.50', evidence: ' ORIGINAL_A\n planned first ' },
    { title: 'あ second', amount: ' 010.00 ', evidence: 'ORIGINAL_B\nplanned second' },
    { title: 'Ω third ', amount: '12.5', evidence: ' ORIGINAL_C ' },
    { title: 'Final fourth', amount: '0.01', evidence: 'ORIGINAL_D\nplanned fourth' }
  ]
};
const review = createScopeReview(draft);
review.act('scope-1', 'approve', 'REVIEW_ACCEPTED_ONE changed from planned terms');
review.act('scope-1', 'order');
review.act('scope-1', 'request');
review.act('scope-1', 'lose');
review.act('scope-2', 'approve', 'REVIEW_ACCEPTED_TWO independent decision');
review.act('scope-2', 'order');
review.act('scope-2', 'request');
review.act('scope-2', 'receipt');
review.act('scope-2', 'duplicate');
review.act('scope-3', 'approve', 'REVIEW_ACCEPTED_THREE approval only');
const evidenceDrafts = new Map([['scope-4', 'PENDING_REVIEW_NOTE\nnot part of original planned terms']]);
const workspace = { draft, review, evidenceDrafts };
const originalBytes = encodeScopeWorkspace(workspace);
const originalMemory = JSON.stringify({ draft, snapshot: review.snapshot(), pending: [...evidenceDrafts] });
const originalUnchanged = () => {
  equal(encodeScopeWorkspace(workspace), originalBytes, 'original saved file stays byte-identical');
  equal(JSON.stringify({ draft, snapshot: review.snapshot(), pending: [...evidenceDrafts] }),
    originalMemory, 'original in-memory draft, ledger and pending note stay exact');
};
const groups = [];
const group = (name, fn) => {
  const before = assertions;
  fn();
  groups.push({ name, assertions: assertions - before, result: 'pass' });
};

group('mixed review states derive an admitted original-terms draft', () => {
  equal(review.snapshot().checkpoints.map(c => c.captureStatus),
    ['unknown', 'captured', 'not_started', 'not_started']);
  equal(review.snapshot().approved, 3);
  const bytes = createScopeRevisionDraft(workspace);
  const record = JSON.parse(bytes);
  const opened = decodeScopeWorkspace(bytes);
  equal(SCOPE_REVISION_FILENAME, 'scopesignal-revision-draft-v1.json');
  equal(record.draft, draft, 'all entered strings and checkpoint order survive without trimming');
  equal(record.stage, 'draft');
  equal(record.events, []);
  equal(record.evidenceDrafts, []);
  equal(record.fixtureOnly, true);
  equal(record.paymentEvidence, false);
  equal(opened.review, null);
  equal(opened.evidenceDrafts.size, 0);
  equal(opened.summary.approved, 0);
  equal(opened.summary.events, 0);
  equal(opened.draft.checkpoints.map(c => c.title), draft.checkpoints.map(c => c.title));
  equal(bytes.includes('REVIEW_ACCEPTED'), false);
  equal(bytes.includes('PENDING_REVIEW_NOTE'), false);
  equal(encodeScopeWorkspace(opened), bytes, 'normal decoder and saver accept the downloaded record');
  originalUnchanged();
});

group('reopened revision requires new decisions and can change independently', () => {
  const opened = decodeScopeWorkspace(createScopeRevisionDraft(workspace));
  opened.draft.label = 'Second proposal';
  opened.draft.checkpoints.reverse();
  opened.draft.checkpoints[0].title = 'Revised final checkpoint now first';
  const next = createScopeReview(opened.draft);
  equal(next.snapshot().approved, 0);
  equal(next.snapshot().events, []);
  equal(next.snapshot().checkpoints.map(c => c.captureStatus),
    ['not_started', 'not_started', 'not_started', 'not_started']);
  refuses(() => next.act('scope-1', 'request'), 'old payment state cannot authorize a capture');
  refuses(() => next.act('scope-1', 'order'), 'new revision still needs an explicit approval');
  next.act('scope-1', 'approve', 'NEW_REVIEW_DECISION');
  equal(next.snapshot().approved, 1);
  equal(next.snapshot().events.length, 1);
  equal(next.snapshot().checkpoints[0].acceptedEvidence, 'NEW_REVIEW_DECISION');
  equal(next.snapshot().checkpoints[1].approved, false);
  equal(next.snapshot().plan.checkpoints[0].amount, 1, 'reordering changes this new plan only');
  const reopenedAgain = decodeScopeWorkspace(encodeScopeWorkspace({ draft: opened.draft, review: next }));
  equal(reopenedAgain.review.snapshot(), next.snapshot());
  originalUnchanged();
});

group('unapproved and inconsistent inputs cannot launder a review into a revision', () => {
  refuses(() => createScopeRevisionDraft({ draft }), 'plain draft is outside the approved revision path');
  refuses(() => createScopeRevisionDraft({ draft, review: createScopeReview(draft) }),
    'review without a first approval is insufficient');
  const changedDraft = structuredClone(draft);
  changedDraft.checkpoints[1].amount = '11.00';
  refuses(() => createScopeRevisionDraft({ draft: changedDraft, review, evidenceDrafts }),
    'current plan and event amounts must match');
  const corrupt = review.snapshot();
  corrupt.events[0].type = 'checkpoint.fabricated';
  refuses(() => createScopeRevisionDraft({ draft, review: { snapshot: () => structuredClone(corrupt) }, evidenceDrafts }),
    'unsupported current history must be admitted before it can be stripped');
  refuses(() => createScopeRevisionDraft({ draft, review,
    evidenceDrafts: new Map([['scope-404', 'unknown checkpoint note']]) }),
    'invalid pending evidence is refused before deriving a clean-looking file');
  originalUnchanged();
});

console.log(JSON.stringify({ schema: 'hamon.scopesignal.independent-revision-lifecycle.v1',
  node: process.version, source_root: root, groups, assertions, source_pins: sourcePins,
  original_states: review.snapshot().checkpoints.map(c => c.captureStatus),
  original_events: review.snapshot().events.length,
  original_workspace_sha256: createHash('sha256').update(originalBytes).digest('hex'),
  verdict: 'ACCEPT_DIRECT_LIFECYCLE',
  limits: ['Direct source consumer only; browser download/reopen receiving is separately attributed.',
    'All payment events are existing fictional local fixtures; no provider call.'] }, null, 2));
