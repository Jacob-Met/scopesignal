import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeScopeDraft, parseScopeDraftFile, MAX_SCOPE_DRAFT_BYTES } from '../src/scope-draft-file.mjs';
import { validateScopeDraft, createScopeReview } from '../src/scope-plan.mjs';

const draft = () => ({
  label: '  Lantern / 灯 — study  ', brief: 'First line\n第二行 🪷\n', cap: ' 5.00 ',
  checkpoints: [
    { title: '  Sketch  ', amount: '01.00', evidence: '  Review the sketch\nwith the author.  ' },
    { title: 'Delivery', amount: '2.50', evidence: 'Original files, version 2' }
  ]
});
const envelope = value => ({ schema: 'scopesignal.scope-draft', version: 1, fixtureOnly: true, draft: value });
const open = value => parseScopeDraftFile(JSON.stringify(value));

test('download and reopen preserve raw authored text, decimal spellings, order and Unicode', () => {
  const before = draft();
  const text = serializeScopeDraft(before);
  assert.deepEqual(JSON.parse(text), envelope(before));
  assert.deepEqual(parseScopeDraftFile(text), before);
  assert.ok(text.endsWith('\n'));
});

test('unfinished, empty and over-budget values can be saved without claiming review readiness', () => {
  const before = draft();
  before.label = '';
  before.cap = '2.';
  before.checkpoints[0] = { title: '', amount: '', evidence: '  ' };
  before.checkpoints[1].amount = '999999999999999999999';
  const reopened = parseScopeDraftFile(serializeScopeDraft(before));
  assert.deepEqual(reopened, before);
  assert.equal(validateScopeDraft(reopened).ok, false);
});

test('a valid reopened plan starts an unapproved review with no events or captured amount', () => {
  const reopened = parseScopeDraftFile(serializeScopeDraft(draft()));
  const review = createScopeReview(reopened).snapshot();
  assert.equal(review.approved, 0);
  assert.equal(review.captured, 0);
  assert.deepEqual(review.events, []);
  assert.deepEqual(review.checkpoints.map(cp => cp.actions), [['approve'], ['approve']]);
});

test('saved draft and reopened values are detached from their source objects', () => {
  const before = draft();
  const text = serializeScopeDraft(before);
  before.checkpoints[0].evidence = 'new unsaved edit';
  const first = parseScopeDraftFile(text);
  first.checkpoints[1].amount = '99';
  assert.equal(parseScopeDraftFile(text).checkpoints[0].evidence, '  Review the sketch\nwith the author.  ');
  assert.equal(parseScopeDraftFile(text).checkpoints[1].amount, '2.50');
});

test('draft files cannot carry approvals, ledger events, IDs or captured values', () => {
  for (const field of ['events', 'approved', 'captured', 'id', 'currency']) {
    const outer = envelope(draft());
    outer[field] = [];
    assert.throws(() => open(outer));
    const inner = envelope(draft());
    inner.draft[field] = true;
    assert.throws(() => open(inner));
    const row = envelope(draft());
    row.draft.checkpoints[0][field] = 1;
    assert.throws(() => open(row));
  }
});

test('fixture records, future versions and non-fiction envelopes are refused', () => {
  for (const change of [{ schema: 'scopesignal.fixture-record' }, { version: 2 }, { version: '1' }, { fixtureOnly: false }]) {
    assert.throws(() => open({ ...envelope(draft()), ...change }));
  }
});

test('missing fields, scalar roots and values that would be coerced are refused', () => {
  for (const value of [null, [], true, 4, 'text']) assert.throws(() => open(value));
  for (const name of ['label', 'brief', 'cap', 'checkpoints']) {
    const value = draft();
    delete value[name];
    assert.throws(() => open(envelope(value)));
  }
  for (const value of [null, 1, [], {}, false]) {
    const before = draft();
    before.checkpoints[0].amount = value;
    assert.throws(() => open(envelope(before)));
  }
});

test('one and twelve checkpoints survive; zero and thirteen are refused', () => {
  for (const count of [0, 1, 12, 13]) {
    const before = draft();
    before.checkpoints = Array.from({ length: count }, (_, index) => ({ title: `Row ${index}`, amount: '', evidence: '' }));
    if (count >= 1 && count <= 12) assert.deepEqual(open(envelope(before)), before);
    else assert.throws(() => open(envelope(before)));
  }
});

test('plain-value export refuses sparse lists, extra fields and accessors without evaluating them', () => {
  const sparse = draft();
  delete sparse.checkpoints[0];
  assert.throws(() => serializeScopeDraft(sparse));
  const extra = draft();
  extra.checkpoints.note = 'not part of the plan';
  assert.throws(() => serializeScopeDraft(extra));
  const accessor = draft();
  let calls = 0;
  Object.defineProperty(accessor, 'brief', { get() { calls++; return 'coerced'; } });
  assert.throws(() => serializeScopeDraft(accessor));
  assert.equal(calls, 0);
  const inherited = Object.create(draft());
  assert.throws(() => serializeScopeDraft(inherited));
});

test('unknown prototype-like JSON fields are refused and never alter prototypes', () => {
  const text = JSON.stringify(envelope(draft())).replace('"label":', '"__proto__":{"polluted":true},"label":');
  assert.throws(() => parseScopeDraftFile(text));
  assert.equal({}.polluted, undefined);
});

test('JSON layout can use CRLF and a UTF-8 BOM while textarea values retain LF', () => {
  const text = serializeScopeDraft(draft()).replaceAll('\n', '\r\n');
  assert.deepEqual(parseScopeDraftFile(`\uFEFF${text}`), draft());
});

test('external field line breaks that native form controls would change are refused', () => {
  for (const [field, value] of [['label', 'first\nsecond'], ['cap', '5\r\n'], ['brief', 'first\r\nsecond']]) {
    const before = draft();
    before[field] = value;
    assert.throws(() => open(envelope(before)));
  }
  const before = draft();
  before.checkpoints[0].title = 'first\nsecond';
  assert.throws(() => open(envelope(before)));
});

test('one MiB bound counts UTF-8 bytes, accepts the exact boundary and rejects one byte more', () => {
  const before = draft();
  before.brief = '';
  const empty = JSON.stringify(envelope(before));
  const padding = MAX_SCOPE_DRAFT_BYTES - Buffer.byteLength(empty);
  before.brief = 'a'.repeat(padding);
  const boundary = JSON.stringify(envelope(before));
  assert.equal(Buffer.byteLength(boundary), MAX_SCOPE_DRAFT_BYTES);
  assert.equal(parseScopeDraftFile(boundary).brief.length, padding);
  before.brief = 'a'.repeat(padding - 1) + 'é';
  assert.equal(Buffer.byteLength(JSON.stringify(envelope(before))), MAX_SCOPE_DRAFT_BYTES + 1);
  assert.throws(() => open(envelope(before)), /1 MiB/);
  assert.throws(() => serializeScopeDraft(before), /1 MiB/);
});

test('invalid JSON and non-text inputs do not return partial drafts', () => {
  for (const text of ['', '{', '{"schema":', 'undefined']) assert.throws(() => parseScopeDraftFile(text));
  assert.throws(() => parseScopeDraftFile(new Uint8Array([123, 125])));
});
