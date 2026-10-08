import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import puppeteer from '/home/jacob/.local/lib/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
const root=new URL('./',import.meta.url).pathname,source=resolve(process.argv[2]),out=resolve(process.argv[3]);
await mkdir(out,{recursive:false});const downloads=join(out,'downloads'),files=join(out,'fixtures');await mkdir(downloads);await mkdir(files);
const fx=JSON.parse(await readFile(join(root,'baseline-native-fixtures-v1.json'),'utf8'));
const literal=fx.accepted.find(x=>x.id==='literal-CRLF-BOM');
const unfinished=fx.accepted.find(x=>x.id==='unfinished-"1e3"');
const pending=fx.accepted.find(x=>x.id==='twelve-rows');
const inputs={literal:literal.csv,unfinished:unfinished.csv,older:'deliverable,amount,evidence\nOLDER,1.00,Old evidence\n',newer:'deliverable,amount,evidence\nNEWER,2.00,New evidence\n'};
const paths={};
for(const [id,text] of Object.entries(inputs)){paths[id]=join(files,id+'.csv');await writeFile(paths[id],text);}
for(const id of ['older','meta','cancel','reject']){paths['hold-'+id]=join(files,'hold-'+id+'.csv');await writeFile(paths['hold-'+id],inputs.older);}
paths.pending=join(files,'pending-existing.json');await writeFile(paths.pending,pending.encoded);
paths.double=join(files,'double-bom.csv');await writeFile(paths.double,'\uFEFF\uFEFFdeliverable,amount,evidence\nA,1,x\n');
paths.bad=join(files,'malformed-utf8.csv');await writeFile(paths.bad,Buffer.concat([Buffer.from('deliverable,amount,evidence\nA,1,'),Buffer.from([0xc3,0x28]),Buffer.from('\n')]));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const network=[],errors=[],completed=[],begun=[],groups=[],transport=[];
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
 const path=resolve(source,'.'+rel);if(!path.startsWith(source+'/'))throw Error('outside source');
 const bytes=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[extname(path)]||'application/octet-stream'),'Cache-Control':'no-store'});res.end(bytes);
}catch{res.writeHead(404);res.end('not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
let browser,cdp;
const poll=async(fn,label,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,40));}throw Error('Timed out: '+label);};
async function newPage(path){
 const p=await browser.newPage();await p.setViewport({width:1280,height:900});p.setDefaultTimeout(15000);
 p.on('pageerror',e=>errors.push({url:p.url(),message:String(e)}));
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith(origin+'/')||u.startsWith('blob:')||u.startsWith('data:'))r.continue();else{network.push(u);r.abort();}});
 await p.evaluateOnNewDocument(()=>{
  globalThis.__peer={writes:[],gates:{},reads:[],downloadAttempts:0,clicks:[]}; document.addEventListener('click',e=>__peer.clicks.push({id:e.target.id,tag:e.target.tagName,text:e.target.textContent?.slice(0,100)}),true);
  const old=File.prototype.arrayBuffer;
  File.prototype.arrayBuffer=async function(){
   const bytes=await old.call(this);__peer.reads.push({name:this.name,bytes:bytes.byteLength});
   if(this.name.startsWith('hold-'))return await new Promise((resolve,reject)=>{__peer.gates[this.name]={resolve:()=>resolve(bytes),reject:()=>reject(new Error('Peer deliberately rejected the delayed native read'))};});
   return bytes;
  };
  for(const method of ['setItem','removeItem','clear']){const old=Storage.prototype[method];Storage.prototype[method]=function(...args){__peer.writes.push({method,args});return old.apply(this,args);};}
  const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)__peer.downloadAttempts++;return click.call(this);};
 });
 await p.goto(origin+path,{waitUntil:'load'});await p.bringToFront();return p;
}
const click=async(p,selector)=>{await p.bringToFront();const before=await p.$eval(selector,e=>({id:e.id,rect:e.getBoundingClientRect().toJSON(),hidden:e.hidden,disabled:e.disabled}));await p.click(selector);transport.push({selector,before,after:await p.evaluate(()=>({url:location.href,visibility:document.visibilityState,clicks:__peer.clicks.slice(-3),fileStatus:document.querySelector('#scope-file-status')?.textContent,reviewHidden:document.querySelector('#scope-review')?.hidden,scopeErrors:document.querySelector('#scope-errors')?.textContent,csvStatus:document.querySelector('#csv-status')?.textContent}))});};
const set=async(p,selector,value)=>{await p.bringToFront();await p.$eval(selector,(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);};
const upload=async(p,selector,path)=>{await p.bringToFront();await (await p.$(selector)).uploadFile(path);};
const metadata=async(p,d)=>{for(const name of ['label','brief','cap'])await set(p,'#csv-'+name,d[name]);};
const state=async p=>p.evaluate(()=>({visible:!document.querySelector('#csv-preview').hidden,disabled:document.querySelector('#csv-download').disabled,status:document.querySelector('#csv-status').textContent,errorHidden:document.querySelector('#csv-errors').hidden,error:document.querySelector('#csv-errors').textContent,label:document.querySelector('#csv-preview-label').textContent,rows:[...document.querySelectorAll('#csv-preview-rows tr')].map(tr=>Object.fromEntries([...tr.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x.textContent]))),writes:__peer.writes,downloadAttempts:__peer.downloadAttempts,reads:__peer.reads}));
const draft=async p=>p.evaluate(()=>({label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,checkpoints:[...document.querySelectorAll('.scope-row')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x.value])))}));
async function review(p,path,d=literal.draft){await upload(p,'#csv-file',path);await metadata(p,d);await click(p,'#csv-review');await p.waitForFunction(()=>!document.querySelector('#csv-preview').hidden);}
async function download(p,selector){
 const before=begun.length;await click(p,selector);
 const event=await poll(()=>begun[before],'download begin');await poll(()=>completed.find(x=>x.guid===event.guid&&x.state==='completed'),'download complete',30000);
 const path=join(downloads,event.guid),contents=await readFile(path,'utf8');return{path,contents,sha256:digest(contents),suggestedFilename:event.suggestedFilename};
}
async function forceStale(p){const before=begun.length;await p.evaluate(()=>document.querySelector('#csv-download').dispatchEvent(new MouseEvent('click',{bubbles:true})));await new Promise(r=>setTimeout(r,120));assert.equal(begun.length,before);assert.equal((await state(p)).disabled,true);}
async function gate(p,name){await p.waitForFunction(n=>Boolean(__peer.gates[n]),{},name);}
async function release(p,name,reject=false){await p.evaluate(({name,reject})=>__peer.gates[name][reject?'reject':'resolve'](),{name,reject});await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));}
async function group(id,fn){const entry={id,at:new Date().toISOString()};try{entry.evidence=await fn();entry.passed=true;}catch(e){entry.passed=false;entry.error={message:String(e),stack:e.stack};entry.diagnostics=[];for(const p of await browser.pages()){try{entry.diagnostics.push(await p.evaluate(()=>({url:location.href,visibility:document.visibilityState,active:document.activeElement?.outerHTML,clicks:globalThis.__peer?.clicks,fileStatus:document.querySelector('#scope-file-status')?.textContent,reviewHidden:document.querySelector('#scope-review')?.hidden,scopeErrors:document.querySelector('#scope-errors')?.textContent,form:[...document.querySelectorAll('#scope-form input,#scope-form textarea')].map(x=>({id:x.id,value:x.value}))})));}catch{}}}groups.push(entry);await writeFile(join(out,'progress.json'),JSON.stringify(groups,null,2)+'\n');console.log(JSON.stringify({id,passed:entry.passed,error:entry.error?.message}));}
try{
 browser=await puppeteer.launch({executablePath:'/snap/bin/chromium',headless:true,userDataDir:join(out,'browser-profile'),args:['--disk-cache-size=1048576','--disable-background-networking']});
 cdp=await browser.target().createCDPSession();cdp.on('Browser.downloadWillBegin',e=>begun.push(e));cdp.on('Browser.downloadProgress',e=>completed.push(e));
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads,eventsEnabled:true});
 await group('literal-native-download-pending-import-explicit-replacement-and-review',async()=>{
  const p=await newPage('/scope-csv.html'),w=await newPage('/scope.html');
  await set(w,'#scope-label','PEER current untouched workspace');const original=await draft(w);
  await upload(w,'#scope-open',paths.pending);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);
  const pendingBefore=await w.$eval('#scope-open-summary',e=>e.textContent);
  const initial=await state(p);assert.equal(initial.disabled,true);assert.equal(initial.visible,false);assert.equal(begun.length,0);
  await review(p,paths.literal);const preview=await state(p);assert.deepEqual(preview.rows,literal.draft.checkpoints);assert.equal(preview.label,literal.draft.label);
  assert.equal(await p.$eval('#csv-preview-rows',e=>e.querySelectorAll('b,img,script').length),0);assert.equal(begun.length,0);
  assert.deepEqual(await draft(w),original);assert.equal(await w.$eval('#scope-open-summary',e=>e.textContent),pendingBefore);
  assert.equal(await w.$eval('#scope-open-preview',e=>e.hidden),false);
  const csvDownload=await download(p,'#csv-download');assert.equal(csvDownload.contents,literal.encoded);
  assert.deepEqual(await draft(w),original);assert.equal(await w.$eval('#scope-open-summary',e=>e.textContent),pendingBefore);
  await click(w,'#scope-open-cancel');await upload(w,'#scope-open',csvDownload.path);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);
  assert.deepEqual(await draft(w),original);const importSummary=await w.$eval('#scope-open-summary',e=>e.textContent);assert.match(importSummary,/0 recorded approvals · 0 events/);
  await click(w,'#scope-open-cancel');assert.deepEqual(await draft(w),original);
  await upload(w,'#scope-open',csvDownload.path);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);
  await click(w,'#scope-open-apply');assert.deepEqual(await draft(w),literal.draft);
  const resaved=await download(w,'#scope-save');assert.equal(resaved.contents,literal.encoded);
  await click(w,'#scope-form button[type="submit"]');await w.waitForFunction(()=>!document.querySelector('#scope-review').hidden);
  assert.equal(await w.$eval('#scope-event-count',e=>e.textContent),'0 events');
  const reviewed=await download(w,'#scope-save'),record=JSON.parse(reviewed.contents);assert.equal(record.stage,'review');assert.deepEqual(record.events,[]);assert.deepEqual(record.evidenceDrafts,[]);
  assert.equal((await state(p)).writes.length,0);assert.deepEqual(await w.evaluate(()=>__peer.writes),[]);
  await w.bringToFront();await w.screenshot({path:join(out,'literal-reviewed.png')});
  await p.close();await w.close();return{preview,original,pendingBefore,importSummary,csvDownload,resaved,reviewed};
 });
 await group('late-native-file-read-new-file-metadata-cancel-and-rejection',async()=>{
  const p=await newPage('/scope-csv.html');await metadata(p,literal.draft);const evidence={};
  await upload(p,'#csv-file',paths['hold-older']);await click(p,'#csv-review');await gate(p,'hold-older.csv');
  await upload(p,'#csv-file',paths.newer);await click(p,'#csv-review');await p.waitForFunction(()=>!document.querySelector('#csv-preview').hidden);
  const newer=await state(p);assert.equal(newer.rows[0].title,'NEWER');await release(p,'hold-older.csv');assert.deepEqual((await state(p)).rows,newer.rows);
  evidence.newerAfterLateOld=await state(p);
  await upload(p,'#csv-file',paths['hold-meta']);await click(p,'#csv-review');await gate(p,'hold-meta.csv');
  await set(p,'#csv-label','PEER changed during read');await release(p,'hold-meta.csv');const meta=await state(p);assert.equal(meta.visible,false);assert.equal(meta.disabled,true);assert.equal(meta.label,'');await forceStale(p);evidence.metadata=meta;
  await upload(p,'#csv-file',paths['hold-cancel']);await click(p,'#csv-review');await gate(p,'hold-cancel.csv');await click(p,'#csv-cancel');
  await release(p,'hold-cancel.csv');const cancel=await state(p);assert.equal(cancel.visible,false);assert.equal(cancel.disabled,true);await forceStale(p);evidence.cancel=cancel;
  await upload(p,'#csv-file',paths['hold-reject']);await click(p,'#csv-review');await gate(p,'hold-reject.csv');
  await upload(p,'#csv-file',paths.newer);await click(p,'#csv-review');await p.waitForFunction(()=>!document.querySelector('#csv-preview').hidden);
  const good=await state(p);await release(p,'hold-reject.csv',true);const after=await state(p);assert.equal(after.visible,true);assert.equal(after.errorHidden,true);assert.deepEqual(after.rows,good.rows);evidence.currentAfterLateError=after;
  // File object identity changes even when bytes are identical.
  await upload(p,'#csv-file',paths.literal);await click(p,'#csv-review');await p.waitForFunction(()=>!document.querySelector('#csv-preview').hidden);
  const identicalPath=join(files,'same-bytes-new-selection.csv');await writeFile(identicalPath,literal.csv);await upload(p,'#csv-file',identicalPath);
  assert.equal((await state(p)).visible,false);await forceStale(p);evidence.sameBytesReplacement=await state(p);
  await click(p,'#csv-review');await p.waitForFunction(()=>!document.querySelector('#csv-preview').hidden);assert.equal((await state(p)).label,'PEER changed during read');
  assert.deepEqual((await state(p)).writes,[]);evidence.final=await state(p);await p.close();return evidence;
 });
 await group('actual-file-decoding-refusals-and-unchanged-editable-amount-review',async()=>{
  const p=await newPage('/scope-csv.html');await metadata(p,literal.draft);const refused=[];
  for(const path of [paths.bad,paths.double]){
   await upload(p,'#csv-file',path);await click(p,'#csv-review');await p.waitForFunction(()=>!document.querySelector('#csv-errors').hidden);
   const s=await state(p);assert.equal(s.visible,false);assert.equal(s.disabled,true);await forceStale(p);refused.push(s);
  }
  await review(p,paths.unfinished,unfinished.draft);const preview=await state(p);assert.equal(preview.rows[0].amount,'1e3');
  const down=await download(p,'#csv-download');assert.equal(down.contents,unfinished.encoded);
  const w=await newPage('/scope.html');await upload(w,'#scope-open',down.path);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);await click(w,'#scope-open-apply');assert.deepEqual(await draft(w),unfinished.draft);
  await click(w,'#scope-form button[type="submit"]');assert.equal(await w.$eval('#scope-review',e=>e.hidden),true);assert.equal(await w.$eval('#scope-errors',e=>e.hidden),false);const nativeErrors=await w.$eval('#scope-errors',e=>e.textContent);
  await set(w,'#draft-0-amount','1.00');await click(w,'#scope-form button[type="submit"]');await w.waitForFunction(()=>!document.querySelector('#scope-review').hidden);
  assert.equal(await w.$eval('#scope-event-count',e=>e.textContent),'0 events');const corrected=await download(w,'#scope-save');const record=JSON.parse(corrected.contents);assert.deepEqual(record.events,[]);assert.equal(record.draft.checkpoints[0].amount,'1.00');
  assert.deepEqual((await state(p)).writes,[]);assert.deepEqual(await w.evaluate(()=>__peer.writes),[]);await p.close();await w.close();return{refused,preview,down,nativeErrors,corrected};
 });
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
}catch(error){groups.push({id:'receiver-or-global-boundary',passed:false,error:{message:String(error),stack:error.stack}});}
finally{
 const version=browser?await browser.version():null;if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
 const result={schema:'scopesignal.csv-independent-browser.v1',runtime:process.version,qualification:'ThinkPad Node22 supplemental; required Node>=24 gate remains separate',browser:version,source,origin,receiverSha256:digest(await readFile(new URL(import.meta.url))),scopeSha256:digest(await readFile(join(root,'scope-v1.json'))),sourceManifestSha256:digest(await readFile(join(root,'candidate-source-manifest.json'))),passed:groups.filter(x=>x.passed).length,failed:groups.filter(x=>!x.passed).length,network,errors,transport,downloads:begun,groups};
 await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed,browser:version,downloadCount:begun.length}));if(result.failed)process.exitCode=1;
}
