import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointCsvError, MAX_CHECKPOINT_CSV_BYTES, decodeCheckpointCsv, prepareCheckpointDraft } from '../src/scope-checkpoint-csv.mjs';
import { decodeScopeWorkspace, encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeReview } from '../src/scope-plan.mjs';

const utf8 = text => new TextEncoder().encode(text);
const metadata = { label: '  Fictional launch & 雪  ', brief: 'A brief\nwith exact spacing  ', cap: ' 100.00 ' };
const header = 'deliverable,amount,evidence';
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const csv = (rows, end = '\n') => header + end + rows.map(row => row.map(quote).join(',')).join(end) + end;
const prepare = (text, details = metadata) => prepareCheckpointDraft(utf8(text), details);
const refuses = (action, code, pattern) => assert.throws(action, error =>
  error instanceof CheckpointCsvError && error.code === code && (!pattern || pattern.test(error.message)));

test('literal quoted CSV becomes a native draft; ordinary review remains a separate action', () => {
  const rows = [
    ['Poster, first pass', ' 040.00 ', '\nProof "A"\n<img onerror="alert(1)"> & 😀  '],
    ['=SUM(A1:A2)', '60', 'Final handoff\twith whitespace']
  ];
  const result = prepare(csv(rows, '\r\n'));
  const expected = { ...metadata, checkpoints: rows.map(([title, amount, evidence]) => ({title, amount, evidence})) };
  assert.deepEqual(result.draft, expected);
  assert.equal(result.contents, encodeScopeWorkspace({draft: expected}));
  const record = JSON.parse(result.contents), restored = decodeScopeWorkspace(result.contents);
  assert.deepEqual(restored.draft, expected);
  assert.equal(restored.review, null);
  assert.equal(record.stage, 'draft');
  assert.equal(record.fixtureOnly, true);
  assert.equal(record.paymentEvidence, false);
  assert.deepEqual(record.events, []);
  assert.deepEqual(record.evidenceDrafts, []);
  assert.deepEqual(result.budget, {cap:10000, allocated:10000, unallocated:0});
  assert.equal(result.validation.ok, true);
  const ordinary = createScopeReview(restored.draft).snapshot();
  assert.equal(ordinary.approved, 0);
  assert.deepEqual(ordinary.events, []);
  assert.deepEqual(ordinary.plan.checkpoints.map(row => row.id), ['scope-1', 'scope-2']);
  assert.equal(ordinary.plan.checkpoints[0].amount, 4000);
});

test('one leading UTF-8 BOM, quoted headers, CRLF records and a final delimiter are accepted', () => {
  const text = '\uFEFF"deliverable","amount","evidence"\r\n"One","1.00","A ""quote"", a comma"\r\n';
  assert.deepEqual(decodeCheckpointCsv(utf8(text)), [{title:'One',amount:'1.00',evidence:'A "quote", a comma'}]);
  assert.deepEqual(decodeCheckpointCsv(utf8(text.slice(0, -2))), decodeCheckpointCsv(utf8(text)));
});

test('a BOM inside a field stays literal', () => {
  const result = prepare(csv([['\uFEFFTitle', '1', 'Proof\uFEFFend']]));
  assert.equal(result.draft.checkpoints[0].title, '\uFEFFTitle');
  assert.equal(result.draft.checkpoints[0].evidence, 'Proof\uFEFFend');
});

test('empty fields and unfinished money remain editable, never silently repriced', () => {
  const result = prepare(header + '\n,,\n', {label:'',brief:'',cap:''});
  assert.deepEqual(result.draft, {label:'',brief:'',cap:'',checkpoints:[{title:'',amount:'',evidence:''}]});
  assert.equal(result.validation.ok, false);
  assert.deepEqual(result.budget, {cap:null,allocated:null,unallocated:null});
  assert.equal(JSON.parse(result.contents).stage, 'draft');
  const unfinished = prepare(csv([['A', '=SUM(A1:A2)', 'Evidence']]));
  assert.equal(unfinished.draft.checkpoints[0].amount, '=SUM(A1:A2)');
  assert.equal(unfinished.validation.ok, false);
  assert.equal(unfinished.budget.allocated, null);
  assert.equal(JSON.parse(unfinished.contents).events.length, 0);
});

test('over-budget drafts preserve source amounts and native review refusal', () => {
  const result = prepare(csv([['A','100.01','Evidence']]));
  assert.equal(result.draft.checkpoints[0].amount, '100.01');
  assert.equal(result.budget.unallocated, -1);
  assert.equal(result.validation.ok, false);
  assert(result.validation.errors.some(error => /exceed the project cap/.test(error.message)));
  assert.throws(() => createScopeReview(decodeScopeWorkspace(result.contents).draft), /exceed the project cap/);
});

test('caller bytes and metadata are unchanged and the prepared record is independent', () => {
  const bytes = utf8(csv([['A','1','Evidence']]));
  const beforeBytes = bytes.slice(), details = {...metadata}, beforeDetails = structuredClone(details);
  const result = prepareCheckpointDraft(bytes, details);
  assert.deepEqual(bytes, beforeBytes);
  assert.deepEqual(details, beforeDetails);
  details.label = 'Changed after review';
  result.draft.checkpoints[0].title = 'Changed returned draft';
  assert.equal(JSON.parse(result.contents).draft.label, beforeDetails.label);
  assert.equal(JSON.parse(result.contents).draft.checkpoints[0].title, 'A');
});

test('all 12 rows, every native maximum and exact large cents survive', () => {
  const rows = Array.from({length:12}, (_,i) => ['T'.repeat(160), i ? '1' : '90071992547398.91', 'E'.repeat(5000)]);
  const details = {label:'L'.repeat(120), brief:'B'.repeat(8000), cap:'90071992547409.91'};
  const result = prepare(csv(rows), details);
  assert.equal(result.draft.checkpoints.length, 12);
  assert.equal(result.validation.ok, true);
  assert.equal(result.budget.allocated, Number.MAX_SAFE_INTEGER);
  assert.equal(decodeScopeWorkspace(result.contents).draft.checkpoints[11].evidence.length, 5000);
});

test('the one MiB boundary is accepted by CSV decoding and one byte more is refused', () => {
  const prefix = header + '\nA,1,';
  const exact = utf8(prefix + 'E'.repeat(MAX_CHECKPOINT_CSV_BYTES - utf8(prefix).length));
  assert.equal(exact.byteLength, MAX_CHECKPOINT_CSV_BYTES);
  assert.equal(decodeCheckpointCsv(exact).length, 1);
  refuses(() => prepareCheckpointDraft(exact, metadata), 'DRAFT_FIELDS', /5000/);
  const oversized = new Uint8Array(MAX_CHECKPOINT_CSV_BYTES + 1);
  refuses(() => decodeCheckpointCsv(oversized), 'CSV_SIZE');
});

test('input bounds count UTF-8 bytes rather than characters', () => {
  const text = header + '\nA,1,' + '雪'.repeat(Math.ceil(MAX_CHECKPOINT_CSV_BYTES / 3));
  assert(text.length < MAX_CHECKPOINT_CSV_BYTES);
  refuses(() => decodeCheckpointCsv(utf8(text)), 'CSV_SIZE');
});

for (const [name, text, code] of [
  ['empty input', '', 'CSV_EMPTY'],
  ['BOM only', '\uFEFF', 'CSV_EMPTY'],
  ['header only', header + '\n', 'CSV_ROWS'],
  ['more than 12 rows', csv(Array.from({length:13},()=>['A','1','E'])), 'CSV_ROWS'],
  ['reordered header', 'amount,deliverable,evidence\n1,A,E', 'CSV_HEADER'],
  ['duplicate header', 'deliverable,amount,amount\nA,1,E', 'CSV_HEADER'],
  ['header spaces', 'deliverable, amount,evidence\nA,1,E', 'CSV_HEADER'],
  ['double BOM', '\uFEFF\uFEFF'+header+'\nA,1,E', 'CSV_HEADER'],
  ['extra header field', header+',notes\nA,1,E,N', 'CSV_COLUMNS'],
  ['missing row field', header+'\nA,1', 'CSV_COLUMNS'],
  ['extra row field', header+'\nA,1,E,N', 'CSV_COLUMNS'],
  ['blank record', header+'\nA,1,E\n\n', 'CSV_COLUMNS'],
  ['bare CR separator', header+'\rA,1,E', 'CSV_SYNTAX'],
  ['unterminated quotes', header+'\n"A,1,E', 'CSV_SYNTAX'],
  ['quote in unquoted field', header+'\nA"B,1,E', 'CSV_SYNTAX'],
  ['text after quote', header+'\n"A"tail,1,E', 'CSV_SYNTAX'],
  ['space before quote', header+'\n "A",1,E', 'CSV_SYNTAX'],
  ['space after quote', header+'\n"A" ,1,E', 'CSV_SYNTAX']
]) test('refuses '+name+' without producing a partial workspace', () => {
  refuses(() => prepare(text), code);
});

test('invalid UTF-8, UTF-16 input and non-byte callers are refused', () => {
  for(const bytes of [new Uint8Array([0xc3,0x28]),new Uint8Array([0xff,0xfe,0x61,0])]) {
    refuses(() => decodeCheckpointCsv(bytes), 'CSV_UTF8');
  }
  refuses(() => decodeCheckpointCsv(header), 'CSV_INPUT');
});

for (const [name, row, details, message] of [
  ['title line break', ['A\nB','1','E'], metadata, /stay on one line/],
  ['amount line break', ['A','1\n2','E'], metadata, /stay on one line/],
  ['quoted CRLF evidence', ['A','1','E\r\nnext'], metadata, /LF line breaks/],
  ['quoted bare CR evidence', ['A','1','E\rnext'], metadata, /LF line breaks/],
  ['title limit', ['A'.repeat(161),'1','E'], metadata, /160/],
  ['amount limit', ['A','1'.repeat(65),'E'], metadata, /64/],
  ['evidence limit', ['A','1','E'.repeat(5001)], metadata, /5000/],
  ['label limit', ['A','1','E'], {...metadata,label:'L'.repeat(121)}, /120/],
  ['brief limit', ['A','1','E'], {...metadata,brief:'B'.repeat(8001)}, /8000/],
  ['cap limit', ['A','1','E'], {...metadata,cap:'1'.repeat(65)}, /64/],
  ['metadata CR', ['A','1','E'], {...metadata,brief:'A\r\nB'}, /LF line breaks/]
]) test('native draft admission remains authoritative for '+name, () => {
  refuses(() => prepare(csv([row]), details), 'DRAFT_FIELDS', message);
});
