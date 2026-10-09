import test from 'node:test';
import assert from 'node:assert/strict';
import { readCombineWorkspace, prepareCheckpointCombine } from '../src/scope-checkpoint-combine.mjs';
import { encodeScopeWorkspace, decodeScopeWorkspace, MAX_WORKSPACE_BYTES } from '../src/scope-workspace-record.mjs';

const encoder = new TextEncoder();
const description = { title: 'Combined delivery', evidence: 'Explicitly inspect both parts.' };
const four = () => ({
  label: 'Four-row oracle', brief: 'A fictional project.', cap: '19.11',
  checkpoints: [
    { title: 'A', amount: '12.34', evidence: 'Proof A' },
    { title: 'B', amount: '5.00', evidence: 'Proof B' },
    { title: 'C', amount: '0.66', evidence: 'Proof C' },
    { title: 'D', amount: '1.11', evidence: 'Proof D' }
  ]
});
const bytes = draft => encoder.encode(encodeScopeWorkspace({ draft }));
const record = draft => ({
  schema: 'scopesignal.scope-workspace', version: 1, fixtureOnly: true,
  paymentEvidence: false, stage: 'draft', draft, events: [], evidenceDrafts: []
});

test('four-row monetary and full-object oracle; reversed selection has identical bytes', () => {
  const source = four();
  const input = bytes(source);
  const original = input.slice();
  const selection = [0, 2];
  const result = prepareCheckpointCombine(input, selection, description);
  const expected = {
    ...source, checkpoints: [
      { title: description.title, amount: '13.00', evidence: description.evidence },
      source.checkpoints[1], source.checkpoints[3]
    ]
  };
  assert.equal(result.combinedCents, 1300);
  assert.equal(result.budget.allocated, 1911);
  assert.deepEqual(result.draft, expected);
  assert.deepEqual(result.record, record(expected));
  assert.equal(result.contents, encodeScopeWorkspace({ draft: expected }));
  assert.equal(prepareCheckpointCombine(input, [2, 0], description).contents, result.contents);
  assert.deepEqual(decodeScopeWorkspace(result.contents).draft, expected);
  assert.deepEqual(input, original);
  assert.deepEqual(selection, [0, 2]);
  assert.deepEqual(source, four());
});

test('every pair in four rows uses ordinal placement, including adjacent and endpoints', () => {
  const source = four();
  for (let first = 0; first < 4; first++) {
    for (let second = first + 1; second < 4; second++) {
      const result = prepareCheckpointCombine(bytes(source), [second, first], description);
      const unchanged = result.draft.checkpoints.filter((_, index) => index !== first);
      assert.deepEqual(unchanged, source.checkpoints.filter((_, index) => index !== first && index !== second));
      assert.equal(result.draft.checkpoints[first].title, description.title);
      assert.equal(result.draft.checkpoints.length, 3);
      assert.equal(result.budget.allocated, 1911);
    }
  }
});

test('equal-looking distinct rows are combined by position; duplicate and invalid ordinals refuse', () => {
  const source = four();
  source.checkpoints[2] = structuredClone(source.checkpoints[0]);
  const result = prepareCheckpointCombine(bytes(source), [0, 2], description);
  assert.equal(result.combinedCents, 2468);
  assert.deepEqual(result.draft.checkpoints.slice(1), [source.checkpoints[1], source.checkpoints[3]]);
  for (const selection of [[0, 0], [], [0], [0, 1, 2], [-1, 2], [0, 4], [0.5, 2], ['0', 2], [false, 2], [NaN, 2], [Infinity, 2], new Array(2), null]) {
    assert.throws(() => prepareCheckpointCombine(bytes(source), selection, description), /two distinct/);
  }
});

test('native money admission is applied to each selected input without coercion or rounding', () => {
  for (const amount of ['', '0', '0.00', '-1.00', '+1', '.66', '1e2', '1,000', '$1', '1.001', 'Infinity', '90071992547409.92']) {
    const source = four();
    source.checkpoints[0].amount = amount;
    assert.throws(() => prepareCheckpointCombine(bytes(source), [0, 2], description), /Each selected/);
  }
  const source = four();
  source.checkpoints[0].amount = ' 00012.34 ';
  source.checkpoints[2].amount = '00.66';
  source.checkpoints[1].amount = ' 0005.0 ';
  const result = prepareCheckpointCombine(bytes(source), [0, 2], description);
  assert.equal(result.draft.checkpoints[0].amount, '13.00');
  assert.equal(result.draft.checkpoints[1].amount, ' 0005.0 ');
  assert.equal(result.combinedCents, 1300);
});

test('safe individual amounts with unsafe sum refuse; maximum safe cent sum stays exact', () => {
  const source = four();
  source.checkpoints[0].amount = '45035996273704.96';
  source.checkpoints[2].amount = '45035996273704.96';
  assert.throws(() => prepareCheckpointCombine(bytes(source), [0, 2], description), /safe integer cents/);
  source.checkpoints = [source.checkpoints[0], { ...source.checkpoints[2], amount: '45035996273704.95' }];
  source.cap = '90071992547409.91';
  const result = prepareCheckpointCombine(bytes(source), [1, 0], description);
  assert.equal(result.combinedCents, Number.MAX_SAFE_INTEGER);
  assert.equal(result.draft.checkpoints[0].amount, '90071992547409.91');
  assert.equal(result.budget.allocated, Number.MAX_SAFE_INTEGER);
  assert.equal(result.validation.ok, true);
});

test('explicit Unicode and LF text is preserved exactly; selected prose is not inherited', () => {
  const replacement = {
    title: '  Café β <img src=x onerror=globalThis.unsafe=1>  ',
    evidence: '  First proof: \"quoted\" & <literal>\n\n第二の証拠 ✅  '
  };
  const result = prepareCheckpointCombine(bytes(four()), [0, 2], replacement);
  assert.deepEqual(result.draft.checkpoints[0], { title: replacement.title, amount: '13.00', evidence: replacement.evidence });
  assert.deepEqual(decodeScopeWorkspace(result.contents).draft, result.draft);
  assert.equal(result.contents.includes('Proof A'), false);
  assert.equal(result.contents.includes('Proof C'), false);
  assert.equal(result.validation.ok, true);
});

test('native replacement text admission refuses incomplete, oversized and forbidden line breaks', () => {
  for (const replacement of [
    {}, { title: 'x' }, { title: 'x', evidence: 'y', extra: true },
    { title: '', evidence: 'x' }, { title: '   ', evidence: 'x' },
    { title: 'x', evidence: ' \n ' }, { title: 1, evidence: 'x' },
    { title: 'x'.repeat(161), evidence: 'x' }, { title: 'x', evidence: 'x'.repeat(5001) },
    { title: 'line\nbreak', evidence: 'x' }, { title: 'x', evidence: 'line\r\nbreak' }
  ]) assert.throws(() => prepareCheckpointCombine(bytes(four()), [0, 2], replacement));
  const allowed = { title: 'x'.repeat(160), evidence: '界'.repeat(5000) };
  const result = prepareCheckpointCombine(bytes(four()), [0, 2], allowed);
  assert.equal(result.draft.checkpoints[0].title, allowed.title);
  assert.equal(result.draft.checkpoints[0].evidence, allowed.evidence);
});

test('unfinished project and unselected row fields remain structurally exact; validation is descriptive', () => {
  const source = four();
  source.label = '  ';
  source.brief = '\nUnfinished <brief>\n  ';
  source.cap = '';
  source.checkpoints[1] = { title: '', amount: 'not yet', evidence: '\n  ' };
  source.checkpoints[3] = { title: '  D  ', amount: ' 01.11 ', evidence: ' Keep\nthis. ' };
  const before = structuredClone(source);
  const result = prepareCheckpointCombine(bytes(source), [0, 2], description);
  const expected = { ...source, checkpoints: [
    { title: description.title, amount: '13.00', evidence: description.evidence },
    source.checkpoints[1], source.checkpoints[3]
  ] };
  assert.deepEqual(result.record, record(expected));
  assert.deepEqual(decodeScopeWorkspace(result.contents).draft, expected);
  assert.equal(result.validation.ok, false);
  assert.equal(result.validation.errors.some(error => error.field === 'label'), true);
  assert.equal(result.validation.errors.some(error => error.field === 'checkpoints.1.amount'), true);
  assert.equal(result.budget.allocated, null);
  assert.equal(result.budget.cap, null);
  assert.deepEqual(source, before);
});

test('review stage is refused before native event replay and ledger-bearing drafts refuse', () => {
  const saved = record(four());
  saved.stage = 'review';
  saved.events = [{ type: 'unsupported event would fail replay' }];
  const input = encoder.encode(JSON.stringify(saved));
  assert.throws(() => readCombineWorkspace(input), /editable draft files only/);
  assert.throws(() => prepareCheckpointCombine(input, [0, 2], description), /editable draft files only/);
  saved.stage = 'draft';
  assert.throws(() => readCombineWorkspace(encoder.encode(JSON.stringify(saved))), /cannot contain approval events/);
  saved.events = [];
  saved.evidenceDrafts = [{ checkpointId: 'scope-1', text: 'Pending review' }];
  assert.throws(() => readCombineWorkspace(encoder.encode(JSON.stringify(saved))), /cannot contain approval events/);
});

test('complete unchanged native codec admits files; unsupported shapes and fields stay refused', () => {
  const mutations = [
    saved => { saved.version = 2; },
    saved => { saved.fixtureOnly = false; },
    saved => { saved.paymentEvidence = true; },
    saved => { saved.extra = 'not admitted by native codec'; },
    saved => { saved.draft.extra = 'not admitted'; },
    saved => { saved.draft.checkpoints[0].extra = 'not admitted'; },
    saved => { saved.draft.checkpoints[0].amount = 12.34; },
    saved => { saved.draft.checkpoints[0].title = 'a\nb'; }
  ];
  for (const mutate of mutations) {
    const saved = record(four()); mutate(saved);
    const contents = JSON.stringify(saved);
    assert.throws(() => decodeScopeWorkspace(contents));
    assert.throws(() => readCombineWorkspace(encoder.encode(contents)));
  }
});

test('bounded bytes and fatal UTF-8 handling preserve native text admission', () => {
  for (const input of ['', new ArrayBuffer(0), [123], null, encoder.encode(''), new Uint8Array([0xff]), encoder.encode('\ufeff' + encodeScopeWorkspace({ draft: four() }))]) {
    assert.throws(() => readCombineWorkspace(input));
  }
  const contents = encodeScopeWorkspace({ draft: four() });
  const input = encoder.encode(' '.repeat(MAX_WORKSPACE_BYTES - encoder.encode(contents).byteLength) + contents);
  assert.equal(input.byteLength, MAX_WORKSPACE_BYTES);
  assert.deepEqual(readCombineWorkspace(input).draft, four());
  assert.throws(() => readCombineWorkspace(new Uint8Array(MAX_WORKSPACE_BYTES + 1)), /1 MiB/);
});

test('only the two selected ordinals change and the ordinary output always has zero events', () => {
  const source = four();
  source.checkpoints = source.checkpoints.slice(0, 2);
  const result = prepareCheckpointCombine(bytes(source), [1, 0], description);
  assert.equal(result.draft.checkpoints.length, 1);
  assert.equal(result.draft.checkpoints[0].amount, '17.34');
  assert.deepEqual(result.record, record({
    ...source, checkpoints: [{ title: description.title, amount: '17.34', evidence: description.evidence }]
  }));
  const restored = decodeScopeWorkspace(result.contents);
  assert.equal(restored.review, null);
  assert.equal(restored.summary.stage, 'draft');
  assert.equal(restored.summary.approved, 0);
  assert.equal(restored.summary.events, 0);
  assert.equal(restored.evidenceDrafts.size, 0);
});
