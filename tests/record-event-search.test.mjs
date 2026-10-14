import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedEventTextMatcher, MAX_EVENT_QUERY_LENGTH } from '../src/record-event-search.mjs';
import { createRecordEventFilter } from '../src/record-event-filter.mjs';
import { createFixtureRecord } from '../src/fixture-record.mjs';
import { readFixtureRecord } from '../src/record-reader.mjs';
import { createRecordReviewDocument } from '../src/record-review-export.mjs';

function savedRecord(extraDuplicates = 0) {
  const rows = [
    { type: 'checkpoint.approved', checkpointId: 'journey', approver: 'human-reviewer', acceptedEvidence: 'CAFÉ evidence\nLiteral <b>safe</b> and a.*b;  two spaces.' },
    { type: 'paypal.order.created', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', amount: 40000, currency: 'USD', environment: 'sandbox' },
    { type: 'paypal.capture.requested', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', environment: 'sandbox' },
    { type: 'paypal.capture.response_lost', checkpointId: 'journey', orderId: 'SANDBOX-JOURNEY', outcome: 'unknown' },
    { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-ONE', captureId: 'CAP-ONE', duplicate: false, amount: 40000, currency: 'USD' },
    { type: 'paypal.webhook.received', checkpointId: 'journey', eventId: 'WH-ONE', captureId: 'CAP-ONE', duplicate: true, amount: 40000, currency: 'USD' },
    { type: 'paypal.capture.reconciled', checkpointId: 'journey', captureId: 'CAP-ONE', outcome: 'captured', source: 'sandbox-transaction-lookup' },
    { type: 'checkpoint.approved', checkpointId: 'accessibility', approver: 'human-reviewer', acceptedEvidence: 'Cafe\u0301; literal \\n; keyboard walkthrough.' },
  ];
  for (let i = 0; i < extraDuplicates; i++) rows.push({ ...rows[5] });
  const events = rows.map((event, index) => ({ seq: index + 1, type: event.type, at: 'T+' + String(index + 1).padStart(3, '0'), ...event }));
  return readFixtureRecord(JSON.stringify(createFixtureRecord(events)));
}

test('literal saved scalar matching has explicit whitespace, Unicode and query boundaries', () => {
  assert.equal(MAX_EVENT_QUERY_LENGTH, 256);
  const event = Object.freeze({ acceptedEvidence: 'CAFÉ\n<b>safe</b> a.*b  two spaces', orderId: 'ORD-α', amount: 40000, duplicate: false });
  for (const query of ['', 'café', '\n', '<b>safe</b>', 'a.*b', '  two', 'ord-Α', '40000', 'false']) {
    assert.equal(createSavedEventTextMatcher(query)(event), true, JSON.stringify(query));
  }
  for (const query of ['cafe\u0301', '\\n', 'acceptedEvidence', 'safe.*b', 'café ord', ' CAFÉ', 'true']) {
    assert.equal(createSavedEventTextMatcher(query)(event), false, JSON.stringify(query));
  }
  assert.equal(createSavedEventTextMatcher('two spacesORD')(event), false);
  assert.equal(createSavedEventTextMatcher('😀'.repeat(128))({ text: '😀'.repeat(128) }), true);
  assert.equal(createSavedEventTextMatcher('x'.repeat(256))({ text: 'x'.repeat(256) }), true);
  for (const value of ['x'.repeat(257), '😀'.repeat(129)]) assert.throws(() => createSavedEventTextMatcher(value), RangeError);
  for (const value of [null, undefined, 0, false, [], {}, new String('query')]) assert.throws(() => createSavedEventTextMatcher(value), TypeError);
  assert.equal(createSavedEventTextMatcher('left-right')({ first: 'left-', second: 'right' }), false);
  assert.equal(createSavedEventTextMatcher('straße')({ evidence: 'STRASSE' }), false, 'Lowercasing is not full Unicode case folding.');
});

test('admitted saved records retain references, exact evidence and complete exports through intersections', () => {
  const record = savedRecord();
  const original = JSON.stringify(record);
  const originalEvents = [...record.events];
  const originalExport = createRecordReviewDocument(record, 'fictional.json');
  const selected = (query, checkpoint = '', type = '') => record.events.filter(event =>
    (!checkpoint || event.checkpointId === checkpoint) && (!type || event.type === type)
    && createSavedEventTextMatcher(query)(event));
  assert.deepEqual(selected('cap-one').map(event => event.seq), [5, 6, 7]);
  assert.deepEqual(selected('cap-one', 'journey', 'paypal.webhook.received').map(event => event.seq), [5, 6]);
  assert.deepEqual(selected('cap-one', 'accessibility').map(event => event.seq), []);
  assert.deepEqual(selected('true').map(event => event.seq), [6]);
  assert.deepEqual(selected('false').map(event => event.seq), [5]);
  assert.deepEqual(selected('40000').map(event => event.seq), [2, 5, 6]);
  assert.deepEqual(selected('café').map(event => event.seq), [1]);
  assert.deepEqual(selected('cafe\u0301').map(event => event.seq), [8]);
  assert.deepEqual(selected('First-run checklist').map(event => event.seq), []);
  assert.deepEqual(selected('checkpoint.approved').map(event => event.seq), [1, 8]);
  assert.equal(selected('cap-one')[1], record.events[5]);
  assert.equal(JSON.stringify(record), original);
  assert.ok(originalEvents.every((event, index) => event === record.events[index]));
  assert.ok(Object.isFrozen(record) && record.events.every(Object.isFrozen));
  assert.equal(createRecordReviewDocument(record, 'fictional.json'), originalExport);
  assert.ok(originalExport.includes('events.7.acceptedEvidence'), 'The full download still contains an excluded event.');
});

test('the current512-event admission bound retains every duplicate and exact original sequence', () => {
  const record = savedRecord(504);
  assert.equal(record.events.length, 512);
  const snapshots = record.events.map(event => JSON.stringify(event));
  const duplicates = record.events.filter(createSavedEventTextMatcher('true'));
  assert.equal(duplicates.length, 505);
  assert.equal(duplicates[0], record.events[5]);
  assert.equal(duplicates.at(-1), record.events[511]);
  assert.deepEqual(duplicates.map(event => event.seq), [6, ...Array.from({ length: 504 }, (_, index) => index + 9)]);
  assert.equal(record.summary.captured, 40000);
  assert.deepEqual(record.events.map(event => JSON.stringify(event)), snapshots);
  assert.equal(record.events.filter(createSavedEventTextMatcher('unmatched')).length, 0);
  assert.equal(record.events.filter(createSavedEventTextMatcher('')).length, 512);
});

// Declared small DOM harness: records actual element identity, values, listeners,
// visibility, attributes and focus. It does not simulate browser layout or input.
class Element {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = document;
    this.children = []; this.attributes = {}; this.listeners = {};
    this.value = ''; this.text = ''; this.hidden = false; this.disabled = false; this.open = false;
  }
  set textContent(text) { this.text = text; this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...elements) { this.children.push(...elements); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  get selectedOptions() { return this.children.filter(child => child.value === this.value); }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  dispatch(name) { for (const callback of this.listeners[name] || []) callback({ type: name, target: this }); }
  focus() { this.ownerDocument.activeElement = this; }
}
function find(element, predicate) {
  if (predicate(element)) return element;
  for (const child of element.children) { const match = find(child, predicate); if (match) return match; }
  return null;
}

test('the filter composes all three controls without rebuilding rows and repairs invalid queries', () => {
  const previous = globalThis.document;
  const document = { activeElement: null, createElement(tag) { return new Element(tag, this); } };
  globalThis.document = document;
  try {
    const record = savedRecord();
    const recordBefore = JSON.stringify(record);
    const list = document.createElement('ol');
    const rows = record.events.map(event => {
      const row = document.createElement('li');
      const details = document.createElement('details'); details.open = event.seq === 6;
      const raw = document.createElement('pre'); raw.textContent = JSON.stringify(event, null, 2);
      details.append(raw); row.append(details); return row;
    });
    list.append(...rows);
    const details = rows.map(row => row.children[0]);
    const raw = details.map(detail => detail.children[0]);
    const labels = { 'checkpoint.approved': 'Approval', 'paypal.order.created': 'Order', 'paypal.capture.requested': 'Request', 'paypal.capture.response_lost': 'Lost response', 'paypal.webhook.received': 'Webhook', 'paypal.capture.reconciled': 'Lookup' };
    const panel = createRecordEventFilter(record, list, labels);
    const byId = id => find(panel, element => element.id === id);
    const query = byId('record-event-query'); const checkpoint = byId('record-event-checkpoint'); const type = byId('record-event-type');
    const count = byId('record-event-count'); const error = byId('record-event-search-error');
    const reset = find(panel, element => element.tagName === 'BUTTON');
    const visible = () => rows.flatMap((row, index) => row.hidden ? [] : [index + 1]);
    assert.equal(query.type, 'search'); assert.equal(query.maxLength, 256); assert.equal(query.autocomplete, 'off'); assert.equal(query.spellcheck, false);
    assert.equal(reset.disabled, true); assert.deepEqual(visible(), [1, 2, 3, 4, 5, 6, 7, 8]);
    query.value = 'CAP-ONE'; query.dispatch('input');
    assert.deepEqual(visible(), [5, 6, 7]); assert.equal(reset.disabled, false); assert.ok(count.textContent.includes('Search: “CAP-ONE”'));
    type.value = 'paypal.webhook.received'; type.dispatch('change');
    assert.deepEqual(visible(), [5, 6]);
    checkpoint.value = 'accessibility'; checkpoint.dispatch('change');
    assert.deepEqual(visible(), []); assert.equal(list.hidden, true); assert.ok(count.textContent.startsWith('Showing 0 of 8'));
    const hiddenStatus = count.textContent;
    query.value = 'x'.repeat(257); query.dispatch('input');
    assert.deepEqual(visible(), []); assert.equal(count.textContent, hiddenStatus); assert.equal(error.hidden, false); assert.equal(query.attributes['aria-invalid'], 'true');
    query.value = 'cap-one'; checkpoint.value = 'journey'; query.dispatch('input');
    assert.deepEqual(visible(), [5, 6]); assert.equal(error.hidden, true); assert.equal(query.attributes['aria-invalid'], undefined);
    assert.equal(details[5].open, true, 'Hidden and restored duplicate keeps its open disclosure.');
    assert.ok(rows.every((row, index) => list.children[index] === row && row.children[0] === details[index] && details[index].children[0] === raw[index]));
    query.value = 'x'.repeat(257); query.dispatch('input'); reset.dispatch('click');
    assert.equal(query.value, ''); assert.equal(type.value, ''); assert.equal(checkpoint.value, ''); assert.equal(document.activeElement, checkpoint);
    assert.deepEqual(visible(), [1, 2, 3, 4, 5, 6, 7, 8]); assert.equal(reset.disabled, true); assert.equal(error.hidden, true);
    assert.equal(JSON.stringify(record), recordBefore); assert.equal(details[5].open, true);
    const emptyList = document.createElement('ol');
    const emptyPanel = createRecordEventFilter(readFixtureRecord(JSON.stringify(createFixtureRecord([]))), emptyList, labels);
    for (const id of ['record-event-query', 'record-event-checkpoint', 'record-event-type']) assert.equal(find(emptyPanel, element => element.id === id).disabled, true);
    assert.equal(find(emptyPanel, element => element.tagName === 'BUTTON').disabled, true);
    assert.equal(emptyList.hidden, true);
  } finally {
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});
