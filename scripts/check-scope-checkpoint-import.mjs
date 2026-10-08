import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.SCOPESIGNAL_PUPPETEER||'puppeteer');
const source=path.resolve(process.env.SCOPESIGNAL_SOURCE||path.join(import.meta.dirname,'..'));
const out=process.env.SCOPESIGNAL_EVIDENCE?path.resolve(process.env.SCOPESIGNAL_EVIDENCE):fs.mkdtempSync(path.join(os.tmpdir(),'scopesignal-checkpoint-receiving-'));
const browserFiles=path.resolve(process.env.SCOPESIGNAL_BROWSER_FILES||out);
const profile=path.join(browserFiles,'profile'),downloads=path.join(browserFiles,'downloads');
for(const folder of[out,profile,downloads])fs.mkdirSync(folder,{recursive:true});
const native=await import(pathToFileURL(path.join(source,'src/scope-workspace-record.mjs')));
const plan=await import(pathToFileURL(path.join(source,'src/scope-plan.mjs')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pins=()=>['README.md','scope.html','scope-workspace.css','scope-checkpoint-import.css','src/scope-plan.mjs','src/scope-workspace-record.mjs','src/scope-workspace.mjs','src/scope-checkpoint-import.mjs','src/scope-checkpoint-import-ui.mjs'].map(name=>{const b=fs.readFileSync(path.join(source,name));return{path:name,bytes:b.length,sha256:hash(b)};});
const fixtureDraft={label:'Saved editorial package — fictional',brief:'Original source brief.\nDo not replace the new project.',cap:'0500.00',checkpoints:[
 {title:'  Rough <layout> & proof  ',amount:'00125.50',evidence:'Original proof line 1\nOriginal line 2'},
 {title:'Caption & localization',amount:'25.00',evidence:'Planned caption evidence'},
 {title:'Delivery package',amount:'010.00',evidence:'Original archive and manifest'}]};
let sourceRaw;
if(process.env.SCOPESIGNAL_CHECKPOINT_SOURCE)sourceRaw=fs.readFileSync(process.env.SCOPESIGNAL_CHECKPOINT_SOURCE);
else{
 const review=plan.createScopeReview(fixtureDraft);review.act('scope-1','approve','ACCEPTED review text: distinct from the planned source');
 for(const action of['order','request','lose'])review.act('scope-1',action);
 sourceRaw=Buffer.from(native.encodeScopeWorkspace({draft:fixtureDraft,review,evidenceDrafts:new Map([['scope-2','PENDING review note: do not copy as planned evidence']])}));
}
const admitted=native.decodeScopeWorkspace(sourceRaw.toString('utf8'));
assert.equal(admitted.review.snapshot().approved,1);assert.equal(admitted.review.snapshot().events.length,4);
const sourceFile=path.join(browserFiles,'source-reviewed.json');fs.writeFileSync(sourceFile,sourceRaw);
const unfinished={label:'Unfinished <source> & literal strings',brief:'Do not copy this brief',cap:'not set',checkpoints:[
 {title:'',amount:'not set',evidence:'  First line\n\n<img src=x onerror="window.injected=true">  '},
 {title:'Equal definition',amount:'0007.00',evidence:'Literal identical rows'},
 {title:'Equal definition',amount:'0007.00',evidence:'Literal identical rows'}]};
const unfinishedFile=path.join(browserFiles,'source-unfinished.json');fs.writeFileSync(unfinishedFile,native.encodeScopeWorkspace({draft:unfinished}));
const sourceInputPins=[sourceFile,unfinishedFile].map(file=>({file,sha256:hash(fs.readFileSync(file))}));
const receipt={schema:'scopesignal.checkpoint-import.browser-receiving/1',started:new Date().toISOString(),node:process.version,sourceBefore:pins(),sourceInputPins,originalSource:{bytes:sourceRaw.length,sha256:hash(sourceRaw)},groups:[],downloads:[],served:[],externalBlocked:[],pageErrors:[],consoleErrors:[]};
const wait=async(check,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=await check();if(v)return v;await new Promise(r=>setTimeout(r,40));}throw new Error('Timed out waiting for checkpoint receiving boundary');};
const group=name=>{receipt.groups.push({name,pass:true});console.log('PASS '+name);};
let browser,server;
try{
 const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let rel;try{rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'scope.html';}catch{res.writeHead(400);res.end();return;}
  const file=path.resolve(source,rel);if(!file.startsWith(source+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const b=fs.readFileSync(file);receipt.served.push({path:rel,bytes:b.length,sha256:hash(b)});res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await puppeteer.launch({executablePath:process.env.SCOPESIGNAL_CHROME||undefined,headless:true,userDataDir:profile,timeout:Number(process.env.SCOPESIGNAL_STARTUP_TIMEOUT_MS||45000),dumpio:Boolean(process.env.SCOPESIGNAL_BROWSER_STDERR),args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run']});
 receipt.browserVersion=await browser.version();const page=await browser.newPage();await page.setViewport({width:1280,height:1000});
 await page.setRequestInterception(true);page.on('request',req=>{if(req.url().startsWith(origin+'/')||/^(data:|blob:)/.test(req.url()))req.continue();else{receipt.externalBlocked.push(req.url());req.abort();}});
 page.on('pageerror',e=>receipt.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')receipt.consoleErrors.push(m.text());});
 const cdp=await browser.target().createCDPSession(),completed=[],begun=new Map();
 cdp.on('Browser.downloadWillBegin',e=>begun.set(e.guid,e.suggestedFilename));
 cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')completed.push(e.guid);});
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
 const read=()=>page.evaluate(()=>({label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,checkpoints:[...document.querySelectorAll('.scope-row')].map(row=>({title:row.querySelector('[data-field=title]').value,amount:row.querySelector('[data-field=amount]').value,evidence:row.querySelector('[data-field=evidence]').value}))}));
 const reset=async()=>{await page.goto(origin+'/scope.html',{waitUntil:'networkidle0',timeout:15000});await page.waitForSelector('#draft-2-evidence');};
 const visible=id=>page.$eval(id,n=>!n.hidden);
 const upload=async(id,file)=>{await(await page.$(id)).uploadFile(file);};
 const choose=async(file=sourceFile)=>{await upload('#scope-checkpoint-file',file);await wait(()=>visible('#scope-checkpoint-preview'));};
 const select=i=>page.click('#scope-checkpoint-choice-'+i);
 const edit=(selector,value,signal=true)=>page.$eval(selector,(input,value,signal)=>{input.value=value;if(signal)input.dispatchEvent(new Event('input',{bubbles:true}));},value,signal);
 const forceApply=()=>page.$eval('#scope-checkpoint-apply',b=>{b.disabled=false;b.click();});
 const download=async name=>{
  const before=completed.length;await page.click('#scope-save');let guid;try{guid=await wait(()=>completed[before],20000);}catch(error){receipt.downloadDiagnosis={begun:[...begun],completed,files:fs.readdirSync(downloads),fileStatus:await page.$eval('#scope-file-status',n=>n.textContent)};throw error;}const file=path.join(downloads,guid);await wait(()=>fs.existsSync(file));
  const b=fs.readFileSync(file);fs.writeFileSync(path.join(out,name),b);receipt.downloads.push({file:name,browserFilename:begun.get(guid),bytes:b.length,sha256:hash(b)});return b;
 };
 const delayReads=()=>page.evaluate(()=>{window.originalArrayBuffer=File.prototype.arrayBuffer;window.heldReaders=[];File.prototype.arrayBuffer=function(){return new Promise((resolve,reject)=>{const file=this;window.heldReaders.push(()=>window.originalArrayBuffer.call(file).then(resolve,reject));});};});
 const release=async index=>{await page.evaluate(index=>window.heldReaders[index](),index);await page.evaluate(()=>new Promise(r=>setTimeout(r,50)));};
 const restoreReads=()=>page.evaluate(()=>{File.prototype.arrayBuffer=window.originalArrayBuffer;});

 await reset();await edit('#scope-label','Current new project — keep <local> & exact');await edit('#scope-brief','Current brief line one\nKeep the second line');const current=await read();
 await upload('#scope-open',sourceFile);await wait(()=>visible('#scope-open-preview'));await choose();
 assert.deepEqual(await read(),current);assert.equal(await page.$$eval('#scope-checkpoint-options input:checked',xs=>xs.length),0);assert.equal(await page.$eval('#scope-checkpoint-apply',b=>b.disabled),true);
 const details=await page.$$eval('#scope-checkpoint-options fieldset',rows=>rows.map(row=>[...row.querySelectorAll('dd')].map(n=>n.textContent)));
 assert.deepEqual(details,admitted.draft.checkpoints.map(cp=>[cp.title,cp.amount,cp.evidence]));
 assert.match(await page.$eval('#scope-checkpoint-source',n=>n.textContent),/Reviewed fixture/);
 await page.screenshot({path:path.join(out,'reviewed-definitions-preview.png'),fullPage:true});
 await page.click('#scope-checkpoint-cancel');assert.deepEqual(await read(),current);assert.equal(await visible('#scope-open-preview'),true);
 group('native reviewed-source preview starts empty and preserves draft and whole-open preview');

 await choose();await forceApply();assert.deepEqual(await read(),current);assert.equal(await visible('#scope-checkpoint-preview'),true);
 await select(2);await select(0);assert.equal(await visible('#scope-open-preview'),true);await page.click('#scope-checkpoint-apply');
 const appended={...current,checkpoints:[...current.checkpoints,admitted.draft.checkpoints[0],admitted.draft.checkpoints[2]]};
 assert.deepEqual(await read(),appended);assert.equal(await page.evaluate(()=>document.activeElement.id),'draft-3-title');
 assert.equal(await visible('#scope-checkpoint-preview'),false);assert.equal(await visible('#scope-open-preview'),false);assert.equal(await page.$eval('#scope-checkpoint-file',n=>n.value),'');
 const saved=await download('selected-draft-download.json');assert.equal(saved.toString(),native.encodeScopeWorkspace({draft:appended}));
 assert.equal(JSON.parse(saved).stage,'draft');assert.deepEqual(JSON.parse(saved).events,[]);assert.deepEqual(JSON.parse(saved).evidenceDrafts,[]);
 group('selective append preserves source order and exports zero transferred review state');

 await reset();const original=await read();await choose(unfinishedFile);await select(2);await select(1);await select(0);await page.click('#scope-checkpoint-apply');
 const rawDraft={...original,checkpoints:[...original.checkpoints,...unfinished.checkpoints]};assert.deepEqual(await read(),rawDraft);assert.equal(await page.evaluate(()=>window.injected),undefined);
 assert.equal((await download('unfinished-combined-download.json')).toString(),native.encodeScopeWorkspace({draft:rawDraft}));
 await page.click('#scope-form button[type=submit]');assert.equal(await visible('#scope-form'),true);assert.equal(await visible('#scope-errors'),true);assert.deepEqual(await read(),rawDraft);
 group('unfinished strings and equal rows remain literal and ordinary review still validates');

 await reset();for(let i=3;i<11;i++)await page.click('#scope-add');const eleven=await read();await choose();await select(0);await select(1);
 assert.equal(await page.$eval('#scope-checkpoint-apply',b=>b.disabled),true);await forceApply();assert.deepEqual(await read(),eleven);assert.equal(await visible('#scope-checkpoint-preview'),true);
 await select(1);await page.click('#scope-checkpoint-apply');assert.equal((await read()).checkpoints.length,12);const twelve=await read();await choose();await select(0);await forceApply();assert.deepEqual(await read(),twelve);
 group('12-row capacity refuses whole append and supports a smaller retry');

 await reset();const beforeEdit=await read();await choose();await select(0);await edit('#draft-0-title','Temporary changed title');await edit('#draft-0-title',beforeEdit.checkpoints[0].title);
 assert.equal(await visible('#scope-checkpoint-preview'),false);await forceApply();assert.deepEqual(await read(),beforeEdit);
 await choose();await select(0);await edit('#scope-brief','Programmatic edit without input',false);const programmatic=await read();await forceApply();assert.deepEqual(await read(),programmatic);assert.equal(await visible('#scope-checkpoint-preview'),false);
 group('A-to-B-to-A edits retire preview and final identity detects edits without input');

 await reset();await delayReads();const beforeDelay=await read();await upload('#scope-checkpoint-file',sourceFile);await edit('#scope-label','Changed while reading');await edit('#scope-label',beforeDelay.label);
 await release(0);assert.equal(await visible('#scope-checkpoint-preview'),false);assert.deepEqual(await read(),beforeDelay);await restoreReads();
 group('delayed reads cannot revive after a same-value draft roundtrip');

 await reset();await delayReads();const beforeOverlap=await read();await upload('#scope-checkpoint-file',sourceFile);await upload('#scope-checkpoint-file',unfinishedFile);
 await release(0);assert.equal(await visible('#scope-checkpoint-preview'),false);await release(1);await wait(()=>visible('#scope-checkpoint-preview'));assert.match(await page.$eval('#scope-checkpoint-source',n=>n.textContent),/Unfinished <source>/);
 await page.click('#scope-checkpoint-cancel');await upload('#scope-checkpoint-file',sourceFile);await page.click('#scope-checkpoint-cancel');await release(2);
 assert.equal(await visible('#scope-checkpoint-preview'),false);assert.deepEqual(await read(),beforeOverlap);await restoreReads();
 group('new selection wins overlapping reads and cancellation retires an in-flight read');

 await reset();const picker=page.waitForFileChooser();await page.click('#scope-checkpoint-file');const chooser=await picker;
 await edit('#scope-label','Edited while chooser is open');const duringChooser=await read();await chooser.accept([sourceFile]);
 assert.equal(await visible('#scope-checkpoint-preview'),false);assert.deepEqual(await read(),duringChooser);await choose();await page.click('#scope-checkpoint-cancel');
 group('chooser-time draft edits refuse old file and permit a fresh selection');

 await reset();const sameDraft=await read();const sameFile=path.join(browserFiles,'same-current-workspace.json');fs.writeFileSync(sameFile,native.encodeScopeWorkspace({draft:sameDraft}));
 await choose();await select(0);await upload('#scope-open',sameFile);await wait(()=>visible('#scope-open-preview'));await page.click('#scope-open-apply');
 assert.deepEqual(await read(),sameDraft);assert.equal(await visible('#scope-checkpoint-preview'),false);await forceApply();assert.deepEqual(await read(),sameDraft);
 group('whole-workspace replacement retires older import even with identical draft values');

 await reset();await choose();await select(0);await page.click('#scope-form button[type=submit]');assert.equal(await visible('#scope-form'),false);assert.equal(await visible('#scope-checkpoint-preview'),false);
 await upload('#scope-checkpoint-file',sourceFile);assert.equal(await visible('#scope-checkpoint-preview'),false);assert.equal(await page.$eval('#scope-event-count',n=>n.textContent),'0 events');
 await page.click('#scope-edit');await choose();await select(0);await page.click('#scope-checkpoint-apply');assert.equal((await read()).checkpoints.length,4);
 await page.click('#scope-form button[type=submit]');assert.equal(await visible('#scope-form'),true);assert.equal(await visible('#scope-errors'),true);await edit('#scope-cap','1400.00');await page.click('#scope-form button[type=submit]');assert.equal(await page.$eval('#scope-approved',n=>n.textContent),'0 / 4');assert.equal(await page.$eval('#scope-event-count',n=>n.textContent),'0 events');
 group('review stage refuses import and Edit draft restores fresh reuse without approvals');

 await reset();const beforeBad=await read();const badFiles=[['malformed.json',Buffer.from('{')],['invalid-utf8.json',Buffer.from([255,254])],['oversized.json',Buffer.alloc(native.MAX_WORKSPACE_BYTES+1,32)],['unsupported.json',Buffer.from(JSON.stringify({...JSON.parse(sourceRaw),version:2}))]];
 for(const[name,b]of badFiles){const file=path.join(browserFiles,name);fs.writeFileSync(file,b);await upload('#scope-checkpoint-file',file);await wait(()=>page.$eval('#scope-checkpoint-status',n=>n.classList.contains('error')));assert.equal(await visible('#scope-checkpoint-preview'),false);assert.deepEqual(await read(),beforeBad);}
 await choose();await page.click('#scope-checkpoint-cancel');
 group('malformed UTF-8 size and unsupported-source refusals preserve draft and retry');

 await reset();await page.setViewport({width:390,height:844});await choose();await page.focus('#scope-checkpoint-choice-1');await page.keyboard.press('Space');
 assert.equal(await page.$eval('#scope-checkpoint-choice-1',n=>n.checked),true);assert.equal(await page.$eval('#scope-checkpoint-options dd.scope-checkpoint-literal',n=>getComputedStyle(n).whiteSpace),'pre-wrap');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:path.join(out,'phone-keyboard-selection.png'),fullPage:true});await page.focus('#scope-checkpoint-apply');await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'draft-3-title');assert.equal((await read()).checkpoints[3].title,admitted.draft.checkpoints[1].title);assert.match(await page.$eval('#scope-checkpoint-status',n=>n.textContent),/1 checkpoint added/);
 group('phone layout keyboard selection and append focus remain usable');

 assert.equal(receipt.pageErrors.length,0);assert.deepEqual(pins(),receipt.sourceBefore);for(const pin of sourceInputPins)assert.equal(hash(fs.readFileSync(pin.file)),pin.sha256);receipt.pass=true;
}catch(error){receipt.pass=false;receipt.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
finally{
 if(browser)await browser.close().catch(e=>receipt.browserCloseError=String(e));if(server)await new Promise(resolve=>server.close(resolve));
 receipt.sourceAfter=pins();receipt.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({pass:receipt.pass,groups:receipt.groups.length,pageErrors:receipt.pageErrors,error:receipt.error,receipt:path.join(out,'receipt.json')}));
}
