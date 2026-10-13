// Independent original-first API/consumer receiving. No browser, device or network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) throw new Error('Missing ' + name); return args[i + 1]; };
const source = path.resolve(option('--source'));
const output = path.resolve(option('--output'));
const contractPath = path.resolve(option('--contract'));
const expectedReader = option('--expected-reader-sha');
const contractRaw = await readFile(contractPath);
const contract = JSON.parse(contractRaw);
const pin = raw => ({ bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') });
const before = {};
for (const name of Object.keys(contract.original_pins)) before[name] = await readFile(path.join(source, name));
assert.equal(pin(before['src/record-reader.mjs']).sha256, expectedReader, 'Frozen reader source differs');
for (const name of Object.keys(before)) {
  if (name !== 'src/record-reader.mjs') assert.equal(pin(before[name]).sha256, contract.original_pins[name].sha256, 'Preserved source differs: ' + name);
}
await mkdir(output, { recursive: false });
const { replayFixture, createLedger } = await import(pathToFileURL(path.join(source, 'src/ledger.mjs')).href);
const { createFixtureRecord } = await import(pathToFileURL(path.join(source, 'src/fixture-record.mjs')).href);
const { readFixtureRecord, FixtureRecordError, MAX_RECORD_BYTES } = await import(pathToFileURL(path.join(source, 'src/record-reader.mjs')).href);
const rows = [];
const duplicateCodes = new Set();
function check(name, fn) {
  try { const detail = fn(); rows.push({ name, passed: true, detail: detail ?? null }); }
  catch (error) { rows.push({ name, passed: false, error: error.name + ': ' + error.message }); }
}
async function checkAsync(name, fn) {
  try { const detail = await fn(); rows.push({ name, passed: true, detail: detail ?? null }); }
  catch (error) { rows.push({ name, passed: false, error: error.name + ': ' + error.message }); }
}
function frozen(value) {
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    if (current !== null && typeof current === 'object') {
      assert(Object.isFrozen(current)); pending.push(...Object.values(current));
    }
  }
}
function accepts(text, expected) {
  const record = readFixtureRecord(text); assert.deepEqual(record, expected); frozen(record); return record;
}
function refuses(text, code) {
  let error;
  try { readFixtureRecord(text); } catch (caught) { error = caught; }
  assert(error instanceof FixtureRecordError, 'Expected FixtureRecordError refusal');
  assert.equal(typeof error.code, 'string'); assert(error.code.length); assert(error.message.length);
  if (code) assert.equal(error.code, code);
  return { name: error.name, code: error.code, message: error.message };
}
const escapedKey = key => JSON.stringify(key).replace(/[A-Za-z]/, letter => '\\u' + letter.charCodeAt(0).toString(16).padStart(4, '0'));
function encode(value, injections = [], at = [], escapeAll = false, reverse = false) {
  if (Array.isArray(value)) return '[' + value.map((v, i) => encode(v, injections, [...at, String(i)], escapeAll, reverse)).join(',') + ']';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  let entries = Object.entries(value); if (reverse) entries = entries.reverse();
  return '{' + entries.map(([key, child]) => {
    const injection = injections.find(i => i.path === at.join('/') && i.key === key);
    const normal = JSON.stringify(key);
    const finalKey = injection?.order === 'escaped-last' || escapeAll ? escapedKey(key) : normal;
    const kept = finalKey + ':' + encode(child, injections, [...at, key], escapeAll, reverse);
    if (!injection) return kept;
    const earlierKey = injection.order === 'escaped-first' ? escapedKey(key) : normal;
    return earlierKey + ' : ' + JSON.stringify(injection.earlier) + ' ,\n ' + kept;
  }).join(',') + '}';
}
const events = replayFixture().events;
assert.equal(events.length, 7, 'Original fixture sequence changed');
const full = createFixtureRecord(events);
const duplicateInputs = [
  { name: 'root-identical-schema', path: '', key: 'schema', earlier: full.schema },
  { name: 'root-shadowed-schema', path: '', key: 'schema', earlier: 'earlier-document' },
  { name: 'root-shadowed-version', path: '', key: 'version', earlier: 0 },
  { name: 'root-shadowed-fixture-only', path: '', key: 'fixtureOnly', earlier: false },
  { name: 'root-shadowed-payment-evidence', path: '', key: 'paymentEvidence', earlier: true },
  { name: 'fixture-shadowed-id', path: 'fixture', key: 'id', earlier: 'earlier-fixture' },
  { name: 'fixture-shadowed-amount', path: 'fixture', key: 'amount', earlier: 1 },
  { name: 'summary-shadowed-approved', path: 'summary', key: 'approved', earlier: 0 },
  { name: 'summary-shadowed-captured', path: 'summary', key: 'captured', earlier: 1 },
  { name: 'summary-shadowed-remaining', path: 'summary', key: 'remaining', earlier: 1 },
  { name: 'approval-shadowed-approver', path: 'checkpoints/0/approval', key: 'approver', earlier: 'earlier-author' },
  { name: 'approval-shadowed-evidence', path: 'checkpoints/0/approval', key: 'acceptedEvidence', earlier: 'earlier evidence' },
  { name: 'capture-shadowed-status', path: 'checkpoints/0/capture', key: 'status', earlier: 'unknown' },
  { name: 'capture-shadowed-order', path: 'checkpoints/0/capture', key: 'orderId', earlier: 'earlier-order' },
  { name: 'event-shadowed-type', path: 'events/0', key: 'type', earlier: 'earlier-type' },
  { name: 'event-shadowed-sequence', path: 'events/0', key: 'seq', earlier: 0 },
  { name: 'event-shadowed-evidence', path: 'events/0', key: 'acceptedEvidence', earlier: 'earlier evidence' },
  { name: 'root-unicode-escaped-first', path: '', key: 'schema', earlier: full.schema, order: 'escaped-first' },
  { name: 'root-unicode-escaped-last', path: '', key: 'schema', earlier: full.schema, order: 'escaped-last' },
  { name: 'event-unicode-escaped-first', path: 'events/0', key: 'acceptedEvidence', earlier: 'earlier evidence', order: 'escaped-first' },
  { name: 'event-unicode-escaped-last', path: 'events/0', key: 'acceptedEvidence', earlier: 'earlier evidence', order: 'escaped-last' },
];
const inputPins = {};
for (const injection of duplicateInputs) {
  const text = encode(full, [injection]);
  assert.deepEqual(JSON.parse(text), full, 'Baseline input must be valid after ordinary last-wins parsing');
  inputPins[injection.name] = pin(Buffer.from(text));
  check(injection.name, () => { const observed = refuses(text); duplicateCodes.add(observed.code); return observed; });
}
const multi = encode(full, [duplicateInputs[1], duplicateInputs[11], duplicateInputs[19]]);
assert.deepEqual(JSON.parse(multi), full);
inputPins['multiple-object-depths'] = pin(Buffer.from(multi));
check('multiple-object-depths', () => { const observed = refuses(multi); duplicateCodes.add(observed.code); return observed; });

const states = ['not_started', 'not_started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
for (let i = 0; i <= events.length; i++) check('valid-recovery-prefix-' + i, () => {
  const expected = createFixtureRecord(events.slice(0, i));
  const record = accepts(JSON.stringify(expected), expected);
  assert.equal(record.checkpoints[0].capture.status, states[i]);
  assert.equal(record.summary.captured, i === 7 ? 40000 : 0);
});
check('valid-reordered-members-whitespace', () => accepts('\r\n\t' + encode(full, [], [], false, true) + ' \n', full));
check('valid-escaped-ascii-member-names', () => accepts(encode(full, [], [], true), full));
const evidenceValues = [
  'Literal {"schema":"one","schema":"two"}, [brackets], colon: and comma, <b>text</b>',
  'Quotes " and slash \\ and apparent \\u0061 field; newline\nsecond\ttab',
  'Composed café; decomposed cafe\u0301; supplementary 😀; snow 雪',
  'Lone code unit \ud800 remains JSON-escaped text',
];
for (let i = 0; i < evidenceValues.length; i++) check('valid-literal-evidence-' + i, () => {
  const ledger = replayFixture(); ledger.approve('accessibility', evidenceValues[i]);
  const expected = createFixtureRecord(ledger.events);
  const record = accepts(JSON.stringify(expected), expected);
  assert.equal(record.events.at(-1).acceptedEvidence, evidenceValues[i]);
  assert.equal(record.checkpoints[1].approval.acceptedEvidence, evidenceValues[i]);
});
check('valid-empty-ledger-control', () => {
  const expected = createFixtureRecord(createLedger().events); accepts(JSON.stringify(expected), expected);
});
check('valid-exact-byte-boundary', () => {
  const expected = createFixtureRecord([]); const raw = JSON.stringify(expected);
  const text = raw + ' '.repeat(MAX_RECORD_BYTES - Buffer.byteLength(raw));
  assert.equal(Buffer.byteLength(text), MAX_RECORD_BYTES); accepts(text, expected);
});
check('one-byte-over-boundary', () => refuses(' '.repeat(MAX_RECORD_BYTES + 1), 'size'));
check('multibyte-over-boundary', () => {
  const text = JSON.stringify({ value: '😀'.repeat(MAX_RECORD_BYTES / 4) });
  assert(text.length < MAX_RECORD_BYTES && Buffer.byteLength(text) > MAX_RECORD_BYTES);
  return refuses(text, 'size');
});
for (const [index, text] of ['{', '{"schema":}', '{"a":"\\q"}', 'true false'].entries())
  check('malformed-json-' + index, () => refuses(text, 'syntax'));
for (const [index, text] of ['null', '[]', '42', '{"schema":"elsewhere"}'].entries())
  check('wrong-format-' + index, () => refuses(text, 'format'));
check('deep-wrong-format-typed-refusal', () => {
  const text = '['.repeat(12000) + '0' + ']'.repeat(12000);
  assert(Array.isArray(JSON.parse(text))); return refuses(text);
});
check('prototype-names-no-effect', () => {
  const names = Object.getOwnPropertyNames(Object.prototype);
  const text = '{"__proto__":{"receivingMarker":true},' + JSON.stringify(full).slice(1);
  const result = refuses(text); assert.deepEqual(Object.getOwnPropertyNames(Object.prototype), names);
  assert.equal(Object.hasOwn(Object.prototype, 'receivingMarker'), false); return result;
});

// This authored DOM-shaped model exercises the unchanged controller's handlers.
// It is not the real HTML or a browser rendering/accessibility qualification.
class Node {
  constructor() { this.children = []; this.dataset = {}; this.listeners = new Map(); this.hidden = true; this.disabled = true; this.textContent = ''; this.files = []; this.value = ''; }
  append(...values) { this.children.push(...values); }
  replaceChildren(...values) { this.children = values; }
  setAttribute() {}
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  focus() { this.focused = true; }
}
async function controller(label) {
  const nodes = new Map(['record-file', 'clear-record', 'record-status', 'record-error', 'record-display', 'jump-to-record'].map(name => [name, new Node()]));
  globalThis.document = { getElementById: name => { assert(nodes.has(name)); return nodes.get(name); }, createElement: () => new Node(), createDocumentFragment: () => new Node() };
  const url = pathToFileURL(path.join(source, 'src/record-view.mjs')); url.searchParams.set('independent-receiving', label);
  await import(url.href);
  async function open(text, name) {
    const encoded = new TextEncoder().encode(text);
    nodes.get('record-file').files = [{ name, size: encoded.byteLength, arrayBuffer: async () => encoded.buffer }];
    await nodes.get('record-file').listeners.get('change')();
  }
  return { nodes, open };
}
await checkAsync('controller-valid-open-control', async () => {
  const c = await controller('valid'); await c.open(JSON.stringify(full), 'accepted.json');
  assert.equal(c.nodes.get('record-display').children.length, 1);
  assert.equal(c.nodes.get('record-display').hidden, false);
  assert.match(c.nodes.get('record-status').textContent, /^Opened accepted.json/);
});
await checkAsync('controller-duplicate-preserves-opened-record', async () => {
  const c = await controller('retained'); await c.open(JSON.stringify(full), 'accepted.json');
  const before = c.nodes.get('record-display').children[0];
  await c.open(multi, 'duplicate.json');
  assert.equal(c.nodes.get('record-display').children[0], before);
  assert.equal(c.nodes.get('record-display').hidden, false);
  assert.equal(c.nodes.get('record-error').hidden, false);
  assert.equal(c.nodes.get('record-status').textContent, 'The previous record remains open.');
});
await checkAsync('controller-first-duplicate-no-display', async () => {
  const c = await controller('first'); await c.open(multi, 'duplicate.json');
  assert.equal(c.nodes.get('record-display').children.length, 0);
  assert.equal(c.nodes.get('record-status').textContent, 'No file open.');
  assert.equal(c.nodes.get('clear-record').disabled, true);
});
await checkAsync('controller-existing-syntax-error-retains-display', async () => {
  const c = await controller('syntax'); await c.open(JSON.stringify(full), 'accepted.json');
  const before = c.nodes.get('record-display').children[0]; await c.open('{', 'broken.json');
  assert.equal(c.nodes.get('record-display').children[0], before);
  assert.equal(c.nodes.get('record-status').textContent, 'The previous record remains open.');
});
delete globalThis.document;
for (const name of Object.keys(before)) assert.deepEqual(await readFile(path.join(source, name)), before[name], 'Source mutated: ' + name);
const receipt = {
  schema: 'scopesignal-fixture-reader-independent-receiving/v1', reviewer: 'runtime_integrator/6e0637a29ce6',
  completed_utc: new Date().toISOString(), source, node: process.version,
  contract: pin(contractRaw), receiver: pin(await readFile(new URL(import.meta.url))),
  source_pins: Object.fromEntries(Object.entries(before).map(([name, raw]) => [name, pin(raw)])),
  cases: rows, passed: rows.filter(r => r.passed).length, total: rows.length,
  duplicate_cases: 22, duplicate_error_codes: [...duplicateCodes], duplicate_inputs: inputPins,
  controller_cases: 4, source_unchanged: true,
  limits: 'Authored synthetic API and DOM-shaped controller receiving. No real browser/HTML rendering, payment, authenticity, external transaction, device, network, installed package or performance claim. '
    + 'Maintained tests, workflows, ledger, serializer and actual controller source are preserved by exact beforeimage hashes; the maintained test suite was not repeated here.'
};
await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: receipt.passed, total: receipt.total, duplicate_cases: 22, controller_cases: 4, failed: rows.filter(r => !r.passed).map(r => r.name) }));
process.exitCode = receipt.passed === receipt.total ? 0 : 1;
