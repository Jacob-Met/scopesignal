import { FixtureRecordError, MAX_RECORD_BYTES, readFixtureRecord } from './record-reader.mjs';

const input = document.getElementById('record-file');
const clear = document.getElementById('clear-record');
const status = document.getElementById('record-status');
const error = document.getElementById('record-error');
const display = document.getElementById('record-display');
const jump = document.getElementById('jump-to-record');
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const stateLabels = {
  not_started: 'Not started', ready: 'Order ready', pending: 'Capture pending',
  unknown: 'Capture unknown', captured: 'Capture recorded',
};
const eventLabels = {
  'checkpoint.approved': 'Human approval recorded',
  'paypal.order.created': 'Fixture order created',
  'paypal.capture.requested': 'Capture requested',
  'paypal.capture.response_lost': 'Capture response lost',
  'paypal.webhook.received': 'Webhook received',
  'paypal.capture.reconciled': 'Capture reconciled',
};
let request = 0;
let opened = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fact(list, label, value) {
  const pair = element('div');
  pair.append(element('dt', '', label), element('dd', '', value));
  list.append(pair);
}

function captureNote(checkpoint) {
  switch (checkpoint.capture.status) {
    case 'captured': return 'This capture contributes ' + money(checkpoint.capture.counted) + ' to the recorded fixture total.';
    case 'unknown': return 'The saved history ends before reconciliation. No captured amount is counted for this checkpoint.';
    case 'pending': return 'A capture request is recorded, but the saved history has no final outcome.';
    case 'ready': return 'An approved fixture order is recorded. No captured amount is counted.';
    default: return 'No fixture capture is recorded.';
  }
}

function renderRecord(record, filename) {
  const fragment = document.createDocumentFragment();
  const heading = element('header', 'record-heading');
  heading.append(element('p', 'eyebrow', 'OPEN RECORD'));
  const title = element('h2', '', record.fixture.label);
  title.id = 'record-title';
  title.tabIndex = -1;
  heading.append(title, element('p', 'record-filename', filename));
  heading.append(element('p', 'record-notice', 'Synthetic fixture · Not payment evidence'));
  fragment.append(heading);

  const summary = element('dl', 'record-totals');
  summary.setAttribute('aria-label', 'Recorded fixture totals');
  fact(summary, 'Project cap', money(record.summary.total));
  fact(summary, 'Approvals recorded', record.summary.approved + ' / ' + record.checkpoints.length);
  fact(summary, 'Captures recorded', money(record.summary.captured));
  fact(summary, 'Remaining in fixture', money(record.summary.remaining));
  fragment.append(summary);

  const checkpoints = element('section', 'record-checkpoints');
  const checkpointTitle = element('h3', 'section-title', 'Accepted evidence and outcomes');
  checkpointTitle.id = 'saved-checkpoints-title';
  checkpoints.setAttribute('aria-labelledby', checkpointTitle.id);
  checkpoints.append(checkpointTitle);
  for (const checkpoint of record.checkpoints) {
    const card = element('article', 'saved-checkpoint');
    card.dataset.checkpointId = checkpoint.id;
    const header = element('div', 'checkpoint-heading');
    header.append(element('h4', '', checkpoint.title), element('strong', 'checkpoint-amount', money(checkpoint.amount)));
    card.append(header);
    if (checkpoint.approval) {
      card.append(element('p', 'approval-state', 'Approval recorded · Event ' + checkpoint.approval.eventSequence + ' · ' + checkpoint.approval.approver));
      card.append(element('p', 'field-label', 'EXACT ACCEPTED EVIDENCE'));
      card.append(element('pre', 'accepted-evidence', checkpoint.approval.acceptedEvidence));
    } else {
      card.append(element('p', 'unapproved-state', 'No approval recorded'));
      card.append(element('p', 'empty-evidence', 'This file contains no accepted evidence for this checkpoint.'));
    }
    const capture = element('div', 'saved-capture');
    capture.dataset.captureState = checkpoint.capture.status;
    capture.append(element('strong', 'capture-state', stateLabels[checkpoint.capture.status]));
    capture.append(element('p', '', captureNote(checkpoint)));
    card.append(capture);
    const identities = element('dl', 'record-identities');
    fact(identities, 'Order', checkpoint.capture.orderId ?? 'None recorded');
    fact(identities, 'Confirmed capture', checkpoint.capture.captureId ?? 'None recorded');
    fact(identities, 'Counted amount', money(checkpoint.capture.counted));
    card.append(identities);
    checkpoints.append(card);
  }
  fragment.append(checkpoints);

  const history = element('section', 'record-history');
  const historyTitle = element('h3', 'section-title', 'Recorded event history');
  historyTitle.id = 'saved-history-title';
  history.setAttribute('aria-labelledby', historyTitle.id);
  history.append(historyTitle);
  history.append(element('p', 'history-help', record.events.length + ' events. Open an event to read its exact saved fields. T+ values are sequence markers, not clock times.'));
  if (!record.events.length) history.append(element('p', '', 'This record contains no events.'));
  const list = element('ol', 'event-list');
  for (const event of record.events) {
    const row = element('li');
    const detail = element('details', 'saved-event');
    const summary = element('summary');
    const checkpoint = record.checkpoints.find(item => item.id === event.checkpointId);
    const label = event.type === 'paypal.webhook.received' && event.duplicate ? 'Duplicate webhook recorded' : eventLabels[event.type];
    summary.append(element('span', 'event-sequence', String(event.seq).padStart(2, '0')));
    const description = element('span', 'event-description');
    description.append(element('strong', '', label), element('span', '', checkpoint.title));
    summary.append(description);
    detail.append(summary, element('pre', 'event-json', JSON.stringify(event, null, 2)));
    row.append(detail);
    list.append(row);
  }
  history.append(list);
  fragment.append(history);
  fragment.append(element('p', 'record-footnote', 'The file is unsigned. Consistent fields do not establish who wrote it or prove a real approval or transaction.'));
  return fragment;
}

input.addEventListener('change', async () => {
  const file = input.files?.[0];
  // Clearing the picker permits choosing the same file again after a refusal.
  input.value = '';
  if (!file) return;
  const current = ++request;
  clear.disabled = false;
  error.hidden = true;
  error.textContent = '';
  status.textContent = 'Opening ' + file.name + '…' + (opened ? ' Your current record remains below.' : '');
  try {
    if (file.size > MAX_RECORD_BYTES) {
      throw new FixtureRecordError('size', 'This file exceeds the 1 MiB limit. Choose a smaller fixture-record export.');
    }
    const bytes = await file.arrayBuffer();
    if (current !== request) return;
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new FixtureRecordError('encoding', 'This file is not valid UTF-8. Choose the original JSON download.'); }
    const record = readFixtureRecord(text);
    // Prepare all content before replacing a previously accepted display.
    const content = renderRecord(record, file.name);
    if (current !== request) return;
    display.replaceChildren(content);
    display.hidden = false;
    jump.hidden = false;
    opened = true;
    status.textContent = 'Opened ' + file.name + '. ' + record.events.length + ' events; ' + record.summary.approved + ' approvals recorded. The saved fields match the event history.';
  } catch (failure) {
    if (current !== request) return;
    error.textContent = (failure instanceof FixtureRecordError ? failure.message : 'This file could not be read. Choose it again or select another saved record.')
      + (opened ? ' Your previously opened record is unchanged.' : ' No record has been opened.');
    error.hidden = false;
    status.textContent = opened ? 'The previous record remains open.' : 'No file open.';
    clear.disabled = !opened;
  }
});

clear.addEventListener('click', () => {
  ++request;
  opened = false;
  input.value = '';
  display.replaceChildren();
  display.hidden = true;
  jump.hidden = true;
  error.hidden = true;
  error.textContent = '';
  status.textContent = 'View cleared. Choose a saved fixture record to inspect.';
  clear.disabled = true;
  input.focus();
});
