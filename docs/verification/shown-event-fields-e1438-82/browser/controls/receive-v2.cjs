'use strict';
// One finite receiving course. No product module is imported by this controller.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const ROOT = 'C:\\Users\\Veria\\hamon-e1438c9d058f-scopesignal-visible-events-82';
const HOME = 'C:\\Users\\Veria';
const NODE = 'C:\\Program Files\\nodejs\\node.exe';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const REVISION = 'dcad391d11a66a43df32ae1051a48c5ebd22ff34';
const FIXTURE = {bytes:3520,sha256:'8639e3ac91311f7b3d50082bc7424a605f7d83fbc49b1a40b7916399cda6e942'};
const REVIEW = {bytes:13519,sha256:'414e1212721e42d8cd827167090cf446ed5dd2f039f1538d636392bf4c7e52f4'};
const SERVED = ['record.html','record-view.css','src/record-view.mjs','src/record-event-filter.mjs',
  'src/record-event-search.mjs','src/record-review-download.mjs','src/record-review-export.mjs',
  'src/record-reader.mjs','src/fixture-record.mjs','src/ledger.mjs'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object'
  ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
const same = (a,b) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const need = (condition,message) => {if(!condition) throw Error(message);};
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const stamp = () => new Date().toISOString();
let deadline=Date.now()+120000, cfg, configIdentity, fixture, output, profile, downloads;
let server, ws, child, session, nextId=0, directClosed=false, socketClosed=false;
let stdoutFD, stderrFD, outputCreated=false, asynchronousFailure=null, browserPID=null;
const pending=new Map(), bodies=new Map();
const receipt={schema:'scopesignal.shown-disclosures.receiving/1',status:'STARTED',started_at:stamp(),
  qualification:{hosting:'Owned in-process immutable allowlisted loopback server; maintained serve CLI not invoked.',
    input:'CDP file attachment, mouse and keyboard events; no operating-system chooser claim.',
    closure:'Browser.close, its socket, direct spawned child and exact observed PID only; no process-family absence claim.'},
  actions:[],states:[],requests:[],network:[],downloads:[],exceptions:[],console:[],log:[],async_errors:[],outputs:{},cleanup:{},before:null,after:null};
function remaining(){const n=deadline-Date.now();need(n>0,'course deadline exceeded');return n;}
function failAsync(e){asynchronousFailure=e;if(receipt.async_errors.length<32)receipt.async_errors.push({at:stamp(),error:String(e.stack||e)});}
function record(list,value,cap=256){need(list.length<cap,'observation count cap exceeded');list.push(value);}
function plainDirectory(p){const s=fs.lstatSync(p,{bigint:true});need(s.isDirectory()&&!s.isSymbolicLink(),'not plain directory: '+p);}
function stat(p){const s=fs.lstatSync(p,{bigint:true});need(s.isFile()&&!s.isSymbolicLink(),'not regular file: '+p);
  need(s.size<=128n*1024n*1024n,'file exceeds finite read cap');
  return {path:p,type:'regular',bytes:Number(s.size),mode:Number(s.mode),mtime_ns:String(s.mtimeNs),inode:String(s.ino),device:String(s.dev)};}
function read(p){const before=stat(p),body=fs.readFileSync(p);need(same(before,stat(p))&&body.length===before.bytes,'changed during read: '+p);
  return {body,identity:{...before,sha256:sha(body)}};}
function absent(p){try{fs.lstatSync(p);throw Error('occupied path: '+p);}catch(e){if(e.code!=='ENOENT') throw e;}}
function exclusive(p,b){fs.writeFileSync(p,b,{flag:'wx'});const r=read(p);need(r.body.equals(b),'output readback mismatch');return r.identity;}
function observe(){
  const inputs=cfg.inputs.map(pin=>{const r=read(pin.path);need(same(r.identity,pin),'input differs: '+pin.path);return r.identity;});
  const node=read(NODE).identity,browser=read(EDGE).identity,config=read(process.argv[2]).identity;
  need(same(node,cfg.node)&&same(browser,cfg.browser),'runtime changed');need(same(config,configIdentity),'config changed');
  return {inputs,node,browser,config};
}
function admit(){
  need(process.argv.length===4&&/^[0-9a-f]{64}$/.test(process.argv[3]),'config and SHA arguments required');
  need(process.platform==='win32'&&process.arch==='x64'&&process.execPath===NODE&&process.version==='v24.19.0','runtime differs');
  need(os.hostname()==='MSI'&&os.userInfo().username==='Veria'&&os.homedir()===HOME&&process.env.USERPROFILE===HOME,'account differs');
  need(path.resolve(__filename)===path.join(ROOT,'controls','receive-v2.cjs')&&process.argv[2]===path.join(ROOT,'browser-config-v2.json'),'controller path differs');
  const configRead=read(process.argv[2]);configIdentity=configRead.identity;need(configIdentity.sha256===process.argv[3],'config SHA differs');
  cfg=JSON.parse(configRead.body);output=path.join(ROOT,'browser-v2');profile=path.join(output,'profile');downloads=path.join(output,'downloads');
  need(cfg.schema==='scopesignal.shown-disclosures.windows-browser-config/1'&&cfg.root===ROOT&&cfg.source_revision===REVISION,'config scope differs');
  need(cfg.source_root===path.join(ROOT,'kit')&&cfg.fixture===path.join(ROOT,'kit','examples','shown-events.fixture.json')&&
    cfg.expected_review===path.join(ROOT,'controls','expected-review.html')&&cfg.receiver===__filename&&cfg.output===output,'config paths differ');
  need(cfg.host==='MSI'&&cfg.user==='Veria'&&cfg.account_home===HOME&&cfg.node_version==='v24.19.0'&&cfg.browser_version==='155.0.4283.45','config identity differs');
  need(cfg.timeout_seconds===120&&cfg.cleanup_timeout_seconds===60,'bounded timing differs');
  need(cfg.node.path===NODE&&cfg.node.bytes===92825416&&cfg.node.sha256==='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237','Node pin differs');
  need(cfg.browser.path===EDGE&&cfg.browser.bytes===5438280&&cfg.browser.sha256==='4bb4545b4ab80a3cf463a588ce570ca42de38fe6db16e3baeb0798ac75b4648b','Edge pin differs');
  need(Array.isArray(cfg.kit_members)&&cfg.kit_members.length===54&&same(cfg.kit_members,[...cfg.kit_members].sort()),'kit membership differs');
  need(new Set(cfg.kit_members.map(n=>n.toLowerCase())).size===54&&cfg.kit_members.every(n=>/^[A-Za-z0-9_.\/-]+$/.test(n)&&n.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.endsWith('.'))),'unsafe kit member');
  const expected=[...cfg.kit_members.map(n=>path.join(cfg.source_root,...n.split('/'))),cfg.receiver,cfg.expected_review].sort();
  need(Array.isArray(cfg.inputs)&&cfg.inputs.length===56&&same(cfg.inputs.map(x=>x.path).sort(),expected),'input membership differs');
  const parents=new Set([ROOT,path.join(ROOT,'controls'),cfg.source_root]);
  for(const p of expected){let d=path.dirname(p);while(d!==ROOT){parents.add(d);d=path.dirname(d);}}
  [...parents].forEach(plainDirectory);absent(output);
  receipt.before=observe();
  for(const n of SERVED){need(cfg.kit_members.includes(n),'missing source closure member');bodies.set('/'+n,read(path.join(cfg.source_root,...n.split('/'))).body);}
  const f=read(cfg.fixture),r=read(cfg.expected_review);
  need(f.identity.bytes===FIXTURE.bytes&&f.identity.sha256===FIXTURE.sha256,'manual fixture differs');
  need(r.identity.bytes===REVIEW.bytes&&r.identity.sha256===REVIEW.sha256,'whole reference differs');
  fixture=JSON.parse(f.body);need(fixture.events.length===8,'manual event count differs');
  receipt.source_revision=REVISION;receipt.fixture=f.identity;receipt.expected_review=r.identity;
  fs.mkdirSync(output);outputCreated=true;fs.mkdirSync(profile);fs.mkdirSync(downloads);
  stdoutFD=fs.openSync(path.join(output,'browser.stdout'),'wx');stderrFD=fs.openSync(path.join(output,'browser.stderr'),'wx');
}
async function startServer(){
  server=http.createServer((req,res)=>{
    try{
      const pathname=req.url,expectedHost='127.0.0.1:'+server.address().port;
      record(receipt.requests,{at:stamp(),method:req.method,url:pathname,host:req.headers.host});
      if(req.method==='GET'&&req.headers.host===expectedHost&&pathname==='/favicon.ico'){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
      if(req.method!=='GET'||req.headers.host!==expectedHost||!bodies.has(pathname)){res.writeHead(404);res.end();return;}
      const body=bodies.get(pathname),mime=pathname.endsWith('.html')?'text/html; charset=utf-8':pathname.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';
      res.writeHead(200,{'Content-Type':mime,'Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
    }catch(e){failAsync(e);res.destroy();}
  });
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('helper listen timeout')),Math.min(5000,remaining()));
    server.once('error',e=>{clearTimeout(timer);reject(e);});server.listen(0,'127.0.0.1',()=>{clearTimeout(timer);resolve();});});
  receipt.origin='http://127.0.0.1:'+server.address().port;
}
function send(method,params={},sessionId){
  if(asynchronousFailure) return Promise.reject(asynchronousFailure);
  return new Promise((resolve,reject)=>{
    try{need(ws&&ws.readyState===WebSocket.OPEN,'CDP socket not open');const id=++nextId;
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},Math.min(8000,remaining()));
      pending.set(id,{resolve,reject,timer,method});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    }catch(e){reject(e);}
  });
}
async function poll(fn,message,limit=8000){const until=Math.min(deadline,Date.now()+limit);let value;
  while(Date.now()<until){if(asynchronousFailure)throw asynchronousFailure;value=await fn();if(value)return value;await delay(Math.min(50,Math.max(0,until-Date.now())));}
  throw Error(message);
}
function onMessage(event){
  try{
    need(typeof event.data==='string'&&event.data.length<=16*1024*1024,'CDP frame cap exceeded');const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(p.method+': '+JSON.stringify(m.error))):p.resolve(m.result);return;}
    if(m.method==='Runtime.exceptionThrown')record(receipt.exceptions,m.params);
    if(m.method==='Runtime.consoleAPICalled')record(receipt.console,m.params);
    if(m.method==='Log.entryAdded')record(receipt.log,m.params);
    if(m.method==='Network.requestWillBeSent'){record(receipt.network,{url:m.params.request.url,type:m.params.type});}
    if(m.method==='Browser.downloadWillBegin'||m.method==='Browser.downloadProgress')record(receipt.downloads,{method:m.method,...m.params});
  }catch(e){failAsync(e);}
}
async function launch(){
  const args=['--headless=new','--user-data-dir='+profile,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    '--enable-automation','--no-first-run','--no-default-browser-check','--window-size=1360,1000','about:blank'];
  receipt.browser={exe:EDGE,argv:args,spawned_at:stamp(),stdout_bytes:0,stderr_bytes:0,stdout_end:false,stderr_end:false};
  child=spawn(EDGE,args,{stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false});
  receipt.browser.direct_pid=child.pid??null;
  child.once('error',e=>{receipt.browser.spawn_error=String(e);failAsync(e);});
  child.once('exit',(code,signal)=>{receipt.browser.exit={at:stamp(),code,signal};});
  child.once('close',(code,signal)=>{directClosed=true;receipt.browser.close={at:stamp(),code,signal};});
  for(const [stream,name,fd] of [[child.stdout,'stdout',stdoutFD],[child.stderr,'stderr',stderrFD]]){
    stream.on('data',b=>{try{receipt.browser[name+'_bytes']+=b.length;need(receipt.browser[name+'_bytes']<=4*1024*1024,'browser stream exceeds cap');fs.writeSync(fd,b);}catch(e){failAsync(e);}});
    stream.once('end',()=>{receipt.browser[name+'_end']=true;});stream.once('error',e=>{receipt.browser[name+'_error']=String(e);failAsync(e);});
  }
  const active=path.join(profile,'DevToolsActivePort');
  await poll(()=>fs.existsSync(active),'owned DevToolsActivePort missing',10000);
  const lines=read(active).body.toString('utf8').trim().split(/\r?\n/);
  need(lines.length===2&&/^[1-9][0-9]{0,4}$/.test(lines[0])&&Number(lines[0])<65536&&/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(lines[1]),'invalid owned DevToolsActivePort');
  ws=new WebSocket('ws://127.0.0.1:'+lines[0]+lines[1]);
  ws.addEventListener('message',onMessage);
  ws.addEventListener('close',()=>{socketClosed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('CDP socket closed during '+p.method));}pending.clear();});
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('CDP open timeout')),Math.min(8000,remaining()));
    ws.addEventListener('open',()=>{clearTimeout(t);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(t);reject(Error('CDP socket error'));},{once:true});});
  receipt.browser.version=await send('Browser.getVersion');
  need(receipt.browser.version.product.endsWith('/'+cfg.browser_version),'actual browser version differs');
  receipt.browser.command_line=await send('Browser.getBrowserCommandLine');
  const actual=receipt.browser.command_line.arguments;
  for(const required of args.filter(a=>a!=='about:blank'))need(actual.filter(a=>a===required).length===1,'browser command line differs: '+required);
  try{const info=await send('SystemInfo.getProcessInfo');const found=info.processInfo.filter(p=>p.type==='browser');
    receipt.browser.browser_process_observation=found;need(found.length===1&&Number.isSafeInteger(found[0].id)&&found[0].id>0,'browser PID observation ambiguous');browserPID=found[0].id;
  }catch(e){receipt.browser.browser_process_observation_error=String(e);}
  const target=await send('Target.createTarget',{url:'about:blank'});receipt.browser.target=target.targetId;
  session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  for(const method of ['Page.enable','DOM.enable','Runtime.enable','Log.enable','Network.enable'])await send(method,{},session);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads,eventsEnabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false},session);
  await send('Page.navigate',{url:receipt.origin+'/record.html'},session);
  await poll(async()=>await evaluate('document.readyState === "complete" && Boolean(document.querySelector("#record-file"))'),'record page not ready');
}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);need(!r.exceptionDetails,'snapshot evaluation threw');return r.result.value;}
async function one(selector){const doc=await send('DOM.getDocument',{depth:0},session);const r=await send('DOM.querySelectorAll',{nodeId:doc.root.nodeId,selector},session);need(r.nodeIds.length===1,'expected one '+selector);return r.nodeIds[0];}
async function click(selector){const nodeId=await one(selector);await send('DOM.scrollIntoViewIfNeeded',{nodeId},session);
  const q=(await send('DOM.getBoxModel',{nodeId},session)).model.border;const x=(q[0]+q[2]+q[4]+q[6])/4,y=(q[1]+q[3]+q[5]+q[7])/4;
  record(receipt.actions,{kind:'mouse',selector,x,y,at:stamp()});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},session);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1},session);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1},session);
}
async function key(key,code,vk,modifiers=0){record(receipt.actions,{kind:'key',key,code,modifiers,at:stamp()});
  const text=modifiers===0?(key==='Enter'?'\r':key===' '?' ':''):'';
  await send('Input.dispatchKeyEvent',{type:text?'keyDown':'rawKeyDown',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers,...(text?{text,unmodifiedText:text}:{})},session);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers},session);}
async function query(text){await click('#record-event-query');await key('a','KeyA',65,2);await send('Input.insertText',{text},session);record(receipt.actions,{kind:'insertText',selector:'#record-event-query',text,at:stamp()});}
async function select(selector,value){const values=await evaluate('Array.from(document.querySelector('+JSON.stringify(selector)+').options, o => o.value)');const index=values.indexOf(value);need(index>=0&&index<10,'select value missing');
  await click(selector);await key('Home','Home',36);for(let i=0;i<index;i++)await key('ArrowDown','ArrowDown',40);await key('Enter','Enter',13);
  await poll(()=>evaluate('document.querySelector('+JSON.stringify(selector)+').value === '+JSON.stringify(value)),'select did not choose expected value');}
const SNAPSHOT = `(()=>{const $=s=>document.querySelector(s);const rows=[...document.querySelectorAll('.event-list > li')];const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
return {title:$('#record-title')?.textContent,filename:$('.record-filename')?.textContent,status:$('#record-status').textContent,
error:$('#record-error').hidden?null:$('#record-error').textContent,query:$('#record-event-query')?.value,checkpoint:$('#record-event-checkpoint')?.value,type:$('#record-event-type')?.value,
active:{id:document.activeElement?.id,tag:document.activeElement?.tagName,text:document.activeElement?.textContent},count:$('#record-event-count')?.textContent,
announcement:$('#record-event-disclosure-status')?.textContent,emptyVisible:$('.record-event-empty')?!$('.record-event-empty').hidden:null,
expandDisabled:$('#record-events-expand-shown')?.disabled,collapseDisabled:$('#record-events-collapse-shown')?.disabled,
totals:[...document.querySelectorAll('.record-totals > div')].map(e=>[e.querySelector('dt').textContent,e.querySelector('dd').textContent]),
evidence:[...document.querySelectorAll('.accepted-evidence')].map(e=>e.textContent),rows:rows.map((r,i)=>({seq:i+1,hidden:r.hidden,open:r.firstElementChild.open,raw:r.querySelector('.event-json').textContent})),
controls:[...document.querySelectorAll('.record-event-filter-controls input,.record-event-filter-controls select,.record-event-filter-controls button')].map(e=>({id:e.id,tag:e.tagName,text:e.tagName==='BUTTON'?e.textContent:null,rect:rect(e)})),
viewport:{width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth},storage:{local:localStorage.length,session:sessionStorage.length}}})()`;
async function nodeReferences(){const doc=await send('DOM.getDocument',{depth:-1},session),found=[];
  function walk(n){if(n.nodeName==='LI'&&n.children?.some(c=>c.nodeName==='DETAILS')){const d=n.children.find(c=>c.nodeName==='DETAILS'),p=d.children?.find(c=>c.nodeName==='PRE');found.push([n.backendNodeId,d.backendNodeId,p?.backendNodeId]);}for(const c of n.children??[])walk(c);}
  walk(doc.root);need(found.length===8&&found.every(r=>r.every(Number.isInteger)),'event node references missing');return found;}
let baselineReferences;
async function state(name,shown,opened,announcement=''){
  let last;
  const s=await poll(async()=>{const x=await evaluate(SNAPSHOT);last=x;return same(x.rows.filter(r=>!r.hidden).map(r=>r.seq),shown)&&same(x.rows.filter(r=>r.open).map(r=>r.seq),opened)?x:null;},'state did not settle: '+name).catch(e=>{receipt.failed_state={name,expected_shown:shown,expected_opened:opened,last_observation:last??null,observed_at:stamp()};throw e;});
  s.name=name;s.observed_at=stamp();s.node_references=await nodeReferences();record(receipt.states,s,16);
  need(same(s.rows.map(r=>JSON.parse(r.raw)),fixture.events),'whole saved event fields changed');
  need(same(s.rows.map(r=>r.raw),fixture.events.map(e=>JSON.stringify(e,null,2))),'raw event presentation changed');
  need(s.title==='Northstar onboarding refresh'&&s.filename==='shown-events.fixture.json'&&!s.error,'record header/error differs');
  need(same(s.totals,[['Project cap','$1,200.00'],['Approvals recorded','2 / 3'],['Captures recorded','$400.00'],['Remaining in fixture','$800.00']]),'full record totals changed');
  need(same(s.evidence,['Visible <literal> evidence\nKeyboard route.','Second fictional review.']),'evidence changed');
  const filterStates={loaded:['','',''],independent_open_rows:['','',''],intersected_filters:['journey','paypal.webhook.received','CAP-SHOWN-001'],
    keyboard_expand:['journey','paypal.webhook.received','CAP-SHOWN-001'],keyboard_collapse:['journey','paypal.webhook.received','CAP-SHOWN-001'],
    no_matches:['journey','paypal.webhook.received','no-saved-event-matches-82'],reset:['','',''],narrow_literal_query:['','','Visible <literal>']};
  need(same([s.checkpoint,s.type,s.query],filterStates[name]),'filter values differ');
  const checkpointLabel=s.checkpoint?'First-run checklist':'All checkpoints',typeLabel=s.type?'Webhook received':'All event types';
  need(s.count==='Showing '+shown.length+' of 8 recorded events. '+checkpointLabel+' · '+typeLabel+(s.query?' · Search: “'+s.query+'”':'')+'.','shown count text differs');
  need(s.emptyVisible===(shown.length===0),'no-results message visibility differs');
  need(s.announcement===announcement&&s.expandDisabled===(shown.length===0)&&s.collapseDisabled===(shown.length===0),'disclosure control state differs');
  need(s.storage.local===0&&s.storage.session===0,'unexpected stored product state');
  if(baselineReferences)need(same(s.node_references,baselineReferences),'event row/details/raw nodes replaced');else baselineReferences=s.node_references;
  return s;
}
async function screenshot(name){await send('DOM.scrollIntoViewIfNeeded',{nodeId:await one('.record-event-filter')},session);
  const geometry=await evaluate(SNAPSHOT);need(geometry.viewport.documentWidth<=geometry.viewport.width+1,'horizontal overflow');
  for(const c of geometry.controls)need(c.rect.width>0&&c.rect.height>0&&c.rect.x>=-1&&c.rect.x+c.rect.width<=geometry.viewport.width+1,'control horizontally clipped');
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session),b=Buffer.from(r.data,'base64');need(b.length<8*1024*1024,'PNG exceeds cap');
  receipt.outputs[name]=exclusive(path.join(output,name),b);return geometry;
}
async function course(){
  await startServer();await launch();
  const file=await one('#record-file');record(receipt.actions,{kind:'DOM.setFileInputFiles',selector:'#record-file',path:cfg.fixture,at:stamp()});
  await send('DOM.setFileInputFiles',{nodeId:file,files:[cfg.fixture]},session);
  await poll(()=>evaluate('document.querySelectorAll(".event-list > li").length === 8'),'file not admitted');
  await state('loaded',[1,2,3,4,5,6,7,8],[]);
  await click('.event-list > li:nth-child(1) summary');await click('.event-list > li:nth-child(8) summary');
  await state('independent_open_rows',[1,2,3,4,5,6,7,8],[1,8]);
  await select('#record-event-checkpoint','journey');await select('#record-event-type','paypal.webhook.received');await query('CAP-SHOWN-001');
  await state('intersected_filters',[5,6],[1,8]);
  await key('Tab','Tab',9);await key('Tab','Tab',9);
  need(await evaluate('document.activeElement.id === "record-events-expand-shown"'),'Expand not keyboard focused');
  await key(' ','Space',32);
  const expanded=await state('keyboard_expand',[5,6],[1,5,6,8],'Expanded 2 shown events.');
  need(expanded.active.id==='record-events-expand-shown','Expand lost focus');
  receipt.desktop_geometry=await screenshot('events-desktop.png');
  await key('Tab','Tab',9);need(await evaluate('document.activeElement.id === "record-events-collapse-shown"'),'Collapse not keyboard focused');
  await key('Enter','Enter',13);
  const collapsed=await state('keyboard_collapse',[5,6],[1,8],'Collapsed 2 shown events.');need(collapsed.active.id==='record-events-collapse-shown','Collapse lost focus');
  await query('no-saved-event-matches-82');await state('no_matches',[],[1,8]);
  absent(path.join(downloads,'scopesignal-record-review.html'));await click('.record-review-download button');
  const completed=await poll(()=>receipt.downloads.find(e=>e.method==='Browser.downloadProgress'&&e.state==='completed'),'review download incomplete');
  const begun=receipt.downloads.filter(e=>e.method==='Browser.downloadWillBegin');need(begun.length===1&&begun[0].guid===completed.guid&&begun[0].suggestedFilename==='scopesignal-record-review.html','download identity differs');
  const download=read(path.join(downloads,'scopesignal-record-review.html'));need(download.body.equals(read(cfg.expected_review).body),'whole actual review download differs');
  need(download.identity.bytes===REVIEW.bytes&&download.identity.sha256===REVIEW.sha256,'download pin differs');receipt.outputs['downloads/scopesignal-record-review.html']=download.identity;
  need(same(fs.readdirSync(downloads),['scopesignal-record-review.html']),'unexpected download member');
  await click('.record-event-filter-controls > button:first-of-type');
  const reset=await state('reset',[1,2,3,4,5,6,7,8],[1,8]);need(reset.active.id==='record-event-checkpoint'&&reset.query===''&&reset.type===''&&reset.checkpoint==='','reset values/focus differ');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false},session);
  await query('Visible <literal>');await state('narrow_literal_query',[1],[1,8]);receipt.narrow_geometry=await screenshot('events-narrow.png');
  need(receipt.exceptions.length===0&&receipt.console.length===0&&!receipt.log.some(e=>e.entry?.level==='error'),'page exception/console/error log');
  need(receipt.network.every(e=>e.url.startsWith(receipt.origin+'/')||e.url.startsWith('data:')||e.url.startsWith('blob:'+receipt.origin+'/')),'unexpected page network target');
  need(receipt.requests.every(r=>r.method==='GET'&&(bodies.has(r.url)||r.url==='/favicon.ico')&&r.host===new URL(receipt.origin).host),'unexpected helper HTTP request');
  need(SERVED.every(n=>receipt.requests.some(r=>r.url==='/'+n)),'source closure not fully requested');
  if(asynchronousFailure)throw asynchronousFailure;
  receipt.course_completed=true;
}
async function cleanup(){
  deadline=Date.now()+60000;const c=receipt.cleanup;c.started_at=stamp();c.forced_termination=false;c.browser_close_acknowledged=false;
  asynchronousFailure=null; // Retained errors must not prevent independent normal cleanup.
  if(ws&&ws.readyState===WebSocket.OPEN){try{await send('Browser.close');c.browser_close_acknowledged=true;}catch(e){c.browser_close_error=String(e);}}
  const until=deadline;
  while(Date.now()<until&&child&&!(directClosed&&receipt.browser.stdout_end&&receipt.browser.stderr_end&&socketClosed))await delay(Math.min(50,until-Date.now()));
  c.socket_closed=socketClosed;c.direct_child_closed=directClosed;c.stdout_end=receipt.browser?.stdout_end??false;c.stderr_end=receipt.browser?.stderr_end??false;
  c.exact_browser_pid=browserPID;c.pid_observations=[];
  if(browserPID){do{const o={pid:browserPID,at:stamp()};try{process.kill(browserPID,0);o.result='PID_EXISTS_IDENTITY_NOT_RECONFIRMED';}catch(e){o.code=e.code??null;o.result=e.code==='ESRCH'?'PID_ABSENT_AT_OBSERVATION':'UNKNOWN';}c.pid_observations.push(o);
      if(o.result!=='PID_EXISTS_IDENTITY_NOT_RECONFIRMED'||Date.now()>=until)break;await delay(Math.min(100,until-Date.now()));}while(Date.now()<until);}
  c.browser_pid_absence=browserPID?(c.pid_observations.at(-1)?.result??'UNKNOWN'):'UNKNOWN_NO_CDP_BROWSER_PID';
  if(ws&&ws.readyState===WebSocket.OPEN)ws.close();
  if(server){server.closeAllConnections();await new Promise(resolve=>{server.close(resolve);setTimeout(resolve,Math.max(1,deadline-Date.now()));});c.helper_server_closed=!server.listening;}
  else c.helper_server_closed=true;
  c.finished_at=stamp();c.normal_observations_complete=Boolean(c.browser_close_acknowledged&&c.socket_closed&&c.direct_child_closed&&c.stdout_end&&c.stderr_end&&receipt.browser?.close?.code===0&&c.helper_server_closed&&(!browserPID||c.browser_pid_absence==='PID_ABSENT_AT_OBSERVATION'));
  if(!c.normal_observations_complete)receipt.cleanup_failure='Normal owned browser closure/drain observations incomplete';
}
async function main(){let error;
  try{admit();await course();}catch(e){error=e;receipt.error=String(e.stack||e);}
  finally{
    if(outputCreated){try{await cleanup();}catch(e){receipt.cleanup_error=String(e.stack||e);error??=e;}
      for(const [fd,name] of [[stdoutFD,'browser.stdout'],[stderrFD,'browser.stderr']])if(fd!==undefined){try{fs.closeSync(fd);receipt.outputs[name]=read(path.join(output,name)).identity;}catch(e){receipt.stream_finalization_error=String(e);error??=e;}}
      try{receipt.after=observe();need(same(receipt.before,receipt.after),'before/after inputs differ');}catch(e){receipt.conservation_error=String(e.stack||e);error??=e;}
      if(receipt.async_errors.length)error??=Error('Retained asynchronous failure');
      receipt.status=!error&&receipt.course_completed&&receipt.cleanup.normal_observations_complete?'PASS':'FAIL';receipt.finished_at=stamp();
      exclusive(path.join(output,'receiving.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
    }
  }
  if(!outputCreated)console.error(JSON.stringify({status:'FAILED_BEFORE_OUTPUT',error:String(error?.stack||error)}));
  else console.log(JSON.stringify({status:receipt.status,root:ROOT,output,receipt:path.join(output,'receiving.json'),states:receipt.states.length}));
  // On failed bounded cleanup the receipt explicitly leaves ownership/closure unknown.
  // Exiting this receiver never sends a termination signal to any browser process.
  process.exit(receipt.status==='PASS'?0:1);
}
main().catch(e=>{console.error(String(e.stack||e));process.exit(1);});
