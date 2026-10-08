#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SCOPESIGNAL_PLAYWRIGHT||'playwright');
const source=path.resolve(process.env.SCOPESIGNAL_SOURCE||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const output=path.resolve(process.env.SCOPESIGNAL_EVIDENCE||path.join(source,'out/checkpoint-copy'));
const pinsFile=process.env.SCOPESIGNAL_PINS;
fs.mkdirSync(path.join(output,'downloads'),{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=f=>{const b=fs.readFileSync(f);return{bytes:b.length,git_blob:crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha256:sha(b)};};
const report={startedAt:new Date().toISOString(),source,result:'RUNNING',driver:pin(fileURLToPath(import.meta.url)),cases:[],downloads:[],pageErrors:[],blockedExternal:[],sourceBefore:{},sourceAfter:{},limits:[
 'Synthetic authored fixture; no payment, provider, account or live service.',
 'Real Chromium page and native file download/selection. Only completion delivery of File.arrayBuffer is held for held- files, after the native read completes.',
 'Phone coverage is a narrow browser viewport, not a physical phone or screen reader.',
 'One explicit disabled-control dispatch checks the draft bound without changing application state.'
]};
let browser,context,server,url,serial=0;
function pins(){
 const expected=pinsFile?JSON.parse(fs.readFileSync(pinsFile,'utf8')).files:null;
 const files=expected?Object.keys(expected):['scope.html','styles.css','scope-workspace.css','src/scope-workspace.mjs','src/scope-plan.mjs','src/scope-workspace-record.mjs','src/scope-review-export.mjs','src/ledger.mjs','src/payment-status.mjs'];
 const values={};for(const f of files){values[f]=pin(path.join(source,f));if(expected)assert.equal(values[f].git_blob,expected[f],f+' source pin');}return values;
}
async function page({phone=false,hold=false}={}){
 if(context)await context.close();
 context=await browser.newContext({acceptDownloads:true,viewport:phone?{width:390,height:844}:{width:1280,height:900}});
 await context.route('**/*',route=>{
  const u=route.request().url();if(/^https?:/.test(u)&&!u.startsWith(url+'/')){report.blockedExternal.push(u);return route.abort();}return route.continue();
 });
 await context.addInitScript(hold=>{
  window.__scopeCopyReadGates=[];
  if(!hold)return;
  const original=File.prototype.arrayBuffer;
  File.prototype.arrayBuffer=function(...args){
   const p=original.apply(this,args);if(!this.name.startsWith('held-'))return p;
   return p.then(bytes=>new Promise(resolve=>window.__scopeCopyReadGates.push({nativeReadComplete:true,release(){resolve(bytes);}})));
  };
 },hold);
 const tab=await context.newPage();tab.setDefaultTimeout(7000);tab.on('pageerror',e=>report.pageErrors.push(e.message));
 await tab.goto(url+'/scope.html');await tab.locator('.scope-row').first().waitFor();return tab;
}
async function draft(tab){
 return tab.evaluate(()=>({label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,
  checkpoints:[...document.querySelectorAll('.scope-row')].map(row=>Object.fromEntries(['title','amount','evidence'].map(k=>[k,row.querySelector('[data-field="'+k+'"]').value])))}));
}
async function setRow(tab,index,value){for(const [key,text]of Object.entries(value))await tab.locator('#draft-'+index+'-'+key).fill(text);}
const copyButton=(tab,index)=>tab.getByRole('button',{name:'Duplicate checkpoint '+(index+1),exact:true});
async function requireCopy(tab,index=0){assert.equal(await copyButton(tab,index).count(),1,'Current draft has no Duplicate checkpoint action');return copyButton(tab,index);}
async function duplicate(tab,index,{keyboard=false}={}){
 const button=await requireCopy(tab,index);assert.equal(await button.isEnabled(),true);
 if(keyboard){await button.focus();await tab.keyboard.press('Enter');}else await button.click();
}
async function save(tab,label){
 const event=tab.waitForEvent('download');await tab.locator('#scope-save').click();const d=await event;
 assert.equal(d.suggestedFilename(),'scopesignal-workspace-v1.json');
 const name=String(++serial).padStart(2,'0')+'-'+label+'.json',file=path.join(output,'downloads',name);
 await d.saveAs(file);assert.equal(await d.failure(),null);const entry={file:'downloads/'+name,...pin(file)};
 report.downloads.push(entry);return{file,data:JSON.parse(fs.readFileSync(file,'utf8')),...entry};
}
async function review(tab){await tab.locator('#scope-form button[type="submit"]').click();}
async function check(name,run){
 const row={name},started=Date.now();try{row.evidence=await run();row.result='PASS';}
 catch(e){row.result='FAIL';row.error=e.stack;}
 finally{row.durationMs=Date.now()-started;report.cases.push(row);}
}
try{
 report.sourceBefore=pins();
 const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.json':'application/json'};
 server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(source,'.'+pathname);
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  if(!f.startsWith(source+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(f));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.SCOPESIGNAL_CHROME||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});report.chromium=browser.version();

 await check('Existing move/remove, unapproved review and approval-lock control',async()=>{
  const tab=await page(),initial=await draft(tab);assert.equal(initial.checkpoints.length,3);
  await tab.getByRole('button',{name:'Move checkpoint 2 up',exact:true}).click();
  const moved=await draft(tab);assert.deepEqual(moved.checkpoints,[initial.checkpoints[1],initial.checkpoints[0],initial.checkpoints[2]]);
  await tab.getByRole('button',{name:'Remove checkpoint 1',exact:true}).click();
  const removed=await draft(tab);assert.deepEqual(removed.checkpoints,[initial.checkpoints[0],initial.checkpoints[2]]);
  await review(tab);assert.equal(await tab.locator('.scope-review-card').count(),2);assert.equal(await tab.locator('#scope-event-count').textContent(),'0 events');
  await tab.locator('[data-action="approve"][data-checkpoint="scope-1"]').click();
  assert.equal(await tab.locator('#scope-edit').isDisabled(),true);assert.equal(await tab.locator('#scope-event-count').textContent(),'1 event');
  return{orderedFieldsPreserved:true,unapprovedReview:true,explicitApprovalLock:true};
 });

 await check('Keyboard copy preserves raw fields, inserts adjacent, focuses copy and keeps later edits independent',async()=>{
  const tab=await page();await requireCopy(tab,1);
  await tab.locator('#scope-label').fill('Repeated scope <literal> & test');
  await tab.locator('#scope-brief').fill('Line one.\n\nLine three retains its break.');
  await tab.locator('#scope-cap').fill(' 2000.00 ');
  await setRow(tab,0,{title:'First unaffected',amount:'007.50',evidence:'first'});
  await setRow(tab,1,{title:'',amount:'12..30',evidence:'  planned <b>literal</b>\n\nlast line  '});
  await setRow(tab,2,{title:'Last unaffected',amount:'25.0',evidence:''});
  const before=await draft(tab),expected=structuredClone(before);expected.checkpoints.splice(2,0,{...before.checkpoints[1]});
  await duplicate(tab,1,{keyboard:true});assert.deepEqual(await draft(tab),expected);
  assert.equal(await tab.evaluate(()=>document.activeElement.id),'draft-2-title');
  assert.match(await tab.locator('#scope-order-status').textContent(),/duplicated.*3.*4/i);
  assert.equal(await tab.locator('#scope-form img, #scope-form script').count(),0);
  await setRow(tab,2,{title:'Independent new deliverable',amount:'100.00',evidence:'Only the copy changes'});
  const edited=await draft(tab);assert.deepEqual(edited.checkpoints[1],before.checkpoints[1]);assert.deepEqual(edited.checkpoints[0],before.checkpoints[0]);assert.deepEqual(edited.checkpoints[3],before.checkpoints[2]);
  await review(tab);assert.equal(await tab.locator('#scope-review').isHidden(),true);
  const errorLinks=await tab.locator('#scope-errors a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
  assert.ok(errorLinks.includes('#draft-1-title')&&errorLinks.includes('#draft-1-amount')&&errorLinks.includes('#draft-3-evidence'));
  return{before,afterCopy:expected,afterIndependentEdit:edited,errorLinks,focus:'draft-2-title'};
 });

 await check('Copied amounts retain cap validation and get distinct final review/approval identities',async()=>{
  const tab=await page();await requireCopy(tab,1);const before=await draft(tab);
  await duplicate(tab,1);assert.match(await tab.locator('#scope-budget').textContent(),/\$1,600\.00 allocated.*\$400\.00 over the project cap/);
  await review(tab);assert.equal(await tab.locator('#scope-review').isHidden(),true);assert.equal(await tab.locator('#scope-cap').getAttribute('aria-invalid'),'true');
  await tab.locator('#scope-cap').fill('1600.00');await review(tab);
  assert.deepEqual(await tab.locator('.scope-review-card').evaluateAll(xs=>xs.map(x=>x.dataset.checkpoint)),['scope-1','scope-2','scope-3','scope-4']);
  assert.equal(await tab.locator('#scope-event-count').textContent(),'0 events');
  await tab.locator('#review-evidence-scope-3').fill('The copied milestone alone is approved');
  await tab.locator('[data-action="approve"][data-checkpoint="scope-3"]').click();
  assert.equal(await tab.locator('#scope-approved').textContent(),'1 / 4');assert.equal(await tab.locator('#scope-captured').textContent(),'$0.00');
  assert.equal(await tab.locator('#review-evidence-scope-3').getAttribute('readonly'),'');
  assert.equal(await tab.locator('#review-evidence-scope-2').getAttribute('readonly'),null);
  const frozen=await draft(tab),events=await tab.locator('#scope-event-body').textContent();
  await tab.locator('button[data-duplicate]').first().evaluate(button=>button.click());
  assert.deepEqual(await draft(tab),frozen);assert.equal(await tab.locator('#scope-event-body').textContent(),events);
  return{originalCopiedTuple:before.checkpoints[1],distinctIds:true,noImplicitApproval:true,capStillEnforced:true,hiddenDraftCopyRefused:true};
 });

 await check('Twelve-row limit disables every copy and recovers after removal',async()=>{
  const tab=await page();await requireCopy(tab);
  for(let count=3;count<12;count++)await duplicate(tab,0);
  assert.equal(await tab.locator('.scope-row').count(),12);
  assert.equal(await tab.locator('button[data-duplicate]:disabled').count(),12);
  assert.equal(await tab.locator('#scope-add').isDisabled(),true);
  const atLimit=await draft(tab);
  await tab.locator('button[data-duplicate]').first().evaluate(button=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.deepEqual(await draft(tab),atLimit);
  await tab.getByRole('button',{name:'Remove checkpoint 6',exact:true}).click();
  assert.equal(await tab.locator('button[data-duplicate]:disabled').count(),0);
  await duplicate(tab,10);assert.equal(await tab.locator('.scope-row').count(),12);
  assert.equal(await tab.evaluate(()=>document.activeElement.id),'draft-11-title');
  return{maximum:12,allCopyButtonsDisabled:true,disabledDispatchPreservesDraft:true,removalReenablesCopy:true};
 });

 await check('Phone copy invalidates prepared preview and a completed-but-held native file read',async()=>{
  const tab=await page({phone:true,hold:true});await requireCopy(tab);
  const native=await save(tab,'original-workspace');
  await tab.locator('#scope-label').fill('Current draft retained');
  await tab.locator('#scope-open').setInputFiles(native.file);await tab.locator('#scope-open-preview').waitFor({state:'visible'});
  await duplicate(tab,0,{keyboard:true});assert.equal(await tab.locator('#scope-open-preview').isHidden(),true);assert.equal(await tab.locator('#scope-open').inputValue(),'');
  const afterPreview=await draft(tab);assert.equal(afterPreview.label,'Current draft retained');assert.equal(afterPreview.checkpoints.length,4);
  const heldFile=path.join(output,'held-native-workspace.json');fs.copyFileSync(native.file,heldFile);
  await tab.locator('#scope-open').setInputFiles(heldFile);await tab.waitForFunction(()=>window.__scopeCopyReadGates[0]?.nativeReadComplete);
  await duplicate(tab,1);const beforeRelease=await draft(tab),status=await tab.locator('#scope-file-status').textContent();
  await tab.evaluate(async()=>{window.__scopeCopyReadGates[0].release();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  assert.deepEqual(await draft(tab),beforeRelease);assert.equal(await tab.locator('#scope-file-status').textContent(),status);assert.equal(await tab.locator('#scope-open-preview').isHidden(),true);
  const width=await tab.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(width.document<=width.viewport+1);
  await copyButton(tab,2).scrollIntoViewIfNeeded();const box=await copyButton(tab,2).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width.viewport+1);
  return{preparedPreviewInvalidated:true,lateNativeReadIgnored:true,currentDraft:beforeRelease,width,copyButtonBox:box,nativeWorkspace:native.sha256};
 });
 assert.deepEqual(report.pageErrors,[]);
 const bad=report.blockedExternal.filter(u=>!u.startsWith('https://fonts.googleapis.com/')&&!u.startsWith('https://fonts.gstatic.com/'));assert.deepEqual(bad,[]);
 report.result=report.cases.every(c=>c.result==='PASS')?'PASS':'FAIL';
}catch(e){report.result='FAIL';report.error=e.stack;}
finally{
 if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
 try{report.sourceAfter=pins();assert.deepEqual(report.sourceAfter,report.sourceBefore);report.sourceUnchanged=true;}
 catch(e){report.sourceUnchanged=false;report.result='FAIL';report.sourceError=e.stack;}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(report,null,2)+'\n');
 process.stdout.write(JSON.stringify({result:report.result,cases:report.cases,sourceUnchanged:report.sourceUnchanged,pageErrors:report.pageErrors,error:report.error})+'\n');
 if(report.result!=='PASS')process.exitCode=1;
}
