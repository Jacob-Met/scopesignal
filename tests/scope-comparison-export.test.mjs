import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReview, draftFromFixture } from '../src/scope-plan.mjs';
import { encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeComparisonDocument, SCOPE_COMPARISON_FILENAME } from '../src/scope-comparison-export.mjs';

const original = () => structuredClone(draftFromFixture());
const lifecycle = [
  ['scope-1', 'approve', 'Recorded proof <literal> & 雪'],
  ['scope-1', 'order'], ['scope-1', 'request'], ['scope-1', 'lose'],
  ['scope-1', 'receipt'], ['scope-1', 'duplicate'], ['scope-1', 'reconcile']
];
function file(name, draft = original(), actions = null, pending = new Map()) {
  const review = actions === null ? null : createScopeReview(draft);
  for (const [id, action, evidence] of actions ?? []) review.act(id, action, evidence);
  return { name, contents: encodeScopeWorkspace({ draft, review, evidenceDrafts: pending }) };
}
const report = (left = file('A.json'), right = file('B.json'), pairs) =>
  createScopeComparisonDocument({ left, right, pairs });

test('exports a standalone full comparison with both file labels and all chosen pairs', () => {
  const html = report();
  assert.equal(SCOPE_COMPARISON_FILENAME, 'scopesignal-comparison-review.html');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /data-file="a">A.json</);
  assert.match(html, /data-file="b">B.json</);
  assert.equal((html.match(/data-pair=/g) ?? []).length, 3);
  assert.match(html, /all saved fields and both complete fixture event lists/i);
  assert.match(html, /data-field="stage"/);
  assert.match(html, /data-field="plannedEvidence"/);
  assert.match(html, /data-relationship="not-reviewed"/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<(script|iframe|img|object|embed|input|button|select|link)\b/i);
});

test('replays unknown and reconciled outcomes without counting webhook receipts twice', () => {
  const left = file('Unknown.json', original(), lifecycle.slice(0, 6), new Map([['scope-2', 'Not accepted']]));
  const right = file('Reconciled.json', original(), lifecycle);
  const html = report(left, right);
  assert.match(html, /data-relationship="a-prefix"/);
  assert.match(html, /All 6 events in A match the beginning of B/);
  assert.equal((html.match(/data-event="a-/g) ?? []).length, 6);
  assert.equal((html.match(/data-event="b-/g) ?? []).length, 7);
  assert.match(html, /data-field="captured"[^]*?<td data-side="a">\$0\.00<\/td><td data-side="b">\$400\.00/);
  assert.match(html, /data-field="captureStatus"[^]*?<td data-side="a">unknown<\/td><td data-side="b">captured/);
  assert.match(html, /Not accepted/);
  assert.match(html, /Recorded proof &lt;literal&gt; &amp; 雪/);
  assert.match(html, /Raw event amounts are integer cents/);
  assert.doesNotMatch(html, /\$800\.00<\/td><td data-side="b">\$800\.00/);
});

test('all real lifecycle prefixes have complete retained event lists and correct direction', () => {
  const full = file('full.json', original(), lifecycle);
  for (let n = 0; n <= lifecycle.length; n++) {
    const prefix = file('prefix.json', original(), lifecycle.slice(0, n));
    const html = report(full, prefix);
    assert.match(html, new RegExp('data-relationship="' + (n === 7 ? 'equal' : 'b-prefix') + '"'));
    assert.equal((html.match(/data-event="a-/g) ?? []).length, 7);
    assert.equal((html.match(/data-event="b-/g) ?? []).length, n);
  }
});

test('explicit pairing and unpaired rows remain visible without historical identity claims', () => {
  const left = file('left.json');
  const changed = original();
  changed.checkpoints[1].title = 'Different deliverable';
  const pairs = [[0, 1]];
  const before = JSON.stringify({ left, changed, pairs });
  const html = report(left, file('right.json', changed), pairs);
  assert.match(html, /data-pair="0-1"/);
  assert.equal((html.match(/data-pair=/g) ?? []).length, 1);
  assert.match(html, /Paired for review · Different row numbers/);
  assert.match(html, /data-unpaired="a-1"/);
  assert.match(html, /data-unpaired="a-2"/);
  assert.match(html, /data-unpaired="b-0"/);
  assert.match(html, /data-unpaired="b-2"/);
  assert.match(html, /no addition or removal is inferred/);
  assert.equal(JSON.stringify({ left, changed, pairs }), before);
});

test('duplicate definitions stay unpaired until explicitly chosen', () => {
  const draft = original();
  draft.checkpoints = [draft.checkpoints[0], structuredClone(draft.checkpoints[0])];
  const left = file('same-name.json', draft), right = file('same-name.json', draft);
  const automatic = report(left, right);
  assert.equal((automatic.match(/data-pair=/g) ?? []).length, 0);
  assert.equal((automatic.match(/data-unpaired=/g) ?? []).length, 4);
  const chosen = report(left, right, [[0, 1], [1, 0]]);
  assert.equal((chosen.match(/data-pair=/g) ?? []).length, 2);
  assert.equal((chosen.match(/data-unpaired=/g) ?? []).length, 0);
});

test('draft strings, unavailable values, empty evidence and literal markup are preserved distinctly', () => {
  const draft = original();
  draft.label = '  <img src=x onerror="boom"> & 雪  ';
  draft.brief = 'first\nsecond & third';
  draft.cap = 'to decide';
  draft.checkpoints[0] = { title: '<script>boom</script>', amount: '', evidence: '' };
  const html = report(file('A<&".json', draft), file('B.json', draft));
  assert.match(html, /&lt;img src=x onerror=&quot;boom&quot;&gt; &amp; 雪/);
  assert.match(html, /first\nsecond &amp; third/);
  assert.match(html, /&lt;script&gt;boom&lt;\/script&gt;/);
  assert.match(html, /A&lt;&amp;&quot;.json/);
  assert.match(html, /data-field="cap"[^]*?<td data-side="a">Not available/);
  assert.match(html, /data-field="amountText"[^]*?<td data-side="a">\(empty text\)/);
  assert.match(html, /data-field="approved"[^]*?<td data-side="a">Not available/);
  assert.doesNotMatch(html, /<img\b|<script\b/);
});

test('large safe cent values keep their exact cents', () => {
  const draft = original();
  draft.cap = '90071992547409.91';
  draft.checkpoints = [{ title: 'Exact cents', amount: '90071992547409.89', evidence: 'A literal large fixture amount' }];
  const html = report(file('A.json', draft, []), file('B.json', draft, []));
  assert.match(html, /\$90,071,992,547,409\.91/);
  assert.match(html, /\$90,071,992,547,409\.89/);
  assert.match(html, /data-field="unallocated"[^]*?<td data-side="a">\$0\.02/);
});

test('different plans and divergent evidence keep their separate history relationships', () => {
  const draft = original(); draft.checkpoints[0].title = 'Changed plan';
  assert.match(report(file('A', original(), lifecycle), file('B', draft, lifecycle)), /data-relationship="different-plans"/);
  assert.match(report(file('A', original(), [['scope-1', 'approve', 'A proof']]),
    file('B', original(), [['scope-1', 'approve', 'B proof']])), /data-relationship="divergent"/);
});

test('malformed files, unsupported data and non-injective pairs are refused before delivery', () => {
  const valid = file('valid.json');
  assert.throws(() => report({ ...valid, contents: '{' }, valid));
  const changed = JSON.parse(valid.contents); changed.paymentEvidence = true;
  assert.throws(() => report(valid, { ...valid, contents: JSON.stringify(changed) }));
  assert.throws(() => report(valid, valid, [[0, 0], [1, 0]]), /only once/);
  assert.throws(() => report(valid, valid, [[12, 0]]), /existing checkpoint/);
  assert.throws(() => createScopeComparisonDocument(), /Open both/);
  const invalidEvent = JSON.parse(file('events', original(), lifecycle).contents);
  invalidEvent.events[6].amount = 1;
  assert.throws(() => report(valid, { name: 'forged', contents: JSON.stringify(invalidEvent) }), /history/);
});

test('caller-supplied snapshots and totals cannot replace the admitted file facts', () => {
  const left = file('A.json', original(), lifecycle.slice(0, 4));
  left.workspace = { totals: { captured: 999999 }, rows: [] };
  const html = report(left, file('B.json', original(), lifecycle));
  assert.match(html, /data-field="captured"[^]*?<td data-side="a">\$0\.00<\/td><td data-side="b">\$400\.00/);
  assert.doesNotMatch(html, /999999/);
});

test('HTML-incompatible strings fail without modifying files and a valid retry still succeeds', () => {
  const good = file('good.json');
  for (const invalid of ['\0', '\ud800', '\udfff']) {
    const draft = original(); draft.brief = 'Before' + invalid + 'After';
    const bad = file('bad.json', draft), before = bad.contents;
    assert.throws(() => report(good, bad), /cannot be preserved in HTML/);
    assert.equal(bad.contents, before);
    assert.throws(() => report({ ...good, name: 'name' + invalid }, good), /cannot be preserved in HTML/);
  }
  assert.match(report(good, good), /Scope comparison review/);
});
