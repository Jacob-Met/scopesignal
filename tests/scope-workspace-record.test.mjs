import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReview, validateScopeDraft } from '../src/scope-plan.mjs';
import {
  encodeScopeWorkspace, decodeScopeWorkspace, WORKSPACE_SCHEMA,
  WORKSPACE_VERSION, WORKSPACE_FILENAME, MAX_WORKSPACE_BYTES
} from '../src/scope-workspace-record.mjs';

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

function mixedWorkspace() {
  const draft = plan();
  const review = createScopeReview(draft);
  const accepted = '\n  Observed Ω\nLiteral </textarea><script>not code</script> 🌿  \n';
  for (const action of ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate']) {
    review.act('scope-1', action, accepted);
  }
  for (const action of ['approve', 'order', 'request', 'receipt']) {
    review.act('scope-2', action, 'Second accepted evidence.');
  }
  const evidenceDrafts = new Map([
    ['scope-1', 'Former draft must not replace its recorded approval.'],
    ['scope-3', '\n  Pending Ω & <textarea>literal</textarea>\n🌿  ']
  ]);
  return { draft, review, evidenceDrafts };
}

const save = value => JSON.parse(encodeScopeWorkspace(value));
const open = value => decodeScopeWorkspace(JSON.stringify(value));
function refuseChange(record, change) {
  const changed = structuredClone(record);
  change(changed);
  assert.throws(() => open(changed));
}

test('an unfinished draft preserves exact raw strings and still needs ordinary review validation', () => {
  const draft = {
    label: '  ',
    brief: '\nUnfinished 🌿\n',
    cap: 'not an amount',
    checkpoints: [
      { title: '', amount: ' 0001.2 ', evidence: '\n Pending literal </textarea>\n ' },
      { title: 'Unpriced', amount: '', evidence: '' }
    ]
  };
  const before = structuredClone(draft);
  const encoded = encodeScopeWorkspace({ draft });
  const restored = decodeScopeWorkspace(encoded);
  assert.deepEqual(restored.draft, before);
  assert.equal(restored.review, null);
  assert.equal(restored.evidenceDrafts.size, 0);
  assert.equal(restored.summary.stage, 'draft');
  assert.equal(validateScopeDraft(restored.draft).ok, false);
  assert.equal(encodeScopeWorkspace(restored), encoded);
  assert.deepEqual(draft, before);
  const record = JSON.parse(encoded);
  assert.equal(record.schema, WORKSPACE_SCHEMA);
  assert.equal(record.version, WORKSPACE_VERSION);
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.paymentEvidence, false);
  assert.equal(WORKSPACE_FILENAME, 'scopesignal-workspace-v1.json');
});

test('mixed review restores exact history, accepted and pending evidence, totals, and next action', () => {
  const original = mixedWorkspace();
  const before = original.review.snapshot();
  const encoded = encodeScopeWorkspace(original);
  const restored = decodeScopeWorkspace(encoded);
  assert.deepEqual(restored.review.snapshot(), before);
  assert.deepEqual(restored.draft, original.draft);
  assert.equal(restored.evidenceDrafts.size, 1);
  assert.equal(restored.evidenceDrafts.get('scope-3'), original.evidenceDrafts.get('scope-3'));
  assert.equal(restored.evidenceDrafts.has('scope-1'), false);
  assert.equal(before.events.length, 10);
  assert.equal(before.captured, 1510);
  assert.equal(before.checkpoints[0].captureStatus, 'unknown');
  assert.equal(before.checkpoints[0].acceptedEvidence,
    'Observed Ω\nLiteral </textarea><script>not code</script> 🌿');
  assert.deepEqual(before.checkpoints[0].actions, ['reconcile']);
  assert.deepEqual(restored.review.act('scope-1', 'reconcile'),
    original.review.act('scope-1', 'reconcile'));
  assert.equal(restored.review.snapshot().captured, 5715);
  assert.equal(restored.review.snapshot().events.length, 11);
  assert.equal(restored.review.snapshot().remaining, 2000);
  assert.deepEqual(restored.review.snapshot().checkpoints[0].actions, []);
});

test('every prefix of each ordinary authoring lifecycle reopens at the same next-step boundary', () => {
  const routes = [
    ['approve', 'order', 'request', 'receipt', 'duplicate'],
    ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile'],
    ['approve', 'order', 'request', 'lose', 'reconcile'],
    ['approve', 'order', 'request', 'lose', 'receipt', 'reconcile', 'duplicate']
  ];
  let received = 0;
  for (const route of routes) {
    const draft = plan();
    const review = createScopeReview(draft);
    for (let index = 0; index <= route.length; index += 1) {
      const restored = decodeScopeWorkspace(encodeScopeWorkspace({ draft, review }));
      assert.deepEqual(restored.review.snapshot(), review.snapshot());
      received += 1;
      if (index < route.length) {
        assert.deepEqual(restored.review.act('scope-1', route[index], 'Exact accepted evidence.'),
          review.act('scope-1', route[index], 'Exact accepted evidence.'));
      }
    }
  }
  assert.equal(received, 28);
});

test('empty pending evidence survives and never becomes an approval by saving or opening', () => {
  const draft = plan();
  const review = createScopeReview(draft);
  const evidenceDrafts = new Map([['scope-1', ''], ['scope-2', ' \n '], ['scope-3', 'Ω']]);
  const restored = decodeScopeWorkspace(encodeScopeWorkspace({ draft, review, evidenceDrafts }));
  assert.deepEqual([...restored.evidenceDrafts], [...evidenceDrafts]);
  assert.equal(restored.review.snapshot().events.length, 0);
  assert.equal(restored.review.snapshot().approved, 0);
  assert.throws(() => restored.review.act('scope-1', 'approve', restored.evidenceDrafts.get('scope-1')));
  assert.equal(restored.review.snapshot().events.length, 0);
});

test('unsupported envelopes, constants, stages, types and extra fields are refused', () => {
  const record = save({ draft: plan() });
  for (const key of Object.keys(record)) refuseChange(record, value => { delete value[key]; });
  for (const [key, value] of [
    ['schema', 'scopesignal.fixture-record'], ['version', 2], ['version', '1'],
    ['fixtureOnly', false], ['paymentEvidence', true], ['stage', 'approved'],
    ['draft', []], ['events', {}], ['evidenceDrafts', {}]
  ]) refuseChange(record, data => { data[key] = value; });
  refuseChange(record, value => { value.extra = 'unrecognized'; });
  for (const input of ['null', '[]', 'true', '"string"', '{', '']) {
    assert.throws(() => decodeScopeWorkspace(input));
  }
  assert.throws(() => decodeScopeWorkspace(42));
  const extra = JSON.parse(JSON.stringify(record).slice(0, -1) + ',"__proto__":{"approved":true}}');
  assert.throws(() => open(extra));
  assert.equal({}.approved, undefined);
});

test('draft shapes and text bounds are enforced without normalizing unfinished input', () => {
  const record = save({ draft: plan() });
  for (const change of [
    value => { value.draft.label = 'x'.repeat(121); },
    value => { value.draft.brief = 'x'.repeat(8001); },
    value => { value.draft.cap = '0'.repeat(65); },
    value => { value.draft.cap = 100; },
    value => { value.draft.checkpoints = []; },
    value => { value.draft.checkpoints = Array(13).fill(value.draft.checkpoints[0]); },
    value => { value.draft.checkpoints[1] = null; },
    value => { delete value.draft.checkpoints[0].evidence; },
    value => { value.draft.checkpoints[0].amount = 42.05; },
    value => { value.draft.checkpoints[0].amount = '1'.repeat(65); },
    value => { value.draft.checkpoints[0].title = 'x'.repeat(161); },
    value => { value.draft.checkpoints[0].evidence = 'x'.repeat(5001); },
    value => { value.draft.checkpoints[0].approved = true; },
    value => { value.draft.owner = 'someone'; }
  ]) refuseChange(record, change);
  const unfinished = structuredClone(record);
  unfinished.draft.cap = '0.01';
  unfinished.draft.checkpoints[0].amount = 'n/a';
  assert.deepEqual(open(unfinished).draft, unfinished.draft);
  unfinished.stage = 'review';
  assert.throws(() => open(unfinished));
});

test('every canonical event field and sequence is checked against the unchanged fixture controls', () => {
  const record = save(mixedWorkspace());
  for (const eventIndex of [0, 1, 2, 3, 4, 5, 9]) {
    for (const field of Object.keys(record.events[eventIndex])) {
      refuseChange(record, value => { delete value.events[eventIndex][field]; });
      refuseChange(record, value => { value.events[eventIndex][field] = null; });
    }
  }
  for (const change of [
    value => { value.events[0].approver = 'bot'; },
    value => { value.events[0].acceptedEvidence = ' ' + value.events[0].acceptedEvidence; },
    value => { value.events[1].amount += 1; },
    value => { value.events[1].currency = 'EUR'; },
    value => { value.events[1].environment = 'live'; },
    value => { value.events[2].seq = 99; },
    value => { value.events[2].at = 'T+999'; },
    value => { value.events[4].captureId = 'CAP-OTHER'; },
    value => { value.events[5].duplicate = false; },
    value => { value.events[4].nested = {}; },
    value => { value.events.reverse(); },
    value => { value.events.splice(0, 1); },
    value => { value.events.push({ type: 'paypal.capture.requested', checkpointId: 'scope-1' }); },
    value => { value.events = Array(97).fill(value.events[0]); }
  ]) refuseChange(record, change);
});

test('saved review drafts must belong to distinct existing unapproved checkpoints', () => {
  const record = save(mixedWorkspace());
  for (const change of [
    value => { value.evidenceDrafts.push(structuredClone(value.evidenceDrafts[0])); },
    value => { value.evidenceDrafts[0].checkpointId = 'scope-1'; },
    value => { value.evidenceDrafts[0].checkpointId = '__proto__'; },
    value => { value.evidenceDrafts[0].checkpointId = 'constructor'; },
    value => { value.evidenceDrafts[0].text = 'x'.repeat(5001); },
    value => { value.evidenceDrafts[0].text = null; },
    value => { value.evidenceDrafts[0].accepted = true; },
    value => { value.stage = 'draft'; },
    value => { value.evidenceDrafts = Array(13).fill(value.evidenceDrafts[0]); }
  ]) refuseChange(record, change);
  const draftRecord = save({ draft: plan() });
  refuseChange(draftRecord, value => { value.evidenceDrafts = [{ checkpointId: 'scope-1', text: '' }]; });
  refuseChange(draftRecord, value => { value.events = [record.events[0]]; });
});

test('twelve checkpoints and their complete bounded histories retain exact cent totals', () => {
  const draft = {
    label: 'Twelve tiny milestones', brief: 'Fictional exact-cent fixture.', cap: '0.13',
    checkpoints: Array.from({ length: 12 }, (_, index) => ({
      title: 'Milestone ' + index, amount: '0.01', evidence: 'Evidence ' + index
    }))
  };
  const review = createScopeReview(draft);
  for (let index = 1; index <= 12; index += 1) {
    for (const action of ['approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile']) {
      review.act('scope-' + index, action, 'Reviewed ' + index);
    }
  }
  const restored = decodeScopeWorkspace(encodeScopeWorkspace({ draft, review }));
  assert.deepEqual(restored.review.snapshot(), review.snapshot());
  assert.equal(restored.summary.events, 84);
  assert.equal(restored.summary.approved, 12);
  assert.equal(restored.review.snapshot().captured, 12);
  assert.equal(restored.review.snapshot().unallocated, 1);
});

test('opening accepts harmless JSON field order changes and makes no authenticity claim', () => {
  const record = save(mixedWorkspace());
  record.events = record.events.map(event => Object.fromEntries(Object.entries(event).reverse()));
  record.events[0].acceptedEvidence = 'Another internally consistent fictional claim.';
  const restored = open(record);
  assert.equal(restored.review.snapshot().checkpoints[0].acceptedEvidence,
    'Another internally consistent fictional claim.');
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.paymentEvidence, false);
});

test('byte limits, failed saves and mismatched plans preserve the source workspace', () => {
  assert.throws(() => decodeScopeWorkspace(' '.repeat(MAX_WORKSPACE_BYTES + 1)), /1 MiB/);
  assert.throws(() => decodeScopeWorkspace('🌿'.repeat(MAX_WORKSPACE_BYTES / 4 + 1)), /1 MiB/);
  const workspace = mixedWorkspace();
  const priorDraft = structuredClone(workspace.draft);
  const priorState = workspace.review.snapshot();
  const priorEvidence = [...workspace.evidenceDrafts];
  const wrongPlan = structuredClone(workspace.draft);
  wrongPlan.label = 'A different scope';
  assert.throws(() => encodeScopeWorkspace({ ...workspace, draft: wrongPlan }), /do not match/);
  assert.throws(() => encodeScopeWorkspace({ ...workspace, evidenceDrafts: new Map([['missing', 'x']]) }));
  assert.throws(() => encodeScopeWorkspace({ ...workspace, evidenceDrafts: {} }));
  assert.deepEqual(workspace.draft, priorDraft);
  assert.deepEqual(workspace.review.snapshot(), priorState);
  assert.deepEqual([...workspace.evidenceDrafts], priorEvidence);
  const opened = decodeScopeWorkspace(encodeScopeWorkspace(workspace));
  opened.draft.label = 'Editing the independent restored draft';
  opened.review.act('scope-1', 'reconcile');
  opened.evidenceDrafts.set('scope-3', 'Independent edit');
  assert.deepEqual(workspace.draft, priorDraft);
  assert.deepEqual(workspace.review.snapshot(), priorState);
  assert.deepEqual([...workspace.evidenceDrafts], priorEvidence);
});
