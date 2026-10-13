import { SPEC_VERSION } from './ledger.mjs';
import { createFixtureRecord } from './fixture-record.mjs';

// The ledger owns lifecycle and identity rules. This reader only admits the
// saved-file format and checks the redundant facts against that same ledger.
export const MAX_RECORD_BYTES = 1024 * 1024;
export const MAX_RECORD_EVENTS = 512;

export class FixtureRecordError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FixtureRecordError';
    this.code = code;
  }
}

const fields = {
  'checkpoint.approved': ['checkpointId', 'approver', 'acceptedEvidence'],
  'paypal.order.created': ['checkpointId', 'orderId', 'amount', 'currency', 'environment'],
  'paypal.capture.requested': ['checkpointId', 'orderId', 'environment'],
  'paypal.capture.response_lost': ['checkpointId', 'orderId', 'outcome'],
  'paypal.webhook.received': ['checkpointId', 'eventId', 'captureId', 'duplicate', 'amount', 'currency'],
  'paypal.capture.reconciled': ['checkpointId', 'captureId', 'outcome', 'source'],
};

function refuse(code, message) { throw new FixtureRecordError(code, message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

// Run only after JSON.parse has validated syntax. Tokenize complete strings so
// braces and field-like text inside values stay literal. Each object owns its
// decoded names; an iterative stack also handles deeply nested wrong-format JSON.
function requireUniqueFields(text) {
  const objects = [];
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|[{}]/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    if (token === '{') objects.push(new Set());
    else if (token === '}') objects.pop();
    else {
      let after = match.index + token.length;
      while (after < text.length && ' \t\r\n'.includes(text[after])) after++;
      if (text[after] !== ':') continue;
      const name = JSON.parse(token);
      const names = objects.at(-1);
      if (names.has(name)) {
        refuse('format', 'This file repeats a JSON field. Choose an original fixture-record export.');
      }
      names.add(name);
    }
  }
}

function requireKeys(value, expected, label) {
  if (!object(value) || Object.keys(value).length !== expected.length
    || expected.some(key => !Object.hasOwn(value, key))) {
    refuse('format', label + ' has missing or unsupported fields. Choose an original fixture-record export.');
  }
}

// Iterative comparison also refuses extra fields. JSON key order is irrelevant;
// array order, string contents, amounts, nulls and types must match exactly.
function requireMatchingFacts(actual, expected) {
  const pending = [[actual, expected, 'record']];
  while (pending.length) {
    const [value, reference, path] = pending.pop();
    if (reference === null || typeof reference !== 'object') {
      if (value !== reference) refuse('inconsistent', 'The saved ' + path + ' does not match the event history.');
      continue;
    }
    if (Array.isArray(reference)) {
      if (!Array.isArray(value) || value.length !== reference.length) {
        refuse('inconsistent', 'The saved ' + path + ' does not match the event history.');
      }
      reference.forEach((item, index) => pending.push([value[index], item, path + '[' + index + ']']));
    } else {
      requireKeys(value, Object.keys(reference), 'The saved ' + path);
      for (const key of Object.keys(reference)) pending.push([value[key], reference[key], path + '.' + key]);
    }
  }
}

function freezeRecord(record) {
  const pending = [record];
  while (pending.length) {
    const value = pending.pop();
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      pending.push(...Object.values(value));
      Object.freeze(value);
    }
  }
  return record;
}

export function readFixtureRecord(text) {
  if (typeof text !== 'string') refuse('format', 'Choose a JSON fixture-record file.');
  if (text.length > MAX_RECORD_BYTES || new TextEncoder().encode(text).byteLength > MAX_RECORD_BYTES) {
    refuse('size', 'This file exceeds the 1 MiB limit. Choose a smaller fixture-record export.');
  }
  let saved;
  try { saved = JSON.parse(text); }
  catch { refuse('syntax', 'This file is not complete JSON. Choose a saved ScopeSignal fixture record.'); }
  requireUniqueFields(text);

  if (!object(saved) || saved.schema !== 'scopesignal.fixture-record') {
    refuse('format', 'This is not a ScopeSignal fixture record.');
  }
  if (saved.version !== 1 || saved.ledgerSpecVersion !== SPEC_VERSION) {
    refuse('version', 'This record version is not supported. Open a version 1 fixture-record export.');
  }
  if (saved.fixtureOnly !== true || saved.paymentEvidence !== false) {
    refuse('format', 'This reader only supports synthetic fixture records, never payment evidence.');
  }
  if (!Array.isArray(saved.events) || saved.events.length > MAX_RECORD_EVENTS) {
    refuse('events', 'Choose a fixture record with no more than 512 events.');
  }
  saved.events.forEach((event, index) => {
    const label = 'Event ' + (index + 1);
    if (!object(event) || typeof event.type !== 'string' || !Object.hasOwn(fields, event.type)) {
      refuse('history', label + ' is not a supported fixture event.');
    }
    const payloadFields = fields[event.type];
    requireKeys(event, ['seq', 'type', 'at', ...payloadFields], label);
    if (event.seq !== index + 1 || event.at !== 'T+' + String(index + 1).padStart(3, '0')) {
      refuse('history', label + ' has inconsistent sequence metadata.');
    }
    for (const key of payloadFields) {
      const expectedType = key === 'amount' ? 'number' : key === 'duplicate' ? 'boolean' : 'string';
      if (typeof event[key] !== expectedType) refuse('history', label + ' has an invalid ' + key + ' field.');
    }
  });

  let record;
  try { record = createFixtureRecord(saved.events); }
  catch {
    refuse('history', 'The event history violates the fixture ledger rules. Choose an unedited export.');
  }
  requireMatchingFacts(saved, record);
  return freezeRecord(record);
}
