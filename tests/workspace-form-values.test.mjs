import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeScopeWorkspace, encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';

function fixture(stage = 'draft') {
  return {
    schema: 'scopesignal.scope-workspace', version: 1,
    fixtureOnly: true, paymentEvidence: false, stage,
    draft: {
      label: '  Native form Ω  ', brief: 'First line\nSecond 🌿', cap: '100.00',
      checkpoints: [{ title: 'Delivery Ω', amount: '42.05', evidence: 'Proof\nLiteral <b>text</b>' }]
    },
    events: [], evidenceDrafts: []
  };
}

test('native field strings and LF pending evidence survive file roundtrips without normalization', () => {
  for (const stage of ['draft', 'review']) {
    const record = fixture(stage);
    if (stage === 'review') record.evidenceDrafts = [{ checkpointId: 'scope-1', text: '\n  Pending Ω\n🌿  ' }];
    const opened = decodeScopeWorkspace(JSON.stringify(record));
    assert.deepEqual(opened.draft, record.draft);
    const again = decodeScopeWorkspace(encodeScopeWorkspace(opened));
    assert.deepEqual(again.draft, record.draft);
    assert.deepEqual([...again.evidenceDrafts], stage === 'draft' ? [] : [['scope-1', '\n  Pending Ω\n🌿  ']]);
    if (again.review) {
      assert.equal(again.review.snapshot().approved, 0);
      assert.deepEqual(again.review.snapshot().events, []);
    }
  }
  const unfinished = fixture();
  unfinished.draft.cap = '  0001.2?  ';
  unfinished.draft.checkpoints[0].amount = '';
  assert.deepEqual(decodeScopeWorkspace(JSON.stringify(unfinished)).draft, unfinished.draft);
});

const fields = [
  ['project label', record => record.draft, 'label', false],
  ['creative brief', record => record.draft, 'brief', true],
  ['project cap', record => record.draft, 'cap', false],
  ['checkpoint title', record => record.draft.checkpoints[0], 'title', false],
  ['checkpoint amount', record => record.draft.checkpoints[0], 'amount', false],
  ['planned evidence', record => record.draft.checkpoints[0], 'evidence', true]
];

for (const [label, object, key, multiline] of fields) {
  test(`${label} refuses external line breaks that native form assignment would change`, () => {
    for (const lineBreak of multiline ? ['\r', '\r\n'] : ['\r', '\n', '\r\n']) {
      const record = fixture();
      object(record)[key] = `4${lineBreak}2.05`;
      const saved = JSON.stringify(record);
      assert.throws(() => decodeScopeWorkspace(saved), Error);
      assert.equal(JSON.stringify(record), saved);
    }
  });
}

test('pending review evidence refuses CR and CRLF before a native textarea can rewrite it', () => {
  for (const lineBreak of ['\r', '\r\n']) {
    const record = fixture('review');
    record.evidenceDrafts = [{ checkpointId: 'scope-1', text: `First${lineBreak}Second` }];
    const before = JSON.stringify(record);
    assert.throws(() => decodeScopeWorkspace(before), Error);
    assert.equal(JSON.stringify(record), before);
  }
});

test('saving incompatible in-memory fields refuses without altering the caller draft', () => {
  const draft = fixture().draft;
  draft.cap = '10\n0.00';
  const before = structuredClone(draft);
  assert.throws(() => encodeScopeWorkspace({ draft }), Error);
  assert.deepEqual(draft, before);
});
