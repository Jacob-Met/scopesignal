import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReviewDocument, SCOPE_REVIEW_FILENAME } from '../src/scope-review-export.mjs';
import { createScopeReview } from '../src/scope-plan.mjs';
import { encodeScopeWorkspace, decodeScopeWorkspace } from '../src/scope-workspace-record.mjs';

const authored = () => ({
  label: 'Independent trail map', brief: 'Draw the north trail.\nKeep the two route alternatives.', cap: '901.23',
  checkpoints: [
    { title: 'Route sketch', amount: '123.45', evidence: 'Two marked alternatives' },
    { title: 'Final guide', amount: '678.90', evidence: 'Readable at pocket size' }
  ]
});
const field = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;
const selected = (html, label) => {
  const safe = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...html.matchAll(new RegExp(`<dt>${safe}</dt><dd>(.*?)</dd>`, 'gs'))].map(match => match[1]);
};
const approve = (review, id, evidence) => review.act(id, 'approve', evidence);
const invoke = (review, id, actions) => actions.forEach(action => review.act(id, action));

test('unfinished fields remain an unapproved raw draft without invented monetary totals', () => {
  const draft = { label: '', brief: '\nunfinished  brief 🧭\n', cap: '1,2.', checkpoints: [
    { title: '', amount: ' 00.', evidence: '\nNeed a reviewer\n' }
  ] };
  const before = structuredClone(draft);
  const html = createScopeReviewDocument({ draft });
  assert.ok(html.includes('Unfinished fictional draft'));
  assert.ok(html.includes(field('Brief', draft.brief)));
  assert.ok(html.includes(field('Project cap in USD (as entered, not validated)', '1,2.')));
  assert.ok(html.includes(field('Amount in USD (as entered, not validated)', ' 00.')));
  assert.ok(html.includes('No fixture events have been recorded.'));
  assert.ok(!html.includes('<dt>Simulated captured (USD)</dt>'));
  assert.deepEqual(draft, before);
});

test('review uses recorded acceptance and preserves separate pending evidence and unallocated cap', () => {
  const draft = authored();
  const review = createScopeReview(draft);
  approve(review, 'scope-1', '\nAccepted route sketch\n');
  const evidenceDrafts = new Map([
    ['scope-1', 'Stale editor text must not become acceptance'],
    ['scope-2', '\nPending pocket proof 🗺️\n']
  ]);
  const before = encodeScopeWorkspace({ draft, review, evidenceDrafts });
  const html = createScopeReviewDocument({ draft, review, evidenceDrafts });
  // Native approval trims its input before recording; export must retain that
  // recorded text rather than resurrecting the pre-approval editor value.
  assert.deepEqual(selected(html, 'Accepted evidence — from recorded approval'), ['Accepted route sketch']);
  assert.deepEqual(selected(html, 'Pending evidence — not approved'), ['\nPending pocket proof 🗺️\n']);
  assert.ok(!html.includes('Stale editor text must not become acceptance'));
  for (const [label, value] of [
    ['Project cap (USD)', '$901.23'], ['Allocated to checkpoints (USD)', '$802.35'],
    ['Unallocated cap (USD)', '$98.88'], ['Simulated captured (USD)', '$0.00'],
    ['Allocated remaining (USD)', '$802.35'], ['Recorded approvals', '1 of 2']
  ]) assert.deepEqual(selected(html, label), [value]);
  assert.equal(encodeScopeWorkspace({ draft, review, evidenceDrafts }), before);
});

test('every allowed first-checkpoint phase exports native current state and exact recorded fields', () => {
  const draft = authored();
  const review = createScopeReview(draft);
  const states = ['not started', 'not started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
  const actions = [null, 'approve', 'order', 'request', 'lose', 'receipt', 'duplicate', 'reconcile'];
  for (const [index, action] of actions.entries()) {
    if (action) review.act('scope-1', action, 'Approved route');
    const snapshot = review.snapshot();
    const before = JSON.stringify(snapshot);
    const html = createScopeReviewDocument({ draft, review });
    assert.equal(selected(html, 'Current simulated capture state')[0], states[index]);
    assert.deepEqual(selected(html, 'Simulated captured (USD)'), [index === 7 ? '$123.45' : '$0.00']);
    assert.equal((html.match(/<li><h3>Event /g) ?? []).length, snapshot.events.length);
    assert.ok(html.includes('Raw event amounts are integer cents in the recorded currency'));
    for (const event of snapshot.events) {
      for (const [key, value] of Object.entries(event)) assert.ok(html.includes(field(key, String(value))));
    }
    assert.equal(JSON.stringify(review.snapshot()), before);
  }
});

test('a completed first checkpoint does not hide a second unknown capture or count its duplicate receipt', () => {
  const draft = authored();
  const review = createScopeReview(draft);
  approve(review, 'scope-1', 'First accepted');
  invoke(review, 'scope-1', ['order', 'request', 'receipt']);
  approve(review, 'scope-2', 'Second accepted');
  invoke(review, 'scope-2', ['order', 'request', 'lose', 'receipt', 'duplicate']);
  const encoded = encodeScopeWorkspace({ draft, review });
  const restored = decodeScopeWorkspace(encoded);
  const html = createScopeReviewDocument(restored);
  assert.deepEqual(selected(html, 'Current simulated capture state'), ['captured', 'unknown']);
  assert.deepEqual(selected(html, 'Simulated captured (USD)'), ['$123.45']);
  assert.deepEqual(selected(html, 'Allocated remaining (USD)'), ['$678.90']);
  assert.deepEqual(selected(html, 'Unallocated cap (USD)'), ['$98.88']);
  assert.deepEqual(selected(html, 'duplicate'), ['false', 'false', 'true']);
  assert.equal(createScopeReviewDocument({ draft, review }), html);
  assert.equal(encodeScopeWorkspace({ draft, review }), encoded);
});

test('a portable review keeps literal authored markup inert and has no executable or external resources', () => {
  const draft = authored();
  draft.label = '<img src=x onerror="bad()"> & 🧭';
  draft.brief = '</style><script>bad()</script>\nLiteral & text';
  draft.checkpoints[0].title = '<a href="https://example.invalid">link</a>';
  const review = createScopeReview(draft);
  approve(review, 'scope-1', '<svg onload="bad()">\n& approved');
  const html = createScopeReviewDocument({ draft, review });
  assert.ok(html.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; 🧭'));
  assert.ok(html.includes('&lt;/style&gt;&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(html.includes('&lt;svg onload=&quot;bad()&quot;&gt;\n&amp; approved'));
  assert.ok(!/<script\b|<link\b|<img\b|<iframe\b|<form\b|<input\b|<button\b|<[^>]*\s(?:src|href)=/i.test(html));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('.events li{break-inside:avoid;'));
  assert.ok(html.includes('Fictional snapshot · no live payments'));
  assert.equal(SCOPE_REVIEW_FILENAME, 'scopesignal-scope-review.html');
});

test('large valid cent amounts retain exact cents rather than rounded floating dollar values', () => {
  const draft = { label: 'Large synthetic control', brief: 'Exact integer cents only.', cap: '90071992547409.91',
    checkpoints: [{ title: 'One checkpoint', amount: '90071992547409.89', evidence: 'Two cents unallocated' }] };
  const review = createScopeReview(draft);
  const html = createScopeReviewDocument({ draft, review });
  assert.deepEqual(selected(html, 'Project cap (USD)'), ['$90,071,992,547,409.91']);
  assert.deepEqual(selected(html, 'Milestone amount (USD)'), ['$90,071,992,547,409.89']);
  assert.deepEqual(selected(html, 'Unallocated cap (USD)'), ['$0.02']);
});

test('inconsistent caller snapshots and invalid source are refused without mutating a valid prior review', () => {
  const draft = authored();
  const review = createScopeReview(draft);
  approve(review, 'scope-1', 'Accepted');
  const snapshot = review.snapshot();
  const before = JSON.stringify(snapshot);
  const forged = structuredClone(snapshot);
  forged.captured = 12345;
  assert.throws(() => createScopeReviewDocument({ draft, review: { snapshot: () => forged } }), /do not match/);
  const wrongDraft = structuredClone(draft);
  wrongDraft.checkpoints[0].amount = '100.00';
  assert.throws(() => createScopeReviewDocument({ draft: wrongDraft, review }), /match|history/);
  const excessive = { ...draft, brief: 'x'.repeat(8001) };
  assert.throws(() => createScopeReviewDocument({ draft: excessive }), /at most/);
  assert.equal(JSON.stringify(review.snapshot()), before);
});

test('HTML-normalized text is preserved by references or refused before creating a lossy document', () => {
  const draft = authored();
  draft.brief = 'First\r\nSecond\rThird\n';
  // Current owner codec refuses field values the native editor cannot retain.
  assert.throws(() => createScopeReviewDocument({ draft }), /LF line breaks/);
  draft.brief = 'Ordinary LF\nbrief';
  const review = createScopeReview(draft);
  review.act('scope-1', 'approve', 'Recorded\r\napproval\rtext');
  assert.ok(createScopeReviewDocument({ draft, review }).includes('Recorded&#13;\napproval&#13;text'));
  for (const text of ['before\0after', 'before\ud800after', 'before\udfffafter']) {
    draft.brief = text;
    const saved = encodeScopeWorkspace({ draft });
    assert.throws(() => createScopeReviewDocument({ draft }), /cannot be preserved in HTML/);
    assert.equal(encodeScopeWorkspace({ draft }), saved);
  }
});
