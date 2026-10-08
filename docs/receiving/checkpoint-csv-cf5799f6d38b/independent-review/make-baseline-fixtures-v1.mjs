import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { encodeScopeWorkspace,decodeScopeWorkspace } from './baseline-contract/src/scope-workspace-record.mjs';
import { validateScopeDraft,draftBudget,parseDollars,createScopeReview } from './baseline-contract/src/scope-plan.mjs';
const root=new URL('./',import.meta.url);
const header='deliverable,amount,evidence';
const csvField=value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value;
function csv(draft,{end='\n',bom=false,final=true}={}){
 return (bom?'\uFEFF':'')+header+end+draft.checkpoints.map(x=>[x.title,x.amount,x.evidence].map(csvField).join(',')).join(end)+(final?end:'');
}
const literal={label:'  PEER quoted scope 🚤  ',brief:'  Exact creative brief\nSecond line, kept  ',cap:'0013.00',checkpoints:[
 {title:'  PEER 🚤, "alpha" <b>literal</b>  ',amount:' 00012.30 ',evidence:' first "proof", exact\nsecond line\uFEFF tail '},
 {title:'=1+1',amount:'0000.70',evidence:'Literal evidence, never an approval event'}
]};
const blank={label:'PEER unfinished amount',brief:'Fictional draft requires later human completion.',cap:'20.00',checkpoints:[{title:'',amount:'',evidence:''}]};
const limits={label:'L'.repeat(120),brief:'B'.repeat(7999)+'\n',cap:'0'.repeat(63)+'1',checkpoints:[{title:'🚤'.repeat(80),amount:'0'.repeat(63)+'1',evidence:'E'.repeat(4999)+'\n'}]};
const twelve={label:'PEER twelve rows',brief:'Every explicit row counts, in order.',cap:'1.00',checkpoints:Array.from({length:12},(_,n)=>({title:'Literal checkpoint '+(n+1),amount:'0.01',evidence:'Evidence '+(n+1)}))};
const replacement={...structuredClone(literal),checkpoints:[{title:'Genuine replacement character �',amount:'1.00',evidence:'This correctly encoded U+FFFD is literal text.'}]};
const accepted=[
 {id:'literal-LF',draft:literal,format:{}},
 {id:'literal-CRLF-BOM',draft:literal,format:{end:'\r\n',bom:true}},
 {id:'unfinished-empty-row',draft:blank,format:{}},
 {id:'exact-native-limits',draft:limits,format:{final:false}},
 {id:'twelve-rows',draft:twelve,format:{}},
 {id:'literal-U+FFFD',draft:replacement,format:{}}
];
for(const amount of ['', '0', '1e3', '+10', '0.001', '90071992547409.92', '$10', '-1']){
 const draft={label:'PEER unfinished amount',brief:'Native review validation stays authoritative.',cap:'20.00',checkpoints:[{title:'Checkpoint',amount,evidence:'Planned proof'}]};
 accepted.push({id:'unfinished-'+JSON.stringify(amount),draft,format:{}});
}
const records=[];
for(const f of accepted){
 const text=csv(f.draft,f.format),encoded=encodeScopeWorkspace({draft:f.draft}),decoded=decodeScopeWorkspace(encoded),validation=validateScopeDraft(f.draft),budget=draftBudget(f.draft);
 assert.deepEqual(decoded.draft,f.draft);assert.equal(decoded.review,null);assert.equal(decoded.summary.stage,'draft');assert.equal(decoded.summary.approved,0);assert.equal(decoded.summary.events,0);assert.equal(decoded.evidenceDrafts.size,0);
 const raw=JSON.parse(encoded);assert.equal(raw.fixtureOnly,true);assert.equal(raw.paymentEvidence,false);assert.deepEqual(raw.events,[]);assert.deepEqual(raw.evidenceDrafts,[]);
 if(validation.ok){const review=createScopeReview(f.draft);const s=review.snapshot();assert.equal(s.approved,0);assert.equal(s.events.length,0);}
 if(f.id.startsWith('unfinished-'))assert.equal(validation.ok,false);
 records.push({...f,csv:text,csv_sha256:createHash('sha256').update(text).digest('hex'),encoded,validation,budget});
}
assert.equal(parseDollars(literal.checkpoints[0].amount),1230);
assert.equal(parseDollars(literal.checkpoints[1].amount),70);
const rejected=[];
function refuse(id,mutate){
 const draft=structuredClone(literal);mutate(draft);let error;
 assert.throws(()=>{try{return encodeScopeWorkspace({draft});}catch(e){error=String(e);throw e;}});
 rejected.push({id,draft,error,csv:csv(draft)});
}
refuse('title-161',x=>x.checkpoints[0].title='T'.repeat(161));
refuse('amount-65',x=>x.checkpoints[0].amount='1'.repeat(65));
refuse('evidence-5001',x=>x.checkpoints[0].evidence='E'.repeat(5001));
refuse('label-121',x=>x.label='L'.repeat(121));
refuse('brief-8001',x=>x.brief='B'.repeat(8001));
refuse('cap-65',x=>x.cap='1'.repeat(65));
refuse('title-LF',x=>x.checkpoints[0].title='a\nb');
refuse('amount-CRLF',x=>x.checkpoints[0].amount='1\r\n2');
refuse('evidence-CR',x=>x.checkpoints[0].evidence='a\rb');
refuse('evidence-CRLF',x=>x.checkpoints[0].evidence='a\r\nb');
refuse('label-CR',x=>x.label='a\rb');
refuse('brief-CRLF',x=>x.brief='a\r\nb');
refuse('zero-rows',x=>x.checkpoints=[]);
refuse('thirteenth-explicit-empty-row',x=>x.checkpoints=[...twelve.checkpoints,{title:'',amount:'',evidence:''}]);
const result={schema:'scopesignal.csv-independent-baseline-native.v1',runtime:process.version,declared_engine:'>=24',qualification:'supplemental existing Node22; required Node24 gate remains separate',accepted:records,rejected,counts:{accepted:records.length,rejected:rejected.length},all_native_controls_passed:true};
const path=new URL('./baseline-native-fixtures-v1.json',root);await writeFile(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({runtime:process.version,counts:result.counts,all_native_controls_passed:true,fixture_sha256:createHash('sha256').update(await readFile(path)).digest('hex')},null,2));
