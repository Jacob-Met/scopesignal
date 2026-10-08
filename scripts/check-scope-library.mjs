import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const repo=path.resolve(process.argv[2] || '.');
const output=path.resolve(process.argv[3] || 'out/scope-library-browser');
const chrome=process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(output,{recursive:true});
const files=path.join(output,'files'),downloads=path.join(output,'downloads'),profile=path.join(output,'profile');
for(const dir of [files,downloads,profile]) fs.mkdirSync(dir,{recursive:true});
const {encodeScopeWorkspace}=await import(pathToFileURL(path.join(repo,'src/scope-workspace-record.mjs')));
const {createScopeReview}=await import(pathToFileURL(path.join(repo,'src/scope-plan.mjs')));
const {createScopeReviewDocument}=await import(pathToFileURL(path.join(repo,'src/scope-review-export.mjs')));
const draft=label=>({label,brief:'Exact brief <angle> & text\n  second line',cap:'10.00',checkpoints:[{title:'First <script>',amount:'3.25',evidence:'Planned first'},{title:'Second',amount:'2.50',evidence:'Planned second'}]});
const reviewed=draft('Reviewed Ω scope');
const review=createScopeReview(reviewed);
for(const action of ['approve','order','request','lose'])review.act('scope-1',action,'Accepted first');
const workspace={draft:reviewed,review,evidenceDrafts:new Map([['scope-2','Pending second\nexact']])};
const unfinished=draft('Draft <img src=x>');unfinished.cap='not yet';unfinished.checkpoints[0].amount='';
const fixtures=[
  ['a/same.json',encodeScopeWorkspace({draft:unfinished})],
  ['bad.json','{"not":"workspace"}'],
  ['b/same.json',encodeScopeWorkspace(workspace)],
  ['utf8.json',Buffer.from([0xc3,0x28])],
  ['unrepresentable.json',encodeScopeWorkspace({draft:draft('NUL\0kept')})],
  ['oversize.json',Buffer.alloc(1048577,32)]
];
for(const [name,bytes]of fixtures){const p=path.join(files,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);}
const checks=[],errors=[],blocked=[],requests=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){const result=await fn();if(result)return result;await wait(40);}throw Error('Timeout: '+label);}
const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const filename=path.resolve(repo,'.'+decodeURIComponent(url.pathname));
  if(!filename.startsWith(repo+path.sep)){res.writeHead(403);res.end();return;}
  try{const bytes=fs.readFileSync(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}
  catch{res.writeHead(404);res.end('Missing');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const child=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','about:blank'],{stdio:['ignore','pipe','pipe']});
const stderr=[];child.stderr.on('data',b=>stderr.push(b));
let ws;const pending=new Map();let next=0;
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
});
const sessionSend=sid=>(method,params={})=>send(method,params,sid);
try{
  const portFile=path.join(profile,'DevToolsActivePort');
  const port=await until(()=>fs.existsSync(portFile)&&fs.readFileSync(portFile,'utf8').split(/\r?\n/),'Chrome debugger');
  ws=new WebSocket('ws://127.0.0.1:'+port[0]+port[1]);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);if(p){clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}return;}
    const s=message.sessionId;
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    if(message.method==='Fetch.requestPaused'){
      const request=message.params;const url=request.request.url;
      if(url.startsWith(origin+'/')||url.startsWith('file:')||url.startsWith('data:')||url.startsWith('blob:'))send('Fetch.continueRequest',{requestId:request.requestId},s).catch(()=>{});
      else{blocked.push(url);send('Fetch.failRequest',{requestId:request.requestId,errorReason:'BlockedByClient'},s).catch(()=>{});}
    }
    if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);
  });
  const version=await send('Browser.getVersion');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  async function page(url){
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=sessionSend(sessionId);
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    await call('Page.navigate',{url});
    const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    await until(()=>evaluate('document.readyState==="complete"'),'page complete');
    return {call,evaluate,targetId};
  }
  async function choose(p,paths){
    const doc=await p.call('DOM.getDocument');const input=await p.call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#workspace-files'});
    await p.call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});
  }
  const author=await page(origin+'/scope.html');
  await until(()=>author.evaluate('document.querySelectorAll("#scope-draft-list input").length>0'),'author initialized');
  await author.evaluate('document.querySelector("#scope-label").value="Active unsaved Ω";document.querySelector("#scope-label").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("#scope-brief").value="Keep this exact unsaved brief";document.querySelector("#scope-brief").dispatchEvent(new Event("input",{bubbles:true}));');
  const authorState=()=>author.evaluate('JSON.stringify(Array.from(document.querySelectorAll("#scope-form input,#scope-form textarea"),e=>[e.name,e.value]))');
  const before=await authorState();
  assert.deepEqual(await author.evaluate('(()=>{const a=Array.from(document.links).find(a=>a.getAttribute("href")==="./scope-library.html");return {target:a.target,rel:a.rel};})()'),{target:'_blank',rel:'noopener'});
  const library=await page(origin+'/scope-library.html');
  await until(()=>library.evaluate('document.querySelector("#batch-status").textContent.includes("Choose")'),'library initialized');
  assert.equal(await library.evaluate('document.querySelector("#workspace-files").multiple'),true);
  await choose(library,fixtures.map(([name])=>path.join(files,name)));
  await until(()=>library.evaluate('document.querySelectorAll(".workspace-row").length===6 && document.querySelector("#workspace-list").getAttribute("aria-busy")==="false"'),'six-file batch');
  const rows=await library.evaluate('Array.from(document.querySelectorAll(".workspace-row"),e=>e.innerText)');
  fs.writeFileSync(path.join(output,'rows.json'),JSON.stringify(rows,null,2));
  assert.ok(rows[0].includes('Draft <img src=x>'));assert.ok(rows[1].includes('Refused'));assert.ok(rows[2].includes('Reviewed Ω scope'));assert.ok(rows[3].includes('UTF-8'));assert.ok(rows[4].includes('NUL'));assert.ok(rows[5].includes('1 MiB'));
  assert.equal(await library.evaluate('document.querySelectorAll("#workspace-detail img,#workspace-detail script").length'),0);
  assert.ok((await library.evaluate('document.querySelector("#workspace-detail").innerText')).includes('No amounts are totaled'));
  checks.push('actual six-file selection retains order, duplicate names, unfinished fields and individual refusals');
  await library.call('Page.bringToFront');
  await library.evaluate('document.querySelectorAll(".workspace-row")[2].focus()');
  fs.writeFileSync(path.join(output,'keyboard-before.json'),JSON.stringify(await library.evaluate('({focus:document.hasFocus(),active:document.activeElement.outerHTML})'),null,2));
  await library.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await library.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await library.evaluate('document.querySelectorAll(".workspace-row")[2].getAttribute("aria-pressed")'),'true');
  const detail=await library.evaluate('document.querySelector("#workspace-detail").innerText');
  for(const expected of ['Accepted first','Pending second','unknown','$0.00','$5.75'])assert.ok(detail.includes(expected),expected);
  checks.push('keyboard selection shows native unknown outcome and distinct planned/accepted/pending evidence');
  await library.evaluate('document.querySelector("#download-review").click()');
  const exported=path.join(downloads,'scopesignal-review-03.html');
  await until(()=>fs.existsSync(exported),'HTML download');
  assert.equal(fs.readFileSync(exported,'utf8'),createScopeReviewDocument(workspace));
  const offline=await page(pathToFileURL(exported).href);
  assert.ok((await offline.evaluate('document.body.innerText')).includes('Reviewed Ω scope'));
  assert.equal(await offline.evaluate('document.scripts.length'),0);
  assert.equal(await offline.evaluate('document.querySelectorAll("iframe,img,link").length'),0);
  checks.push('physical selected HTML download is byte-exact native export and reopens offline without scripts/resources');
  await library.call('Page.bringToFront');
  await library.evaluate('document.querySelectorAll(".workspace-row")[4].click();document.querySelector("#download-review").click()');
  assert.ok((await library.evaluate('document.querySelector("#export-status").textContent')).includes('cannot be preserved'));
  assert.equal(await library.evaluate('document.querySelectorAll(".workspace-row").length'),6);
  assert.equal(fs.readdirSync(downloads).filter(x=>x.endsWith('.html')).length,1);
  checks.push('HTML-unrepresentable admitted row remains present and export refusal creates no extra download');
  await library.evaluate('window.__pendingReads=0;window.__originalArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const f=this;window.__pendingReads++;return new Promise(r=>setTimeout(r,600)).then(()=>window.__originalArrayBuffer.call(f)).finally(()=>window.__pendingReads--);}');
  await choose(library,[path.join(files,'a/same.json')]);
  assert.equal(await library.evaluate('document.querySelectorAll(".workspace-row").length'),6);
  await library.evaluate('document.querySelector("#clear-batch").click()');
  await until(()=>library.evaluate('window.__pendingReads===0'),'retired Clear read settled');assert.equal(await library.evaluate('document.querySelectorAll(".workspace-row").length'),0);
  await library.evaluate('File.prototype.arrayBuffer=window.__originalArrayBuffer');
  await choose(library,[path.join(files,'a/same.json'),path.join(files,'b/same.json')]);
  await until(()=>library.evaluate('document.querySelectorAll(".workspace-row").length===2'),'fresh batch');
  await library.evaluate('File.prototype.arrayBuffer=function(){const f=this;window.__pendingReads++;return new Promise(r=>setTimeout(r,f.name==="bad.json"?600:20)).then(()=>window.__originalArrayBuffer.call(f)).finally(()=>window.__pendingReads--);}');
  await choose(library,[path.join(files,'bad.json')]);await choose(library,[path.join(files,'b/same.json')]);
  await until(()=>library.evaluate('window.__pendingReads===0'),'both replacement reads settled');
  assert.equal(await library.evaluate('document.querySelectorAll(".workspace-row").length'),1);
  assert.ok((await library.evaluate('document.querySelector(".workspace-row").innerText')).includes('Reviewed Ω scope'));
  checks.push('actual file reads preserve prior batch and retire stale completion after Clear/new selection');
  await library.call('Page.bringToFront');
  await library.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await library.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
  await library.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>fs.writeFileSync(path.join(output,'library-narrow.png'),Buffer.from(r.data,'base64')));
  await library.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await library.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>fs.writeFileSync(path.join(output,'library-desktop.png'),Buffer.from(r.data,'base64')));
  assert.equal(await authorState(),before);assert.deepEqual(errors,[]);
  assert.equal(await library.evaluate('localStorage.length+sessionStorage.length'),0);
  checks.push('narrow and desktop layout, unchanged active unsaved authoring fields, no storage or runtime exceptions');
  const binding={};for(const file of ['scope-library.html','scope-library.css','src/scope-library.mjs','src/scope-library-ui.mjs','scope.html','src/scope-workspace-record.mjs','src/scope-review-export.mjs','src/scope-plan.mjs','src/ledger.mjs','src/payment-status.mjs'])binding[file]=hash(fs.readFileSync(path.join(repo,file)));
  const result={at:new Date().toISOString(),status:'passed',checks,version,node:process.version,sourceSha256:binding,download:{filename:path.basename(exported),sha256:hash(fs.readFileSync(exported)),bytes:fs.statSync(exported).size},blockedExternalRequests:blocked,errors,sourceRoot:repo};
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:checks.length,browser:version.product,download:result.download}));
} catch(error) {
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({at:new Date().toISOString(),checks,error:error.stack,errors,blocked},null,2)+'\n');console.error(error.stack);process.exitCode=1;
} finally {
  try{if(ws?.readyState===WebSocket.OPEN)await send('Browser.close');}catch{}
  ws?.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('receiver closed'));}pending.clear();
  server.close();fs.writeFileSync(path.join(output,'chrome.stderr'),Buffer.concat(stderr));
  if(child.exitCode===null)await Promise.race([new Promise(r=>child.once('exit',r)),wait(2000)]);
  if(child.exitCode===null)child.kill();
}
