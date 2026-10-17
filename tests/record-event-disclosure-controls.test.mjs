import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordEventFilter } from '../src/record-event-filter.mjs';
import { createFixtureRecord } from '../src/fixture-record.mjs';
import { readFixtureRecord } from '../src/record-reader.mjs';
import { createRecordReviewDocument } from '../src/record-review-export.mjs';

// Manually stated complete fixture; the delivered example has this exact JSON.
// The maintained reader checks all redundant facts, not just these event inputs.
const MANUAL_RECORD = {
  "schema": "scopesignal.fixture-record",
  "version": 1,
  "ledgerSpecVersion": 1,
  "fixtureOnly": true,
  "paymentEvidence": false,
  "notice": "Synthetic ScopeSignal fixture. This is not a payment receipt or evidence of a real transaction.",
  "fixture": {
    "id": "fixture-signal-studio",
    "label": "Northstar onboarding refresh",
    "currency": "USD",
    "amount": 120000
  },
  "summary": {
    "total": 120000,
    "approved": 2,
    "captured": 40000,
    "remaining": 80000
  },
  "checkpoints": [
    {
      "id": "journey",
      "title": "First-run checklist",
      "amount": 40000,
      "approval": {
        "source": "checkpoint.approved",
        "eventSequence": 1,
        "approver": "human-reviewer",
        "acceptedEvidence": "Visible <literal> evidence\nKeyboard route."
      },
      "capture": {
        "status": "captured",
        "orderId": "SANDBOX-JOURNEY",
        "captureId": "CAP-SHOWN-001",
        "counted": 40000
      }
    },
    {
      "id": "accessibility",
      "title": "Accessible billing setup",
      "amount": 40000,
      "approval": {
        "source": "checkpoint.approved",
        "eventSequence": 8,
        "approver": "human-reviewer",
        "acceptedEvidence": "Second fictional review."
      },
      "capture": {
        "status": "not_started",
        "orderId": null,
        "captureId": null,
        "counted": 0
      }
    },
    {
      "id": "handoff",
      "title": "Responsive handoff",
      "amount": 40000,
      "approval": null,
      "capture": {
        "status": "not_started",
        "orderId": null,
        "captureId": null,
        "counted": 0
      }
    }
  ],
  "events": [
    {
      "seq": 1,
      "at": "T+001",
      "type": "checkpoint.approved",
      "checkpointId": "journey",
      "approver": "human-reviewer",
      "acceptedEvidence": "Visible <literal> evidence\nKeyboard route."
    },
    {
      "seq": 2,
      "at": "T+002",
      "type": "paypal.order.created",
      "checkpointId": "journey",
      "orderId": "SANDBOX-JOURNEY",
      "amount": 40000,
      "currency": "USD",
      "environment": "sandbox"
    },
    {
      "seq": 3,
      "at": "T+003",
      "type": "paypal.capture.requested",
      "checkpointId": "journey",
      "orderId": "SANDBOX-JOURNEY",
      "environment": "sandbox"
    },
    {
      "seq": 4,
      "at": "T+004",
      "type": "paypal.capture.response_lost",
      "checkpointId": "journey",
      "orderId": "SANDBOX-JOURNEY",
      "outcome": "unknown"
    },
    {
      "seq": 5,
      "at": "T+005",
      "type": "paypal.webhook.received",
      "checkpointId": "journey",
      "eventId": "WH-SHOWN-001",
      "captureId": "CAP-SHOWN-001",
      "duplicate": false,
      "amount": 40000,
      "currency": "USD"
    },
    {
      "seq": 6,
      "at": "T+006",
      "type": "paypal.webhook.received",
      "checkpointId": "journey",
      "eventId": "WH-SHOWN-001",
      "captureId": "CAP-SHOWN-001",
      "duplicate": true,
      "amount": 40000,
      "currency": "USD"
    },
    {
      "seq": 7,
      "at": "T+007",
      "type": "paypal.capture.reconciled",
      "checkpointId": "journey",
      "captureId": "CAP-SHOWN-001",
      "outcome": "captured",
      "source": "sandbox-transaction-lookup"
    },
    {
      "seq": 8,
      "at": "T+008",
      "type": "checkpoint.approved",
      "checkpointId": "accessibility",
      "approver": "human-reviewer",
      "acceptedEvidence": "Second fictional review."
    }
  ]
};
const labels = {
  'checkpoint.approved': 'Approval', 'paypal.order.created': 'Order',
  'paypal.capture.requested': 'Request', 'paypal.capture.response_lost': 'Lost response',
  'paypal.webhook.received': 'Webhook', 'paypal.capture.reconciled': 'Lookup',
};

// Declared small DOM harness. It records nodes, properties, listeners and focus;
// it does not simulate native input, browser layout, file opening or accessibility.
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
function withDocument(check) {
  const previous = globalThis.document;
  const document = { activeElement: null, createElement(tag) { return new Element(tag, this); } };
  globalThis.document = document;
  try { check(document); }
  finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}
function view(document, record, initiallyOpen = []) {
  const list = document.createElement('ol');
  const rows = record.events.map(event => {
    const row = document.createElement('li');
    const details = document.createElement('details'); details.open = initiallyOpen.includes(event.seq);
    const summary = document.createElement('summary'); summary.textContent = String(event.seq);
    const raw = document.createElement('pre'); raw.textContent = JSON.stringify(event, null, 2);
    details.append(summary, raw); row.append(details); return row;
  });
  list.append(...rows);
  const details = rows.map(row => row.children[0]);
  const raw = details.map(detail => detail.children[1]);
  const rawBefore = raw.map(element => element.textContent);
  const modelBefore = JSON.stringify(record);
  const eventRefs = [...record.events];
  const reviewBefore = createRecordReviewDocument(record, 'shown-events.fixture.json');
  const panel = createRecordEventFilter(record, list, labels);
  const byId = id => find(panel, element => element.id === id);
  const controls = {
    query: byId('record-event-query'), checkpoint: byId('record-event-checkpoint'), type: byId('record-event-type'),
    expand: byId('record-events-expand-shown'), collapse: byId('record-events-collapse-shown'),
    status: byId('record-event-disclosure-status'), count: byId('record-event-count'), error: byId('record-event-search-error'),
    reset: find(panel, element => element.tagName === 'BUTTON' && element.textContent === 'Show all events'),
  };
  const visible = () => rows.flatMap((row, i) => row.hidden ? [] : [i + 1]);
  const opened = () => details.flatMap((detail, i) => detail.open ? [i + 1] : []);
  const apply = (control, value) => { controls[control].value = value; controls[control].dispatch(control === 'query' ? 'input' : 'change'); };
  const activate = name => { controls[name].focus(); controls[name].dispatch('click'); assert.equal(document.activeElement, controls[name]); };
  const unchanged = () => {
    assert.equal(JSON.stringify(record), modelBefore);
    assert.equal(createRecordReviewDocument(record, 'shown-events.fixture.json'), reviewBefore);
    assert.deepEqual(raw.map(element => element.textContent), rawBefore);
    assert.ok(rows.every((row, i) => list.children[i] === row && row.children[0] === details[i]
      && details[i].children[1] === raw[i] && record.events[i] === eventRefs[i]));
  };
  return { record, panel, list, rows, details, raw, controls, visible, opened, apply, activate, unchanged };
}
const admitted = () => readFixtureRecord(JSON.stringify(MANUAL_RECORD));

test('shown disclosure controls preserve hidden states, original nodes and the complete record', () => withDocument(document => {
  const record = admitted();
  assert.deepEqual(record, MANUAL_RECORD, 'The manual playable fixture agrees with every maintained ledger fact.');
  const v = view(document, record, [1, 6, 8]);
  assert.equal(v.controls.expand.type, 'button'); assert.equal(v.controls.collapse.type, 'button');
  assert.deepEqual(v.controls.status.attributes, { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  v.apply('query', 'cap-shown-001'); v.apply('checkpoint', 'journey'); v.apply('type', 'paypal.webhook.received');
  assert.deepEqual(v.visible(), [5, 6]);
  const beforeCount = v.controls.count.textContent;
  v.activate('expand'); assert.deepEqual(v.opened(), [1, 5, 6, 8]);
  assert.equal(v.controls.status.textContent, 'Expanded 2 shown events.');
  v.activate('collapse'); assert.deepEqual(v.opened(), [1, 8]);
  assert.equal(v.controls.status.textContent, 'Collapsed 2 shown events.');
  assert.equal(v.controls.count.textContent, beforeCount);
  assert.equal(v.controls.query.value, 'cap-shown-001'); assert.equal(v.controls.checkpoint.value, 'journey');
  assert.equal(v.controls.type.value, 'paypal.webhook.received');
  assert.equal(v.raw[0].textContent.includes('Visible <literal> evidence\\nKeyboard route.'), true);
  v.apply('query', 'true'); assert.equal(v.controls.status.textContent, ''); assert.deepEqual(v.visible(), [6]);
  v.activate('expand'); assert.equal(v.controls.status.textContent, 'Expanded 1 shown event.');
  assert.deepEqual(v.opened(), [1, 6, 8]); v.unchanged();
}));

test('invalid queries retain the actionable last view; zero matches and empty records disable both actions', () => withDocument(document => {
  const v = view(document, admitted(), [1, 8]);
  v.apply('query', 'CAP-SHOWN-001'); assert.deepEqual(v.visible(), [5, 6, 7]);
  const count = v.controls.count.textContent;
  v.apply('query', 'x'.repeat(257));
  const error = v.controls.error.textContent;
  assert.equal(v.controls.error.hidden, false); assert.equal(v.controls.query.attributes['aria-invalid'], 'true');
  v.activate('expand'); assert.deepEqual(v.opened(), [1, 5, 6, 7, 8]);
  assert.equal(v.controls.status.textContent, 'Expanded 3 shown events.');
  v.activate('collapse'); assert.deepEqual(v.opened(), [1, 8]);
  assert.deepEqual(v.visible(), [5, 6, 7]); assert.equal(v.controls.count.textContent, count);
  assert.equal(v.controls.error.textContent, error); assert.equal(v.controls.query.value.length, 257);
  assert.equal(v.controls.query.attributes['aria-invalid'], 'true');
  v.apply('query', 'no matching saved value'); assert.deepEqual(v.visible(), []);
  assert.equal(v.controls.status.textContent, ''); assert.equal(v.controls.error.hidden, true);
  assert.equal(v.controls.expand.disabled, true); assert.equal(v.controls.collapse.disabled, true);
  const openBefore = v.opened();
  // Deliberately dispatch despite disabled: tests the defensive handler guard,
  // not a claim that a browser permits disabled-button activation.
  v.controls.expand.dispatch('click'); v.controls.collapse.dispatch('click');
  assert.deepEqual(v.opened(), openBefore); assert.equal(v.controls.status.textContent, ''); v.unchanged();
  const empty = view(document, readFixtureRecord(JSON.stringify(createFixtureRecord([]))));
  assert.equal(empty.controls.expand.disabled, true); assert.equal(empty.controls.collapse.disabled, true);
  empty.controls.expand.dispatch('click'); empty.controls.collapse.dispatch('click');
  assert.equal(empty.controls.status.textContent, ''); assert.deepEqual(empty.opened(), []); empty.unchanged();
}));

test('reset and repeat actions retain disclosures, and detached controls cannot affect a replacement view', () => withDocument(document => {
  const old = view(document, admitted(), [1, 8]);
  old.apply('query', 'CAP-SHOWN-001'); old.activate('expand'); old.activate('expand');
  assert.deepEqual(old.opened(), [1, 5, 6, 7, 8]);
  old.controls.reset.dispatch('click');
  assert.deepEqual(old.visible(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(old.opened(), [1, 5, 6, 7, 8]);
  assert.equal(old.controls.status.textContent, ''); assert.equal(document.activeElement, old.controls.checkpoint);
  const host = document.createElement('section'); host.append(old.panel, old.list);
  const current = view(document, admitted(), [2]);
  host.textContent = ''; host.append(current.panel, current.list);
  // This is an explicit old/new panel ownership control, not the file-reading
  // lifecycle. The latter remains owned by the unchanged record-view module.
  old.controls.collapse.dispatch('click'); old.controls.collapse.dispatch('click');
  assert.deepEqual(old.opened(), []); assert.deepEqual(current.opened(), [2]);
  assert.equal(current.controls.status.textContent, ''); assert.equal(host.children[0], current.panel);
  current.apply('query', 'second fictional'); current.activate('expand');
  assert.deepEqual(current.visible(), [8]); assert.deepEqual(current.opened(), [2, 8]);
  assert.deepEqual(old.opened(), []); old.unchanged(); current.unchanged();
}));

test('the admitted 512-event boundary keeps every duplicate and only changes shown disclosures', () => withDocument(document => {
  const events = structuredClone(MANUAL_RECORD.events);
  for (let i = 0; i < 504; i++) events.push({ ...MANUAL_RECORD.events[5], seq: i + 9, at: 'T+' + String(i + 9).padStart(3, '0') });
  const record = readFixtureRecord(JSON.stringify(createFixtureRecord(events)));
  const v = view(document, record, [1, 5]);
  assert.equal(record.events.length, 512); assert.equal(record.summary.captured, 40000);
  v.apply('query', 'true');
  const expected = [6, ...Array.from({ length: 504 }, (_, i) => i + 9)];
  assert.deepEqual(v.visible(), expected);
  v.activate('expand'); assert.deepEqual(v.opened(), [1, 5, ...expected]);
  assert.equal(v.controls.status.textContent, 'Expanded 505 shown events.');
  v.activate('collapse'); assert.deepEqual(v.opened(), [1, 5]);
  assert.equal(v.controls.status.textContent, 'Collapsed 505 shown events.');
  assert.deepEqual(record.events.map(event => event.seq), Array.from({ length: 512 }, (_, i) => i + 1));
  v.unchanged();
}));
