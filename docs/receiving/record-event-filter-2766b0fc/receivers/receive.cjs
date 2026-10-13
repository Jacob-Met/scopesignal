const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),os=require('os'),assert=require('assert/strict');
const {chromium}=require('C:/HAMON/acceptance/status-download-2766b0fc/node_modules/playwright');
const stage=__dirname,mode=process.argv[2],root=path.join(stage,mode),out=path.join(stage,mode+'-browser');
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourcePaths=['record.html','record-view.css','src/record-view.mjs','src/record-reader.mjs','src/fixture-record.mjs','src/ledger.mjs',...(mode==='candidate'?['src/record-event-filter.mjs']:[])];
const sources=sourcePaths.map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:sha(fs.readFileSync(path.join(root,p)))}));
const files=Object.fromEntries(sourcePaths.map(p=>['/'+p,fs.readFileSync(path.join(root,p))]));
const requests=[],external=[],pageErrors=[],groups=[];
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;requests.push(p);if(!files[p]){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',p.endsWith('.mjs')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(files[p]);});
const fixture=n=>path.join(stage,'fixtures',n);
const mixed=JSON.parse(fs.readFileSync(fixture('mixed.json'),'utf8'));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(origin+'/')){external.push(url);return route.abort();}return route.continue();});
 await context.addInitScript(()=>{
  const original=File.prototype.arrayBuffer;
  window.__held=[];
  File.prototype.arrayBuffer=function(){if(this.name.startsWith('held-'))return new Promise((resolve,reject)=>window.__held.push(()=>original.call(this).then(resolve,reject)));return original.call(this);};
 });
 const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(String(error)));
 const state=()=>page.evaluate(()=>({totals:document.querySelector('.record-totals')?.textContent,checkpoints:document.querySelector('.record-checkpoints')?.textContent,raw:[...document.querySelectorAll('.event-json')].map(n=>JSON.parse(n.textContent)),visible:[...document.querySelectorAll('.event-list>li')].filter(n=>!n.hidden).map(n=>JSON.parse(n.querySelector('pre').textContent)),open:[...document.querySelectorAll('.saved-event[open]')].map(n=>JSON.parse(n.querySelector('pre').textContent).seq),count:document.querySelector('#record-event-count')?.textContent,checkpoint:document.querySelector('#record-event-checkpoint')?.value,type:document.querySelector('#record-event-type')?.value}));
 const pick=async(name)=>{const chooser=page.waitForEvent('filechooser');await page.locator('#record-file').click();await(await chooser).setFiles(fixture(name));};
 const load=async(name='mixed.json')=>{await pick(name);await page.waitForFunction(name=>document.querySelector('#record-status').textContent.startsWith('Opened '+name+'.'),name);};
 const fresh=async(name='mixed.json')=>{await page.goto(origin+'/record.html');await load(name);};
 const controls=async()=>assert.equal(await page.locator('#record-event-checkpoint').count(),1,'checkpoint filter control missing');
 const seq=events=>events.map(e=>e.seq);
 const visible=async()=>seq((await state()).visible);
 const filter=async(cp,type='')=>{await controls();await page.locator('#record-event-checkpoint').selectOption(cp);await page.locator('#record-event-type').selectOption(type);};
 const group=async(name,fn)=>{try{const detail=await fn();groups.push({name,pass:true,detail});}catch(error){groups.push({name,pass:false,error:String(error.stack||error)});}console.log(JSON.stringify({group:name,pass:groups.at(-1).pass}));};
 const started=new Date().toISOString();
 await group('ordinary file picker preserves all exact fields and full-record outcomes',async()=>{
  await fresh();const s=await state();assert.deepEqual(s.raw,mixed.events);assert.deepEqual(s.visible,mixed.events);assert.equal(mixed.events.length,13);
  assert.equal(mixed.summary.captured,80000);assert.equal(mixed.checkpoints[2].capture.status,'pending');assert.equal(await page.locator('.accepted-evidence img').count(),0);
  return {events:s.raw.length,summary:mixed.summary,literalEvidence:mixed.checkpoints[0].approval.acceptedEvidence};
 });
 await group('checkpoint filter keeps original non-contiguous sequence numbers and totals',async()=>{
  await fresh();const before=await state();await filter('journey');const s=await state();assert.deepEqual(seq(s.visible),[1,3,5,6,8,9,10]);assert.equal(s.totals,before.totals);assert.equal(s.checkpoints,before.checkpoints);assert.deepEqual(s.raw,before.raw);assert.match(s.count,/Showing 7 of 13/);
  return {sequences:seq(s.visible),count:s.count,fullSummaryUnchanged:true};
 });
 await group('event type intersects checkpoint and retains distinct duplicate receipt fields',async()=>{
  await fresh();await filter('','paypal.webhook.received');assert.deepEqual(await visible(),[7,8,9]);await filter('journey','paypal.webhook.received');const s=await state();assert.deepEqual(seq(s.visible),[8,9]);assert.deepEqual(s.visible.map(e=>e.duplicate),[false,true]);assert.deepEqual(s.visible,mixed.events.slice(7,9));return{sequences:seq(s.visible),duplicateFlags:s.visible.map(e=>e.duplicate)};
 });
 await group('hiding and restoring rows keeps open disclosures and exact literal JSON',async()=>{
  await fresh();await page.locator('.saved-event summary').nth(0).click();await page.locator('.saved-event summary').nth(8).click();const before=await state();await filter('accessibility');assert.deepEqual(await visible(),[2,4,7]);await page.getByRole('button',{name:'Show all events',exact:true}).click();const after=await state();assert.deepEqual(after.open,[1,9]);assert.deepEqual(after.raw,before.raw);assert.equal(await page.locator('#record-event-checkpoint').evaluate(n=>n===document.activeElement),true);return{open:after.open,focus:'record-event-checkpoint'};
 });
 await group('no match is explicit and keyboard reset restores all events',async()=>{
  await fresh();await filter('handoff','paypal.webhook.received');assert.deepEqual(await visible(),[]);assert.equal(await page.locator('.record-event-empty').isVisible(),true);assert.match((await state()).count,/Showing 0 of 13/);await page.getByRole('button',{name:'Show all events',exact:true}).focus();await page.keyboard.press('Enter');assert.deepEqual(await visible(),mixed.events.map(e=>e.seq));assert.equal(await page.locator('.record-event-empty').isVisible(),false);return{restored:13};
 });
 await group('refused replacement keeps filters, disclosure and admitted history',async()=>{
  await fresh();await filter('journey','paypal.webhook.received');await page.locator('.saved-event summary').nth(8).click();const before=await state();await pick('invalid.json');await page.waitForFunction(()=>!document.querySelector('#record-error').hidden);const after=await state();assert.deepEqual(after,before);return{retained:after.count,error:await page.locator('#record-error').textContent()};
 });
 await group('valid replacement and a retired older read start the newer file at all events',async()=>{
  await fresh();await filter('journey');await pick('held-mixed.json');await page.waitForFunction(()=>window.__held.length===1);await load('partial.json');await controls();let s=await state();assert.equal(s.checkpoint,'');assert.equal(s.type,'');assert.equal(s.raw.length,6);assert.deepEqual(seq(s.visible),[1,2,3,4,5,6]);await filter('accessibility');const before=await state();await page.evaluate(()=>window.__held.shift()());await page.waitForTimeout(40);assert.deepEqual(await state(),before);return{retainedNewFile:'partial.json',sequences:seq(before.visible),delayedRead:'explicit File.arrayBuffer hold'};
 });
 await group('clear retires pending read and empty valid record has no active filtering',async()=>{
  await fresh();await pick('held-mixed.json');await page.waitForFunction(()=>window.__held.length===1);await page.locator('#clear-record').click();await page.evaluate(()=>window.__held.shift()());await page.waitForTimeout(40);assert.equal(await page.locator('#record-display').isVisible(),false);assert.equal(await page.locator('#record-display').textContent(),'');await load('empty.json');assert.equal((await state()).raw.length,0);if(mode==='candidate'){assert.equal(await page.locator('#record-event-checkpoint').isDisabled(),true);assert.equal(await page.locator('#record-event-type').isDisabled(),true);assert.match((await state()).count,/Showing 0 of 0/);}return{emptyEvents:0,clearRetiredRead:true};
 });
 await group('maximum admitted history remains complete through type filtering',async()=>{
  await fresh('maximum.json');await filter('','paypal.webhook.received');const s=await state();assert.equal(s.raw.length,512);assert.equal(s.visible.length,507);assert.equal(s.visible[0].seq,5);assert.equal(s.visible.at(-1).seq,512);assert.match(s.count,/Showing 507 of 512/);await page.getByRole('button',{name:'Show all events',exact:true}).click();assert.equal((await state()).visible.length,512);return{total:512,webhooks:507,finalSequence:512};
 });
 await group('narrow viewport and native keyboard selection keep controls readable',async()=>{
  await page.setViewportSize({width:390,height:844});await fresh();await controls();await page.locator('#record-event-checkpoint').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal((await state()).checkpoint,'accessibility');assert.deepEqual(await visible(),[2,4,7]);await page.locator('.record-event-filter').scrollIntoViewIfNeeded();const geometry=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.record-event-filter select,.record-event-filter button')].map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}))}));assert(geometry.scroll<=geometry.viewport+1);assert(geometry.controls.every(r=>r.left>=0&&r.right<=geometry.viewport+1&&r.height>=44));await page.screenshot({path:path.join(out,'phone-filter.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await fresh();await filter('journey','paypal.webhook.received');await page.locator('.saved-event summary').nth(8).click();await page.locator('.record-event-filter').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'desktop-filter.png'),fullPage:true});return geometry;
 });
 for(const entry of sources)assert.equal(sha(fs.readFileSync(path.join(root,entry.path))),entry.sha256);
 const fixtureHashes=fs.readdirSync(path.join(stage,'fixtures')).map(p=>({path:p,sha256:sha(fs.readFileSync(fixture(p)))}));
 const result={mode,started,finished:new Date().toISOString(),pid:process.pid,runtime:{host:os.hostname(),user:os.userInfo().username,platform:os.platform(),release:os.release(),node:process.version,browser:browser.version(),playwright:require('C:/HAMON/acceptance/status-download-2766b0fc/node_modules/playwright/package.json').version},sourceUnchanged:true,sources,fixtures:fixtureHashes,requests,externalRequests:external,pageErrors,groups,passed:groups.filter(g=>g.pass).length,total:groups.length};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
 await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
 console.log(JSON.stringify({mode,passed:result.passed,total:result.total,externalRequests:external,pageErrors}));
 process.exitCode=groups.every(g=>g.pass)&&!external.length&&!pageErrors.length?0:1;
})().catch(error=>{console.error(error);server.close();process.exitCode=2;});
