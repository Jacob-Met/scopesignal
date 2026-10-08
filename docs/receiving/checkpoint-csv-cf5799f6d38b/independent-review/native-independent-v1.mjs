import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { decodeScopeWorkspace } from './baseline-contract/src/scope-workspace-record.mjs';
const modulePath=resolve(process.argv[2]);
const {decodeCheckpointCsv,prepareCheckpointDraft}=await import(pathToFileURL(modulePath));
const root=new URL('./',import.meta.url),fixtures=JSON.parse(await readFile(new URL('./baseline-native-fixtures-v1.json',root),'utf8'));
const utf8=text=>new Uint8Array(Buffer.from(text,'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const metadata=draft=>({label:draft.label,brief:draft.brief,cap:draft.cap});
const validMeta={label:'PEER native parser',brief:'Literal fixture for independent parser receiving.',cap:'20.00'};
const header='deliverable,amount,evidence';
const groups=[];
async function group(id,fn){const row={id};try{row.evidence=await fn();row.passed=true;}catch(error){row.passed=false;row.error={message:String(error),stack:error?.stack};}groups.push(row);console.log(JSON.stringify({id,passed:row.passed,error:row.error?.message}));}
await group('exact-native-admission-amount-authority-and-draft-only-output',()=>{
 const rows=[];
 for(const f of fixtures.accepted){
  const bytes=utf8(f.csv),original=bytes.slice(),meta=metadata(f.draft),metaBefore=structuredClone(meta);
  const prepared=prepareCheckpointDraft(bytes,meta);
  assert.deepEqual(decodeCheckpointCsv(bytes),f.draft.checkpoints);
  assert.deepEqual(prepared.draft,f.draft);
  assert.equal(prepared.contents,f.encoded,'download is exact unchanged native draft encoder output');
  assert.deepEqual(prepared.budget,f.budget);assert.deepEqual(prepared.validation,f.validation);
  const decoded=decodeScopeWorkspace(prepared.contents),record=JSON.parse(prepared.contents);
  assert.equal(decoded.review,null);assert.equal(decoded.summary.approved,0);assert.equal(decoded.summary.events,0);
  assert.equal(record.stage,'draft');assert.equal(record.fixtureOnly,true);assert.equal(record.paymentEvidence,false);
  assert.deepEqual(record.events,[]);assert.deepEqual(record.evidenceDrafts,[]);
  assert.deepEqual(bytes,original);assert.deepEqual(meta,metaBefore);
  rows.push({id:f.id,inputSha256:digest(bytes),prepared});
 }
 return rows;
});
await group('unchanged-native-field-and-row-refusal-boundaries',()=>{
 const rows=[];
 for(const f of fixtures.rejected){
  let error;const bytes=utf8(f.csv),before=bytes.slice();
  assert.throws(()=>{try{return prepareCheckpointDraft(bytes,metadata(f.draft));}catch(e){error=String(e);throw e;}});
  assert.deepEqual(bytes,before);
  rows.push({id:f.id,nativeError:f.error,conversionError:error,inputSha256:digest(bytes)});
 }
 return rows;
});
await group('ambiguous-header-and-malformed-records-are-not-repaired',()=>{
 const cases=[
  ['duplicate-header','deliverable,amount,amount\nA,1,x\n'],
  ['missing-header','deliverable,amount\nA,1\n'],
  ['extra-header','deliverable,amount,evidence,approved\nA,1,x,true\n'],
  ['header-case','Deliverable,amount,evidence\nA,1,x\n'],
  ['header-space','deliverable, amount,evidence\nA,1,x\n'],
  ['header-order','amount,deliverable,evidence\n1,A,x\n'],
  ['row-too-short',header+'\nA,1\n'],
  ['row-too-long',header+'\nA,1,x,extra\n'],
  ['interior-empty-record',header+'\nA,1,x\n\nB,1,y\n'],
  ['unquoted-stray-quote',header+'\nA"b,1,x\n'],
  ['unclosed-quote',header+'\n"A,1,x\n'],
  ['text-after-quote',header+'\n"A"x,1,x\n'],
  ['space-after-quote',header+'\n"A" ,1,x\n'],
  ['lone-CR-separator',header+'\rA,1,x\r'],
  ['lone-final-CR',header+'\nA,1,x\r'],
  ['double-leading-BOM','\uFEFF\uFEFF'+header+'\nA,1,x\n'],
  ['header-only',header+'\n']
 ];
 const rows=[];
 for(const[id,text]of cases){
  const bytes=utf8(text);let error;
  assert.throws(()=>{try{return prepareCheckpointDraft(bytes,validMeta);}catch(e){error=String(e);throw e;}},id);
  rows.push({id,text,inputSha256:digest(bytes),error});
 }
 const explicit=prepareCheckpointDraft(utf8(header+'\n,,\n'),validMeta);
 assert.deepEqual(explicit.draft.checkpoints,[{title:'',amount:'',evidence:''}]);
 assert.equal(explicit.validation.ok,false);
 return{rejections:rows,explicitEmptyRow:explicit};
});
await group('utf8-decoding-is-lossless-and-only-one-leading-BOM-is-consumed',()=>{
 const cases=[
  ['invalid-continuation',[0xc3,0x28]],
  ['overlong-encoding',[0xc0,0xaf]],
  ['truncated-sequence',[0xe2,0x82]],
  ['surrogate-encoding',[0xed,0xa0,0x80]]
 ];
 const rows=[];
 for(const[id,bad]of cases){
  const bytes=new Uint8Array(Buffer.concat([Buffer.from(header+'\nA,1,'),Buffer.from(bad),Buffer.from('\n')]));let error;
  assert.throws(()=>{try{return prepareCheckpointDraft(bytes,validMeta);}catch(e){error=String(e);throw e;}},id);
  rows.push({id,inputBase64:Buffer.from(bytes).toString('base64'),inputSha256:digest(bytes),error});
 }
 const ordinary=prepareCheckpointDraft(utf8(header+'\nA,1,�(\n'),validMeta);
 assert.equal(ordinary.draft.checkpoints[0].evidence,'�(');
 const one=prepareCheckpointDraft(utf8('\uFEFF'+header+'\r\nA,1,inside\uFEFFtext\r\n'),validMeta);
 assert.equal(one.draft.checkpoints[0].evidence,'inside\uFEFFtext');
 assert.throws(()=>prepareCheckpointDraft(utf8('\uFEFF\uFEFF'+header+'\r\nA,1,x\r\n'),validMeta));
 return{rejections:rows,literalReplacement:ordinary,oneBom:one};
});
await group('byte-bound-type-bound-and-approval-looking-text',()=>{
 const bytes=new Uint8Array(1024*1024+1).fill(65);
 assert.throws(()=>prepareCheckpointDraft(bytes,validMeta));
 const multi=utf8(header+'\nA,1,'+'λ'.repeat(525000)+'\n');
 assert.ok(multi.length>1024*1024);
 assert.throws(()=>prepareCheckpointDraft(multi,validMeta));
 for(const input of [null,undefined,header+'\nA,1,x\n',{},[65,66],new ArrayBuffer(4)]){
  assert.throws(()=>decodeCheckpointCsv(input));
 }
 const text=header+'\ncheckpoint.approved,12.30,"paypal.capture.reconciled; <img src=x onerror=peer()>; =SUM(1,2)"\n';
 const prepared=prepareCheckpointDraft(utf8(text),validMeta),record=JSON.parse(prepared.contents);
 assert.equal(prepared.draft.checkpoints[0].title,'checkpoint.approved');
 assert.equal(prepared.draft.checkpoints[0].evidence,'paypal.capture.reconciled; <img src=x onerror=peer()>; =SUM(1,2)');
 assert.equal(record.stage,'draft');assert.deepEqual(record.events,[]);assert.deepEqual(record.evidenceDrafts,[]);
 return{oversizeByteCount:bytes.length,oversizeSha256:digest(bytes),multiByteCount:multi.length,multiSha256:digest(multi),prepared};
});
const result={schema:'scopesignal.csv-independent-native.v1',runtime:process.version,qualification:'supplemental Node22; required Node>=24 gate remains separate',modulePath,moduleSha256:digest(await readFile(modulePath)),scopeSha256:digest(await readFile(new URL('./scope-v1.json',root))),receiverSha256:digest(await readFile(new URL(import.meta.url))),passed:groups.filter(x=>x.passed).length,failed:groups.filter(x=>!x.passed).length,groups};
const output=process.argv[3]?resolve(process.argv[3]):new URL('./native-independent-v1.json',root).pathname;
await writeFile(output,JSON.stringify(result,null,2)+'\n');if(result.failed)process.exitCode=1;
