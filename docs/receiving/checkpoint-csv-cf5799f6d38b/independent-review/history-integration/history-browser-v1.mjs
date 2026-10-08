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
const network=[],errors=[],completed=[],begun=[],groups=[],transport=[],baselineAssetRequests=[];
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
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith(origin+'/')||u.startsWith('blob:')||u.startsWith('data:'))r.continue();else{if(u==="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap"){baselineAssetRequests.push({page:p.url(),url:u});}else network.push(u);r.abort();}});
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
const click=async(p,selector)=>{
 await p.bringToFront();
 const point=await p.evaluate(async selector=>{
  const el=document.querySelector(selector);el.scrollIntoView({behavior:'instant',block:'center'});
  let previous=null;const until=performance.now()+3000;
  while(performance.now()<until){
   await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),now={x:r.x,y:r.y,width:r.width,height:r.height};
   if(previous&&Object.keys(now).every(k=>Math.abs(now[k]-previous[k])<0.01)){
    const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
    if(r.width>0&&r.height>0&&el.contains(hit))return{x,y,rect:now,id:el.id,hit:hit.tagName};
   }
   previous=now;
  }
  throw Error('Receiver could not position a stable visible click target: '+selector);
 },selector);
 await p.mouse.click(point.x,point.y);
 transport.push({selector,point,after:await p.evaluate(()=>({url:location.href,visibility:document.visibilityState,clicks:__peer.clicks.slice(-3),fileStatus:document.querySelector('#scope-file-status')?.textContent,reviewHidden:document.querySelector('#scope-review')?.hidden,scopeErrors:document.querySelector('#scope-errors')?.textContent,csvStatus:document.querySelector('#csv-status')?.textContent}))});
};
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
 await group('csv-and-captured-history-coexistence',async()=>{
  const {encodeScopeWorkspace}=await import(new URL('./baseline-contract/src/scope-workspace-record.mjs',import.meta.url));
  const {createScopeReview}=await import(new URL('./baseline-contract/src/scope-plan.mjs',import.meta.url));
  const originalDraft={label:'PEER previous reviewed scope',brief:'Retain this active fictional review while another draft is prepared.',cap:'30.00',checkpoints:[
   {title:'Prior approved checkpoint',amount:'10.00',evidence:'Original planned evidence'},
   {title:'Prior unfinished review',amount:'5.00',evidence:'Other planned evidence'}
  ]};
  const originalReview=createScopeReview(originalDraft);
  originalReview.act('scope-1','approve','Distinct accepted evidence\nwith a second line');
  for(const action of ['order','request','lose'])originalReview.act('scope-1',action);
  const originalRecord=encodeScopeWorkspace({draft:originalDraft,review:originalReview,evidenceDrafts:new Map([['scope-2','  Pending unapproved note\nkept literally  ']])});
  const originalFile=join(files,'prior-reviewed-unknown.json');await writeFile(originalFile,originalRecord);
  assert.equal(JSON.parse(originalRecord).events.length,4);
  const w=await newPage('/scope.html');
  await upload(w,'#scope-open',originalFile);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);await click(w,'#scope-open-apply');
  await w.waitForFunction(()=>!document.querySelector('#scope-review').hidden&&!document.querySelector('#scope-history').hidden);
  await click(w,'#scope-history > summary');await w.select('#scope-history-event','0');
  const history=async()=>w.evaluate(()=>({hidden:document.querySelector('#scope-history').hidden,open:document.querySelector('#scope-history').open,cursor:document.querySelector('#scope-history-event').value,options:[...document.querySelector('#scope-history-event').options].map(x=>({value:x.value,text:x.textContent})),source:document.querySelector('#scope-history-source').textContent,position:document.querySelector('#scope-history-position').textContent,approved:document.querySelector('#scope-history-approved').textContent,fields:document.querySelector('#scope-history-event-json').textContent,cards:document.querySelector('#scope-history-checkpoints').textContent}));
  const beforeHistory=await history();assert.equal(beforeHistory.cursor,'0');assert.equal(beforeHistory.options.length,5);assert.equal(beforeHistory.approved,'0 / 2');
  assert.equal(await w.$eval('#scope-approved',e=>e.textContent),'1 / 2');assert.equal(await w.$eval('#scope-event-count',e=>e.textContent),'4 events');
  assert.match(await w.$eval('[data-checkpoint="scope-1"] .scope-review-state',e=>e.textContent),/unknown/i);
  const currentBefore=await download(w,'#scope-save');assert.equal(currentBefore.contents,originalRecord);
  await upload(w,'#scope-open',paths.pending);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);
  const pendingBefore=await w.$eval('#scope-open-summary',e=>e.textContent);
  const p=await newPage('/scope-csv.html');await review(p,paths.literal);const csvDown=await download(p,'#csv-download');assert.equal(csvDown.contents,literal.encoded);
  assert.deepEqual(await history(),beforeHistory);assert.equal(await w.$eval('#scope-open-summary',e=>e.textContent),pendingBefore);assert.equal(await w.$eval('#scope-open-preview',e=>e.hidden),false);
  await w.bringToFront();await w.select('#scope-history-event','1');assert.equal((await history()).approved,'1 / 2');await w.select('#scope-history-event','0');
  assert.deepEqual(await history(),beforeHistory);assert.equal(await w.$eval('#scope-open-summary',e=>e.textContent),pendingBefore);assert.equal(await w.$eval('#scope-open-preview',e=>e.hidden),false);
  const currentAfter=await download(w,'#scope-save');assert.equal(currentAfter.contents,originalRecord);assert.deepEqual(await history(),beforeHistory);
  await click(w,'#scope-open-cancel');await upload(w,'#scope-open',csvDown.path);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);assert.deepEqual(await history(),beforeHistory);
  await click(w,'#scope-open-cancel');assert.deepEqual(await history(),beforeHistory);
  const afterCancel=await download(w,'#scope-save');assert.equal(afterCancel.contents,originalRecord);
  await upload(w,'#scope-open',csvDown.path);await w.waitForFunction(()=>!document.querySelector('#scope-open-preview').hidden);await click(w,'#scope-open-apply');
  assert.deepEqual(await draft(w),literal.draft);const retired=await history();assert.equal(retired.hidden,true);assert.equal(retired.open,false);assert.deepEqual(retired.options,[]);assert.equal(retired.fields,'');assert.equal(retired.cards,'');assert.equal(retired.source,'');
  const adopted=await download(w,'#scope-save');assert.equal(adopted.contents,literal.encoded);
  await click(w,'#scope-form button[type="submit"]');await w.waitForFunction(()=>!document.querySelector('#scope-review').hidden&&!document.querySelector('#scope-history').hidden);
  const fresh=await history();assert.equal(fresh.cursor,'0');assert.equal(fresh.options.length,1);assert.equal(fresh.source,literal.draft.label.trim());assert.equal(fresh.approved,'0 / 2');assert.match(fresh.fields,/No event has been recorded/);assert.equal(fresh.cards.includes('Distinct accepted evidence'),false);
  assert.equal(await w.$eval('#scope-approved',e=>e.textContent),'0 / 2');assert.equal(await w.$eval('#scope-event-count',e=>e.textContent),'0 events');
  const newReview=await download(w,'#scope-save'),record=JSON.parse(newReview.contents);assert.equal(record.stage,'review');assert.deepEqual(record.draft,literal.draft);assert.deepEqual(record.events,[]);assert.deepEqual(record.evidenceDrafts,[]);
  assert.deepEqual((await state(p)).writes,[]);assert.deepEqual(await w.evaluate(()=>__peer.writes),[]);
  await w.bringToFront();await click(w,'#scope-history > summary');await w.screenshot({path:join(out,'fresh-csv-history.png')});
  await p.close();await w.close();
  return{originalDraft,originalRecord,beforeHistory,pendingBefore,currentBefore,csvDown,currentAfter,afterCancel,retired,adopted,fresh,newReview};
 });
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
}catch(error){groups.push({id:'receiver-or-global-boundary',passed:false,error:{message:String(error),stack:error.stack}});}
finally{
 const version=browser?await browser.version():null;if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
 const result={schema:'scopesignal.csv-history-integration-browser.v1',runtime:process.version,qualification:'ThinkPad Node22 supplemental; required Node>=24 gate remains separate',browser:version,source,origin,receiverSha256:digest(await readFile(new URL(import.meta.url))),scopeSha256:digest(await readFile(join(root,'scope-v1.json'))),sourceManifestSha256:digest(await readFile(join(root,'candidate-source-manifest.json'))),passed:groups.filter(x=>x.passed).length,failed:groups.filter(x=>!x.passed).length,network,errors,transport,baselineAssetRequests,downloads:begun,groups};
 await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,failed:result.failed,browser:version,downloadCount:begun.length}));if(result.failed)process.exitCode=1;
}
