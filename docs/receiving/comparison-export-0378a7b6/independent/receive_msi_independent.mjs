import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [root, output] = process.argv.slice(2);
const {createScopeComparisonDocument} = await import(pathToFileURL(path.join(root, 'src/scope-comparison-export.mjs')));
const base = {schema:'scopesignal.scope-workspace', version:1, fixtureOnly:true, paymentEvidence:false,
  stage:'draft', draft:{label:'Study & literal "name"', brief:'All-fields receiving\nsecond line', cap:'not yet set', checkpoints:[]},
  events:[], evidenceDrafts:[]};
for(let i=0;i<12;i++) base.draft.checkpoints.push({title:'Checkpoint '+i+' </td><svg/onload=alert(1)>',
  amount:i%2?'not priced':'00.50', evidence:'Evidence '+i+' & <style>bad</style>\n雪'});
const other=structuredClone(base);
other.draft.label='Different file';
other.draft.checkpoints=other.draft.checkpoints.toReversed();
const left={name:'A\r\n<iframe>.json',contents:JSON.stringify(base)}, right={name:'B & Ω.json',contents:JSON.stringify(other)};
const pairs=Array.from({length:12},(_,i)=>[i,11-i]).toReversed();
const before=JSON.stringify({left,right,pairs});
const html=createScopeComparisonDocument({left,right,pairs});
assert.equal((html.match(/data-pair=/g)||[]).length,12);
for(const key of ['title','amountText','amountCents','plannedEvidence','approved','acceptedEvidence','pendingEvidence','captureStatus','orderId','captureId','counted']){
  assert.equal((html.match(new RegExp('data-field="'+key+'"','g'))||[]).length,key==='approved'?13:12);
}
assert.equal((html.match(/data-unpaired=/g)||[]).length,0);
assert.ok(html.indexOf('data-pair="0-11"')<html.indexOf('data-pair="11-0"'));
for(let i=0;i<12;i++){
  assert.ok(html.includes('Checkpoint '+i+' &lt;/td&gt;&lt;svg/onload=alert(1)&gt;'));
  assert.ok(html.includes('Evidence '+i+' &amp; &lt;style&gt;bad&lt;/style&gt;\n雪'));
}
assert.ok(html.includes('A&#13;\n&lt;iframe&gt;.json'));
assert.ok(!/<(?:script|iframe|svg|img|link)\b/i.test(html));
assert.match(html, /default-src 'none'/);
assert.equal(JSON.stringify({left,right,pairs}),before);
const empty=createScopeComparisonDocument({left,right,pairs:[]});
assert.equal((empty.match(/data-unpaired=/g)||[]).length,24);
assert.equal((empty.match(/data-pair=/g)||[]).length,0);
assert.equal((empty.match(/<dt>Planned acceptance evidence<\/dt>/g)||[]).length,24);
assert.equal((empty.match(/<dt>Pending review evidence<\/dt>/g)||[]).length,24);
const controls=[[[0,0],[0,1]],[[0,0],[1,0]],[[0,-1]],[['0',1]]];
for(const malformed of controls) assert.throws(()=>createScopeComparisonDocument({left,right,pairs:malformed}));
const sourceFiles=['src/scope-comparison-export.mjs','src/scope-compare-ui.mjs','scope-compare.html','src/scope-compare.mjs','src/scope-workspace-record.mjs'];
const receipt={time:new Date().toISOString(),reviewer:'chatgpt-0378a7b6b7c2/msi_product',
  checks:['Maximum12-row reverse pairing yields all11fields and no discarded row','Empty pairing retains all24 unpaired rows and complete field inventories','Filename CR/newline, markup-like labels and multiline Unicode evidence stay literal','Static output has no script/frame/image/resource tags and denies external resources','Pair reorder does not mutate admitted snapshots or caller pair list','Non-injective, negative and wrong-type pair controls refuse'],
  source_sha256:Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),
  output_sha256:createHash('sha256').update(html).digest('hex'),
  result:'PASS',limitations:'Independent source review plus native model challenge; no additional browser or payment/account action.',
  setup_failure:'First receiver-file write returned ENOENT because the sibling proof directory did not exist; subsequent launch returned MODULE_NOT_FOUND. The directory was then created and this exact receiver ran. Product source was not changed.'};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'all-fields.html'),html);
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
