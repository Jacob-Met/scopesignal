import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretWithWorkersAI, validateBriefResult } from '../src/workers-ai.mjs';

const suggestion = () => ({
  checkpoints: [{ title: '  Accessible checklist  ', evidence: 'Keyboard review\n<literal> & "quoted" 😀' }]
});

test('validated suggestions preserve editable text without retaining provider-owned objects', () => {
  const supplied = suggestion();
  const result = validateBriefResult(supplied);
  assert.deepEqual(result, supplied);
  assert.notEqual(result, supplied);
  assert.notEqual(result.checkpoints, supplied.checkpoints);
  assert.notEqual(result.checkpoints[0], supplied.checkpoints[0]);

  supplied.checkpoints[0].title = 'Provider changed the title';
  supplied.checkpoints[0].approved = true;
  supplied.checkpoints.push({ title: 'Unexpected', evidence: 'Added after validation' });
  assert.deepEqual(result, suggestion());
  result.checkpoints[0].evidence = 'Human-edited evidence';
  assert.equal(supplied.checkpoints[0].evidence, suggestion().checkpoints[0].evidence);
});

test('the existing empty-list and text-length contracts are preserved', () => {
  assert.deepEqual(validateBriefResult({ checkpoints: [] }), { checkpoints: [] });
  const boundary = { checkpoints: [{ title: 't'.repeat(120), evidence: 'e'.repeat(500) }] };
  assert.deepEqual(validateBriefResult(boundary), boundary);
  for (const checkpoint of [
    { title: 't'.repeat(121), evidence: 'Evidence' },
    { title: 'Title', evidence: 'e'.repeat(501) },
    { title: ' \n\t ', evidence: 'Evidence' },
    { title: 'Title', evidence: '\n\t' },
    { title: 1, evidence: 'Evidence' },
    { title: 'Title', evidence: null }
  ]) assert.throws(() => validateBriefResult({ checkpoints: [checkpoint] }), /schema validation/);
});

test('serialized Unicode text at the schema character limits remains valid', async () => {
  for (const checkpoint of [
    { title: '😀'.repeat(120), evidence: 'Review evidence' },
    { title: 'Checklist', evidence: '😀'.repeat(500) },
    { title: 't'.repeat(119) + '😀', evidence: 'e'.repeat(499) + '😀' },
    { title: 'e\u0301'.repeat(60), evidence: 'e\u0301'.repeat(250) }
  ]) {
    const expected = { checkpoints: [checkpoint] };
    const json = JSON.stringify(expected);
    for (const supplied of [expected, json, { response: json }, json.replaceAll('😀', '\\ud83d\\ude00')]) {
      const received = await interpretWithWorkersAI('Synthetic Unicode brief', { AI: { run: async () => supplied } });
      assert.deepEqual(received, expected);
    }
  }
});

test('Unicode length limits count code points rather than graphemes', async () => {
  for (const checkpoint of [
    { title: '😀'.repeat(121), evidence: 'Review evidence' },
    { title: 'Checklist', evidence: '😀'.repeat(501) },
    { title: 'e\u0301'.repeat(61), evidence: 'Review evidence' },
    { title: 'Checklist', evidence: 'e\u0301'.repeat(251) },
    { title: '👨‍👩‍👧‍👦'.repeat(18), evidence: 'Review evidence' }
  ]) {
    const json = JSON.stringify({ checkpoints: [checkpoint] });
    for (const supplied of [json, { response: json }]) {
      await assert.rejects(() => interpretWithWorkersAI('Synthetic Unicode brief', { AI: { run: async () => supplied } }), /schema validation/);
    }
  }
});

test('root fields must be declared own data properties', () => {
  for (const value of [
    null, [], 'suggestion', 1, {},
    { checkpoints: null },
    { checkpoints: [], approved: true },
    Object.create(suggestion()),
    Object.defineProperty(suggestion(), 'approved', { value: true }),
    Object.assign(suggestion(), { [Symbol('approved')]: true })
  ]) assert.throws(() => validateBriefResult(value), /required schema/);
});

test('checkpoint records cannot smuggle inherited fields or undeclared approval data', () => {
  const inherited = Object.assign(Object.create({ title: 'Title', evidence: 'Evidence' }), {
    approved: true,
    releaseFunds: true
  });
  for (const checkpoint of [
    null,
    Object.assign([], { title: 'Title', evidence: 'Evidence' }),
    inherited,
    { title: 'Title', evidence: 'Evidence', approved: true },
    Object.defineProperty({ title: 'Title', evidence: 'Evidence' }, 'approved', { value: true }),
    Object.assign({ title: 'Title', evidence: 'Evidence' }, { [Symbol('approved')]: true })
  ]) assert.throws(() => validateBriefResult({ checkpoints: [checkpoint] }), /schema validation/);
});

test('accessor fields are refused without evaluating provider code', () => {
  let reads = 0;
  const accessor = { enumerable: true, get() { reads++; return 'Title'; } };
  const root = Object.defineProperty({}, 'checkpoints', { ...accessor, get() { reads++; return []; } });
  const checkpoint = Object.defineProperty({ evidence: 'Evidence' }, 'title', accessor);
  const checkpoints = Object.defineProperty([], '0', { ...accessor, get() { reads++; return suggestion().checkpoints[0]; } });
  assert.throws(() => validateBriefResult(root), /required schema/);
  assert.throws(() => validateBriefResult({ checkpoints: [checkpoint] }), /schema validation/);
  assert.throws(() => validateBriefResult({ checkpoints }), /schema/);
  assert.equal(reads, 0);
});

test('checkpoint lists must contain their own entries and cannot replace iteration', () => {
  const inheritedEntries = new Array(1);
  Object.setPrototypeOf(inheritedEntries, Object.assign(Object.create(Array.prototype), { 0: suggestion().checkpoints[0] }));
  let iterations = 0;
  const replacedIterator = Object.assign([], {
    *[Symbol.iterator]() { iterations++; yield suggestion().checkpoints[0]; }
  });
  for (const checkpoints of [
    new Array(1),
    inheritedEntries,
    replacedIterator,
    Object.assign([], { approved: true })
  ]) assert.throws(() => validateBriefResult({ checkpoints }), /schema/);
  assert.equal(iterations, 0);
});

test('ordinary and null-prototype data records normalize to the same result', () => {
  const expected = suggestion();
  const checkpoint = Object.assign(Object.create(null), expected.checkpoints[0]);
  const supplied = Object.assign(Object.create(null), { checkpoints: [checkpoint] });
  assert.deepEqual(validateBriefResult(supplied), expected);
});

test('configured bindings support the existing direct, JSON, and response-string forms', async () => {
  for (const supplied of [
    suggestion(),
    JSON.stringify(suggestion()),
    { response: JSON.stringify(suggestion()), usage: { total_tokens: 10 } }
  ]) {
    const calls = [];
    const AI = {
      async run(model, request) {
        assert.equal(this, AI);
        calls.push({ model, request });
        return supplied;
      }
    };
    const result = await interpretWithWorkersAI('A synthetic creative brief', { AI });
    assert.deepEqual(result, suggestion());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, '@cf/meta/llama-3.1-8b-instruct');
    assert.equal(calls[0].request.messages[1].content, 'A synthetic creative brief');
    assert.match(calls[0].request.messages[0].content, /Do not approve payment/);
    assert.equal(calls[0].request.response_format.type, 'json_schema');
    assert.equal(calls[0].request.response_format.json_schema.additionalProperties, false);
  }
});

test('the async adapter rejects JSON-representable malformed suggestions in every supported response form', async () => {
  const invalid = [
    ['null result', null],
    ['array result', []],
    ['scalar result', 42],
    ['missing checkpoints', {}],
    ['non-array checkpoints', { checkpoints: {} }],
    ['undeclared root approval', { ...suggestion(), approved: true }],
    ['null checkpoint', { checkpoints: [null] }],
    ['scalar checkpoint', { checkpoints: ['Suggested checkpoint'] }],
    ['array checkpoint', { checkpoints: [['Title', 'Evidence']] }],
    ['missing title', { checkpoints: [{ evidence: 'Evidence' }] }],
    ['missing evidence', { checkpoints: [{ title: 'Title' }] }],
    ['non-string title', { checkpoints: [{ title: 42, evidence: 'Evidence' }] }],
    ['non-string evidence', { checkpoints: [{ title: 'Title', evidence: ['Evidence'] }] }],
    ['blank title', { checkpoints: [{ title: ' \n\t ', evidence: 'Evidence' }] }],
    ['blank evidence', { checkpoints: [{ title: 'Title', evidence: '\n\t' }] }],
    ['overlong title', { checkpoints: [{ title: 't'.repeat(121), evidence: 'Evidence' }] }],
    ['overlong evidence', { checkpoints: [{ title: 'Title', evidence: 'e'.repeat(501) }] }],
    ['model approval', { checkpoints: [{ title: 'Title', evidence: 'Evidence', approved: true }] }],
    ['model payment amount', { checkpoints: [{ title: 'Title', evidence: 'Evidence', amount: 40000 }] }],
    ['invalid later checkpoint', { checkpoints: [suggestion().checkpoints[0], { title: 'Later checkpoint' }] }]
  ];
  for (const [name, value] of invalid) {
    for (const [form, supplied] of [
      ['direct object', value],
      ['JSON text', JSON.stringify(value)],
      ['response envelope', { response: JSON.stringify(value) }]
    ]) {
      let calls = 0;
      await assert.rejects(() => interpretWithWorkersAI('Synthetic brief', { AI: { run: async () => {
        calls++;
        return supplied;
      } } }), /schema/, `${name} through ${form}`);
      assert.equal(calls, 1, `${name} through ${form} does not retry`);
    }
  }
});

test('each provider call receives an independent request schema', async () => {
  const schemas = [];
  const AI = { async run(_model, request) {
    const schema = request.response_format.json_schema;
    assert.equal(schema.properties.checkpoints.items.additionalProperties, false);
    schemas.push(schema);
    schema.properties.checkpoints.items.additionalProperties = true;
    return suggestion();
  } };
  await interpretWithWorkersAI('First brief', { AI });
  await interpretWithWorkersAI('Second brief', { AI });
  assert.notEqual(schemas[0], schemas[1]);
});

test('inherited or accessor response envelopes do not bypass result validation', async () => {
  let reads = 0;
  const accessor = Object.defineProperty({}, 'response', {
    enumerable: true,
    get() { reads++; return JSON.stringify(suggestion()); }
  });
  for (const supplied of [
    Object.create({ response: JSON.stringify(suggestion()) }),
    accessor,
    Object.assign([], { response: JSON.stringify(suggestion()) })
  ]) await assert.rejects(() => interpretWithWorkersAI('Brief', { AI: { run: async () => supplied } }), /schema/);
  assert.equal(reads, 0);
});

test('missing or invalid bindings fail closed before any dispatch', async () => {
  for (const env of [undefined, null, {}, { AI: null }, { AI: {} }, { AI: { run: 'unconfigured' } }]) {
    await assert.rejects(() => interpretWithWorkersAI('Brief', env), /disconnected.*No paid fallback/);
  }
});

test('provider errors and malformed results are rejected without retry or fallback', async () => {
  const providerError = new Error('Synthetic binding failure');
  let attempts = 0;
  await assert.rejects(() => interpretWithWorkersAI('Brief', { AI: { run: async () => {
    attempts++;
    throw providerError;
  } } }), error => error === providerError);
  assert.equal(attempts, 1);

  for (const supplied of [
    '{broken JSON',
    { response: '' },
    { response: JSON.stringify({ checkpoints: [{ title: 'Title', evidence: 'Evidence', approved: true }] }) },
    { response: suggestion() },
    null
  ]) {
    let calls = 0;
    await assert.rejects(() => interpretWithWorkersAI('Brief', { AI: { run: async () => {
      calls++;
      return supplied;
    } } }));
    assert.equal(calls, 1);
  }
});
