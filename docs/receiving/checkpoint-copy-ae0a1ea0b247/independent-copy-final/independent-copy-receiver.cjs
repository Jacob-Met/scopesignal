'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const args=process.argv.slice(2);
function arg(name,optional=false){const i=args.indexOf(name);if(i<0){if(optional)return null;throw Error('Missing '+name);}return args[i+1];}
const source=path.resolve(arg('--source')),out=path.resolve(arg('--out')),mode=arg('--mode'),pins=JSON.parse(fs.readFileSync(arg('--pins'),'utf8')),legacy=arg('--legacy',true);
fs.mkdirSync(path.join(out,'downloads'),{recursive:true});
function hash(b){return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),gitBlob:crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')};}
function verify(){const result={};for(const f of pins.files){const b=fs.readFileSync(path.join(source,f.path)),got=hash(b);assert.equal(got.gitBlob,f.blob||f.sha,'source '+f.path);result[f.path]=got;}return result;}
const report={schema:'scopesignal.duplicate-checkpoint.independent-browser/1',mode,startedAt:new Date().toISOString(),result:'RUNNING',source,pinsBefore:verify(),driver:hash(fs.readFileSync(__filename)),cases:[],downloads:[],pageErrors:[],externalRequests:[],limits:['Actual local Chromium and native modular app; no hosted deployment or real payment action.','Only delivery of a completed native File.arrayBuffer result is held for one declared case.','All form state is entered through browser inputs; no application or model state is injected.','Receiving is bounded to checkpoint duplication and the exercised editor, file and review transitions.']};
let browser,server,context,origin,serial=0;
const raw={label:'  Repeated deliverables <literal> & Ω  ',brief:'First brief line\n<script>literal</script>\nKeep  two spaces.',cap:' 0100.00 ',checkpoints:[{title:'  Phase α <copy>  ',amount:' 01.20 ',evidence:'First line\n<em>literal</em> & =1+1\n  trailing spaces  '},{title:'Second & different',amount:'2.30',evidence:'Evidence B\nB only.'},{title:'Last kept intact',amount:'3.45',evidence:'  Evidence C  '}]};
report.limits.push('The unchanged native page requests a Google Fonts CSS URL. This receiver blocks that exact request and uses installed fallback fonts; other external requests remain a failure.');
const clone=x=>JSON.parse(JSON.stringify(x));
async function launchPage(width=1280,hold=false){
 if(context)await context.close();
 context=await browser.newContext({acceptDownloads:true,viewport:{width,height:width<500?844:900},isMobile:width<500,hasTouch:width<500});
 await context.route('**/*',route=>{const u=route.request().url();if(/^https?:/.test(u)&&!u.startsWith(origin+'/')){report.externalRequests.push(u);return route.abort();}return route.continue();});
 if(hold)await context.addInitScript(()=>{
  window.__copyNativeReads=[];
  const original=File.prototype.arrayBuffer;
  File.prototype.arrayBuffer=function(...args){
   const pending=original.apply(this,args);
   if(!this.name.startsWith('held-'))return pending;
   return pending.then(bytes=>new Promise(resolve=>{
    window.__copyNativeReads.push({name:this.name,bytes:bytes.byteLength,nativeComplete:true,released:false,release(){this.released=true;resolve(bytes);}});
   }));
  };
 });
 const p=await context.newPage();p.on('pageerror',e=>report.pageErrors.push(String(e)));await p.goto(origin+'/scope.html');await p.locator('#draft-0-title').waitFor();return p;
}
const rows=p=>p.locator('#scope-draft-list .scope-row');
async function fill(p,d){
 while(await rows(p).count()<d.checkpoints.length)await p.locator('#scope-add').click();
 while(await rows(p).count()>d.checkpoints.length)await rows(p).last().getByRole('button',{name:/Remove checkpoint/}).click();
 for(const k of ['label','brief','cap'])await p.locator('#scope-'+k).fill(d[k]);
 for(let i=0;i<d.checkpoints.length;i++)for(const k of ['title','amount','evidence'])await p.locator('#draft-'+i+'-'+k).fill(d.checkpoints[i][k]);
}
async function draft(p){return p.evaluate(()=>({label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,checkpoints:[...document.querySelectorAll('#scope-draft-list .scope-row')].map(r=>Object.fromEntries(['title','amount','evidence'].map(k=>[k,r.querySelector('[data-field="'+k+'"]').value])))}));}
function duplicateButton(p,index){return rows(p).nth(index).getByRole('button',{name:/Duplicate checkpoint/});}
async function duplicate(p,index,keyboard=false){
 const before=await draft(p),expected=clone(before);expected.checkpoints.splice(index+1,0,clone(before.checkpoints[index]));
 const b=duplicateButton(p,index);assert.equal(await b.count(),1,'one copy control per selected row');assert.equal(await b.isEnabled(),true);
 if(keyboard){await b.focus();await p.keyboard.press('Enter');}else await b.click();
 assert.deepEqual(await draft(p),expected,'copy exact raw selected row only');
 assert.equal(await p.evaluate(()=>document.activeElement.id),'draft-'+(index+1)+'-title','focus on copied deliverable');
 return expected;
}
async function save(p,label){
 const wait=p.waitForEvent('download');await p.locator('#scope-save').click();const d=await wait;
 const name=String(++serial).padStart(2,'0')+'-'+label+'.json',file=path.join(out,'downloads',name);
 await d.saveAs(file);const bytes=fs.readFileSync(file),value=JSON.parse(bytes.toString('utf8'));
 report.downloads.push({path:'downloads/'+name,nativeFilename:d.suggestedFilename(),...hash(bytes)});
 return {file,bytes,value};
}
async function ensureDraftRecord(p,s,expected){
 assert.equal(s.value.stage,'draft');assert.deepEqual(s.value.draft,expected);assert.deepEqual(s.value.events,[]);assert.deepEqual(await draft(p),expected);
}
async function scenario(name,fn){const start=Date.now();try{const evidence=await fn();report.cases.push({name,result:'PASS',durationMs:Date.now()-start,evidence});}catch(e){report.cases.push({name,result:'FAIL',durationMs:Date.now()-start,error:e.stack||String(e)});throw e;}}
async function baseline(){
 await scenario('Native raw draft and genuine download control, with missing duplication affordance',async()=>{
  const p=await launchPage();await fill(p,raw);const before=await draft(p);assert.deepEqual(before,raw);
  const s=await save(p,'baseline-raw');await ensureDraftRecord(p,s,raw);
  const buttons=await p.getByRole('button',{name:/Duplicate checkpoint/}).count();assert.equal(buttons,0,'original source has no copy action');
  return {baselineMissingCapability:true,existingInputsAndDownloadPass:true,rows:raw.checkpoints.length,nativeWorkspace:hash(s.bytes)};
 });
 report.result='BASELINE_MISSING_CAPABILITY';
}
async function candidate(){
 await scenario('First, middle and last copies preserve raw fields; later edits and row actions preserve independent values',async()=>{
  const p=await launchPage();await fill(p,raw);
  let expected=await duplicate(p,0);
  expected=await duplicate(p,2);
  expected=await duplicate(p,expected.checkpoints.length-1);
  assert.equal(expected.checkpoints.length,6);
  await p.locator('#draft-1-title').fill('Only the copied row is revised');
  await p.locator('#draft-1-amount').fill(' 1e2 ');
  await p.locator('#draft-1-evidence').fill('New copy writing\n<&>\n');
  expected.checkpoints[1]={title:'Only the copied row is revised',amount:' 1e2 ',evidence:'New copy writing\n<&>\n'};
  assert.deepEqual(await draft(p),expected);
  await rows(p).nth(1).getByRole('button',{name:'Move checkpoint 2 down',exact:true}).click();
  [expected.checkpoints[1],expected.checkpoints[2]]=[expected.checkpoints[2],expected.checkpoints[1]];
  assert.deepEqual(await draft(p),expected);
  await rows(p).last().getByRole('button',{name:/Remove checkpoint/}).click();expected.checkpoints.pop();
  const s=await save(p,'raw-copies');await ensureDraftRecord(p,s,expected);
  assert.match(await p.locator('#scope-budget').innerText(),/Enter valid USD/);
  await p.locator('#scope-form button[type="submit"]').click();
  assert.equal(await p.locator('#scope-form').isVisible(),true);assert.equal(await p.locator('#scope-errors').isVisible(),true);assert.equal(await p.locator('#scope-review').isVisible(),false);
  assert.deepEqual(await draft(p),expected);
  await p.locator('#draft-2-amount').fill('');expected.checkpoints[2].amount='';
  expected=await duplicate(p,2);
  const empty=await save(p,'empty-amount-copy');await ensureDraftRecord(p,empty,expected);
  return {rawWhitespaceAndMarkupPreserved:true,firstMiddleLast:true,independentLaterEdits:true,invalidAndEmptyAmountsUnnormalized:true,existingValidationRefusesReview:true,downloadSha256:[hash(s.bytes).sha256,hash(empty.bytes).sha256]};
 });
 await scenario('Capacity, over-cap validation and phone keyboard focus remain native',async()=>{
  const p=await launchPage(390);const d={label:'Capacity test',brief:'A repeated unit deliverable.',cap:'1.00',checkpoints:[{title:'Unit',amount:'0.09',evidence:'A visible unit receipt.'}]};
  await fill(p,d);let expected=await draft(p);
  while(expected.checkpoints.length<12)expected=await duplicate(p,expected.checkpoints.length-1,true);
  assert.equal(await p.locator('#scope-add').isEnabled(),false);
  const enabled=await p.getByRole('button',{name:/Duplicate checkpoint/}).evaluateAll(bs=>bs.filter(b=>!b.disabled).length);assert.equal(enabled,0,'all copy actions disabled at twelve');
  assert.match(await p.locator('#scope-budget').innerText(),/1\.08 allocated/);assert.match(await p.locator('#scope-budget').innerText(),/0\.08 over/);
  await p.locator('#scope-form button[type="submit"]').click();assert.equal(await p.locator('#scope-errors').isVisible(),true);assert.equal(await p.locator('#scope-review').isVisible(),false);
  await rows(p).nth(5).getByRole('button',{name:/Remove checkpoint/}).click();expected.checkpoints.splice(5,1);
  assert.equal(await p.locator('#scope-add').isEnabled(),true);expected=await duplicate(p,0,true);assert.equal(expected.checkpoints.length,12);
  const associations=await p.locator('#scope-draft-list').evaluate(list=>{const fields=[...list.querySelectorAll('input,textarea')];return fields.map(f=>({id:f.id,labels:[...f.labels].map(l=>l.htmlFor)}));});
  assert.equal(new Set(associations.map(x=>x.id)).size,36);
  for(const a of associations)assert.deepEqual(a.labels,[a.id]);
  const width=await p.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));assert.equal(width.document,width.viewport);
  await rows(p).nth(1).scrollIntoViewIfNeeded();
  const controls=await rows(p).nth(1).locator('button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,left:r.left,right:r.right,width:r.width,height:r.height,disabled:b.disabled};}));
  for(const b of controls){assert.ok(b.width>0&&b.height>0);assert.ok(b.left>=-0.5&&b.right<=390.5,'phone control within viewport');}
  await p.screenshot({path:path.join(out,'phone-copy-controls.jpg'),type:'jpeg',quality:65,fullPage:false});
  const s=await save(p,'twelve-phone');await ensureDraftRecord(p,s,expected);
  return {twelveRows:true,copyAndAddDisabledAtCapacity:true,removeReenables:true,overCapReviewRefused:true,uniqueFieldAssociations:associations.length,keyboardCopies:12,width,controls,phoneScreenshot:'phone-copy-controls.jpg',nativeWorkspace:hash(s.bytes)};
 });
 await scenario('Copy invalidates genuine preview and held native read before an equal-state undo',async()=>{
  assert.ok(legacy,'actual baseline download required');const p=await launchPage(1280,true);await fill(p,raw);
  const actual=path.resolve(legacy),sourceBytes=fs.readFileSync(actual);
  await p.locator('#scope-open').setInputFiles(actual);await p.locator('#scope-open-preview').waitFor({state:'visible'});
  const before=await draft(p);assert.deepEqual(before,raw);let expected=await duplicate(p,1);
  assert.equal(await p.locator('#scope-open-preview').isVisible(),false);assert.equal(await p.locator('#scope-open-cancel').isVisible(),false);assert.match(await p.locator('#scope-file-status').innerText(),/workspace changed/i);
  assert.deepEqual(await draft(p),expected);
  const held=path.join(out,'held-baseline-workspace.json');fs.copyFileSync(actual,held);assert.deepEqual(fs.readFileSync(held),sourceBytes);
  await p.locator('#scope-open').setInputFiles(held);await p.waitForFunction(()=>window.__copyNativeReads.length===1&&window.__copyNativeReads[0].nativeComplete);
  const beforeHeld=await draft(p);expected=await duplicate(p,0);
  assert.equal(await p.locator('#scope-open-cancel').isVisible(),false,'copy immediately invalidates held read');
  assert.match(await p.locator('#scope-file-status').innerText(),/workspace changed/i);
  await rows(p).nth(1).getByRole('button',{name:/Remove checkpoint/}).click();assert.deepEqual(await draft(p),beforeHeld,'visible draft returned to pre-read state');
  const status=await p.locator('#scope-file-status').innerText();
  await p.evaluate(async()=>{window.__copyNativeReads[0].release();await new Promise(requestAnimationFrame);});
  assert.equal(await p.locator('#scope-open-preview').isVisible(),false);assert.equal(await p.locator('#scope-file-status').innerText(),status);assert.deepEqual(await draft(p),beforeHeld);
  const s=await save(p,'after-stale-file');await ensureDraftRecord(p,s,beforeHeld);
  return {genuineFixture:hash(sourceBytes),previewImmediatelyInvalidated:true,completedNativeReadHeld:true,copyImmediatelyInvalidates:true,visibleUndoDoesNotReviveRead:true,nativeWorkspace:hash(s.bytes)};
 });
 await scenario('Latest review evidence is copied and receives native IDs without implicit approval; approval locks editing',async()=>{
  const p=await launchPage();const reviewDraft=clone(raw);for(const cp of reviewDraft.checkpoints)cp.evidence=cp.evidence.trim();await fill(p,reviewDraft);await p.locator('#scope-form button[type="submit"]').click();await p.locator('#scope-review').waitFor({state:'visible'});
  const latest='  LATEST review evidence <literal>\nTwo distinct lines & exact current writing.  ';
  await p.locator('#review-evidence-scope-1').fill(latest);
  assert.equal(await p.locator('#scope-event-count').innerText(),'0 events');await p.locator('#scope-edit').click();
  let expected=clone(reviewDraft);expected.checkpoints[0].evidence=latest;assert.deepEqual(await draft(p),expected);
  expected=await duplicate(p,0);const d=await save(p,'latest-review-evidence-copy');await ensureDraftRecord(p,d,expected);
  await p.locator('#scope-form button[type="submit"]').click();await p.locator('#scope-review').waitFor({state:'visible'});
  const ids=await p.locator('#scope-review-list > [data-checkpoint]').evaluateAll(cs=>cs.map(c=>c.dataset.checkpoint));assert.deepEqual(ids,['scope-1','scope-2','scope-3','scope-4']);
  assert.equal(await p.locator('#scope-event-count').innerText(),'0 events');assert.equal(await p.locator('#scope-approved').innerText(),'0 / 4');
  assert.equal(await p.locator('#review-evidence-scope-1').inputValue(),latest.trim());assert.equal(await p.locator('#review-evidence-scope-2').inputValue(),latest.trim());
  const reviewed=await save(p,'copied-plan-review');assert.equal(reviewed.value.stage,'review');assert.deepEqual(reviewed.value.events,[]);assert.deepEqual(reviewed.value.draft,expected);
  await p.locator('button[data-action="approve"][data-checkpoint="scope-2"]').click();assert.equal(await p.locator('#scope-edit').isEnabled(),false);
  assert.equal(await p.getByRole('button',{name:/Duplicate checkpoint/}).count(),0,'copy controls are unavailable after approval');
  const locked=await save(p,'copied-checkpoint-approved');assert.equal(locked.value.events.length,1);assert.equal(locked.value.events[0].type,'checkpoint.approved');assert.equal(locked.value.events[0].checkpointId,'scope-2');assert.equal(locked.value.events[0].acceptedEvidence,latest.trim());
  assert.equal(await p.locator('#scope-captured').innerText(),'$0.00');
  return {latestEvidencePreserved:true,nativeIds:ids,noImplicitEvents:true,explicitApprovalOnly:'scope-2',editLocked:true,workspaceSha256:[hash(d.bytes).sha256,hash(reviewed.bytes).sha256,hash(locked.bytes).sha256]};
 });
 report.result='PASS';
}
(async()=>{
 try{
  server=http.createServer((req,res)=>{let rel;try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');}catch{res.writeHead(400);res.end();return;}const file=path.resolve(source,rel||'scope.html');if(!file.startsWith(source+path.sep)){res.writeHead(403);res.end();return;}try{const b=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(b);}catch{res.writeHead(404);res.end('Not found');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.SCOPE_COPY_CHROMIUM||'/workspace/scratch/ae0a1ea0b247/browser-tools/runtime/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});report.chromium=browser.version();
  if(mode==='baseline')await baseline();else if(mode==='candidate')await candidate();else throw Error('Invalid mode');
  assert.deepEqual(report.pageErrors,[]);assert.ok(report.externalRequests.every(u=>u==="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap"),'Unexpected external request');report.blockedBaselineFontRequests=report.externalRequests.length;
 }catch(e){report.result='FAIL';report.error=e.stack||String(e);process.exitCode=1;}
 finally{
  if(context)await context.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));
  try{report.pinsAfter=verify();assert.deepEqual(report.pinsAfter,report.pinsBefore);report.sourceUnchanged=true;}catch(e){report.result='FAIL';report.sourceError=String(e);process.exitCode=1;}
  report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:report.result,cases:report.cases.map(x=>({name:x.name,result:x.result,error:x.error})),downloads:report.downloads.length,pageErrors:report.pageErrors,sourceUnchanged:report.sourceUnchanged}));
 }
})();
