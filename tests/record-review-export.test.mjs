import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, replayFixture } from '../src/ledger.mjs';
import { createFixtureRecord } from '../src/fixture-record.mjs';
import { FixtureRecordError, readFixtureRecord } from '../src/record-reader.mjs';
import { createRecordReviewDocument, RECORD_REVIEW_FILENAME } from '../src/record-review-export.mjs';

function values(html) {
  // Check the complete text-node field contract. Real HTML parsing and print
  // fidelity are received separately in the native browser course.
  return new Map([...html.matchAll(/<(?:dd|p)\b[^>]*data-field="([^"]+)">([\s\S]*?)<\/(?:dd|p)>/g)]
    .map(([, path, value]) => [path, value]));
}
function expectedFields(record) {
  const rows = new Map();
  function visit(value, path) {
    if (value === null || typeof value !== 'object') rows.set(path, String(value));
    else for (const [key, child] of Object.entries(value)) visit(child, path ? path + '.' + key : key);
  }
  for (const [key, value] of Object.entries(record)) {
    visit(value, ['fixture', 'summary', 'checkpoints', 'events'].includes(key) ? key : 'record.' + key);
  }
  return rows;
}
function approved(text) {
  const ledger = createLedger();
  ledger.append('checkpoint.approved', { checkpointId: 'journey', approver: 'human-reviewer', acceptedEvidence: text });
  return createFixtureRecord(ledger.events);
}

test('all eight ordinary history prefixes retain every scalar fact, outcome and duplicate', () => {
  const events = replayFixture().events;
  const states = ['not_started', 'not_started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
  for (let count = 0; count <= events.length; count++) {
    const record = createFixtureRecord(events.slice(0, count));
    const html = createRecordReviewDocument(record, 'saved.json');
    const actual = values(html);
    assert.equal(actual.get('filename'), 'saved.json');
    actual.delete('filename');
    assert.deepEqual(actual, expectedFields(record));
    assert.equal(actual.get('checkpoints.0.capture.status'), states[count]);
    assert.equal(actual.get('summary.captured'), count === 7 ? '40000' : '0');
  }
});

test('literal whitespace and Unicode use text escaping without script or C1 substitution', () => {
  const evidence = '\n\r\n\t\u0080 Café 😀 </dd><img src=x> & "quoted" \'tail\'\r';
  const record = approved(evidence);
  const html = createRecordReviewDocument(record, evidence);
  const actual = values(html);
  const expected = '\n&#13;\n\t\u0080 Café 😀 &lt;/dd&gt;&lt;img src=x&gt; &amp; &quot;quoted&quot; &#39;tail&#39;&#13;';
  assert.equal(actual.get('filename'), expected);
  assert.equal(actual.get('checkpoints.0.approval.acceptedEvidence'), expected);
  assert.equal(actual.get('events.0.acceptedEvidence'), expected);
  assert(!html.includes('<img'));
  assert(!html.includes('&#128;'));
  assert(!html.includes('<pre'));
});

test('refuses HTML-unrepresentable evidence or file labels without changing the record', () => {
  for (const text of ['kept\0text', 'kept\ud800text', 'kept\udffftext']) {
    const record = approved(text);
    const before = JSON.stringify(record);
    assert.throws(() => createRecordReviewDocument(record, 'saved.json'), /cannot be preserved/);
    assert.equal(JSON.stringify(record), before);
    assert.throws(() => createRecordReviewDocument(createFixtureRecord([]), text), /cannot be preserved/);
  }
  assert.throws(() => createRecordReviewDocument(createFixtureRecord([]), null), /text file label/);
});

test('complete native admission refuses inconsistent, unsupported and malformed histories', () => {
  for (const change of [
    record => { record.summary.captured = 0; },
    record => { record.version = 2; },
    record => { record.paymentEvidence = true; },
    record => { record.events[0].at = 'tomorrow'; },
    record => { record.extra = true; },
  ]) {
    const record = createFixtureRecord(replayFixture().events);
    change(record);
    assert.throws(() => createRecordReviewDocument(record, 'saved.json'), FixtureRecordError);
  }
});

test('an admitted frozen record remains exact and exports deterministically', () => {
  const record = readFixtureRecord(JSON.stringify(createFixtureRecord(replayFixture().events)));
  const before = JSON.stringify(record);
  const first = createRecordReviewDocument(record, 'first.json');
  assert.equal(createRecordReviewDocument(record, 'first.json'), first);
  assert.equal(JSON.stringify(record), before);
  assert(Object.isFrozen(record.events[0]));
  assert.equal(RECORD_REVIEW_FILENAME, 'scopesignal-record-review.html');
});

test('the report has no active or remote content and labels its complete fictional cents/history', () => {
  const html = createRecordReviewDocument(createFixtureRecord([]), '');
  assert(!/<(?:script|iframe|form|input|button|link|img|object|embed)\b/i.test(html));
  assert(!/\b(?:href|src|srcset|onload|onclick)\s*=/i.test(html));
  assert(!/url\s*\(|@import/i.test(html));
  assert.match(html, /Synthetic fixture · Not payment evidence/);
  assert.match(html, /USD integer cents, not dollars/);
  assert.match(html, /T\+ values are sequence markers, not clock times/);
  assert.match(html, /No fixture events are recorded/);
  assert.match(html, /@media print/);
  assert.equal(values(html).get('checkpoints.0.approval'), 'null');
  assert.equal(values(html).get('record.paymentEvidence'), 'false');
  assert.equal(values(html).get('record.fixtureOnly'), 'true');
});
