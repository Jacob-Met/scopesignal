import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeLibrary, readLibraryFile, exportLibraryRow, MAX_LIBRARY_BYTES, MAX_LIBRARY_FILES } from '../src/scope-library.mjs';
import { encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeReview } from '../src/scope-plan.mjs';
import { createScopeReviewDocument } from '../src/scope-review-export.mjs';

const draft = label => ({ label, brief: 'A brief\nwith exact spacing  ', cap: '10.00', checkpoints: [{title:'One',amount:'3.25',evidence:'Planned one'}, {title:'Two',amount:'2.50',evidence:'Planned two'}] });
const file = (name, text, wait = async () => {}) => { const bytes = new TextEncoder().encode(text); return { name, size: bytes.length, async arrayBuffer() { await wait(); return bytes.buffer; } }; };
const saved = label => encodeScopeWorkspace({draft:draft(label)});
const deferred = () => { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; };

test('multiple same-name files retain selection order despite reversed completion and an isolated refusal', async () => {
  const gate=deferred(), library=createScopeLibrary();
  const run=library.load([file('same.json',saved('First'),()=>gate.promise),file('bad.json','{}'),file('same.json',saved('Third'))]);
  await Promise.resolve(); assert.equal(library.snapshot().busy,true); assert.deepEqual(library.snapshot().rows,[]);
  gate.resolve(); await run;
  assert.deepEqual(library.snapshot().rows.map(r=>[r.index,r.filename,r.status]),[[0,'same.json','admitted'],[1,'bad.json','refused'],[2,'same.json','admitted']]);
  assert.equal(library.snapshot().rows[2].workspace.draft.label,'Third');
  assert.equal(library.snapshot().selected,0);
});

test('whole-selection limits and cancelled choice preserve an existing batch without reading any files', async () => {
  const library=createScopeLibrary();await library.load([file('held.json',saved('Held'))]);const rows=library.snapshot().rows;
  let reads=0;const stub={name:'x',size:1,arrayBuffer(){reads++;throw Error('must not read');}};
  await library.load(Array(MAX_LIBRARY_FILES+1).fill(stub));assert.strictEqual(library.snapshot().rows,rows);
  await library.load([{...stub,size:MAX_LIBRARY_BYTES+1}]);assert.strictEqual(library.snapshot().rows,rows);
  await library.load([{...stub,size:NaN}]);await library.load([]);assert.equal(reads,0);assert.strictEqual(library.snapshot().rows,rows);
});

test('per-file byte cap, invalid UTF-8, unreadable and changed-size files are separate refusals', async () => {
  let oversizedRead=false;
  const inputs=[{name:'large',size:1048577,arrayBuffer(){oversizedRead=true;}},{name:'utf8',size:2,async arrayBuffer(){return Uint8Array.of(0xc3,0x28).buffer;}},{name:'read',size:1,async arrayBuffer(){throw Error('read unavailable');}},{name:'changed',size:1,async arrayBuffer(){return new ArrayBuffer(2);}},file('okay',saved('Okay'))];
  const library=createScopeLibrary();await library.load(inputs);assert.equal(oversizedRead,false);assert.deepEqual(library.snapshot().rows.map(r=>r.status),['refused','refused','refused','refused','admitted']);assert.equal(library.snapshot().selected,4);
});

test('exact count and aggregate boundary admits individual results without widening the 1 MiB limit', async () => {
  const library=createScopeLibrary();
  await library.load(Array.from({length:16},(_,i)=>file(String(i),saved(String(i)))));assert.equal(library.snapshot().rows.length,16);
  const padded=saved('padded').padEnd(1048576,' ');
  await library.load(Array.from({length:8},(_,i)=>file(String(i),padded)));assert.ok(library.snapshot().rows.every(r=>r.status==='admitted'));
});

test('new selection and Clear retire stale asynchronous results while keeping the completed batch usable', async () => {
  const library=createScopeLibrary();await library.load([file('held',saved('Held'))]);const held=library.snapshot().rows;
  const gate=deferred();const old=library.load([file('old',saved('Old'),()=>gate.promise)]);assert.strictEqual(library.snapshot().rows,held);
  await library.load([file('new',saved('New'))]);gate.resolve();await old;assert.equal(library.snapshot().rows[0].workspace.draft.label,'New');
  const clearGate=deferred();const pending=library.load([file('late',saved('Late'),()=>clearGate.promise)]);library.clear();clearGate.resolve();await pending;assert.deepEqual(library.snapshot().rows,[]);assert.equal(library.snapshot().busy,false);
});

test('native replay refuses inconsistent events and unsupported envelopes but unfinished drafts remain exact', async () => {
  const raw=JSON.parse(saved('Draft'));raw.draft.cap='  not yet  ';raw.draft.checkpoints[0].amount='';raw.draft.label='';
  const row=await readLibraryFile(file('unfinished',JSON.stringify(raw)),0);assert.equal(row.status,'admitted');assert.deepEqual(row.workspace.draft,raw.draft);assert.equal(row.workspace.review,null);
  const extra={...raw,total:1000};assert.equal((await readLibraryFile(file('extra',JSON.stringify(extra)),1)).status,'refused');
  const review=createScopeReview(draft('Review'));review.act('scope-1','approve','Actual accepted');const forged=JSON.parse(encodeScopeWorkspace({draft:draft('Review'),review}));forged.events[0].seq=9;
  assert.equal((await readLibraryFile(file('forged',JSON.stringify(forged)),2)).status,'refused');
});

test('selected export is byte-identical to existing exporter and unknown captures count zero', async () => {
  const input=draft('Review');const review=createScopeReview(input);
  for(const action of ['approve','order','request','lose'])review.act('scope-1',action,'Accepted one');
  const workspace={draft:input,review,evidenceDrafts:new Map([['scope-2','Pending two']])};
  const row=await readLibraryFile(file('same.json',encodeScopeWorkspace(workspace)),3);
  assert.equal(row.workspace.review.snapshot().captured,0);
  const result=exportLibraryRow(row);assert.equal(result.filename,'scopesignal-review-04.html');assert.equal(result.html,createScopeReviewDocument(workspace));assert.ok(result.html.includes('Pending two'));
  review.act('scope-1','reconcile');const reconciled=await readLibraryFile(file('other',encodeScopeWorkspace({draft:input,review})),4);assert.equal(reconciled.workspace.review.snapshot().captured,325);
});

test('codec-admitted HTML-unrepresentable text keeps its row and refuses only export', async () => {
  const input=draft('NUL\0kept');const row=await readLibraryFile(file('nul.json',encodeScopeWorkspace({draft:input})),0);
  assert.equal(row.status,'admitted');assert.equal(row.workspace.draft.label,input.label);assert.throws(()=>exportLibraryRow(row),/cannot be preserved/);assert.equal(row.status,'admitted');
  assert.throws(()=>exportLibraryRow({status:'refused'}),/Select an admitted/);
});

test('invalid and refused selections cannot silently export a different admitted workspace',async()=>{
  const library=createScopeLibrary();await library.load([file('okay',saved('Okay')),file('bad','not json')]);library.select(1);assert.equal(library.snapshot().selected,1);assert.throws(()=>exportLibraryRow(library.snapshot().rows[1]));library.select(-1);assert.equal(library.snapshot().selected,1);
});
