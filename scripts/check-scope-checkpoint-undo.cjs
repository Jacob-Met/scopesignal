#!/usr/bin/env node
const fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),http=require("node:http"),{spawn}=require("node:child_process"),assert=require("node:assert/strict");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const blob=b=>crypto.createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(packet){
 const root=process.env.SCOPESIGNAL_EVIDENCE
  ? path.resolve(process.env.SCOPESIGNAL_EVIDENCE)
  : await fs.mkdtemp(path.join(os.userInfo().homedir,"scopesignal-checkpoint-undo-"));
 if(process.env.SCOPESIGNAL_EVIDENCE)await fs.mkdir(root,{mode:0o700});
 await fs.chmod(root,0o700);
 const source=path.join(root,"source"),output=path.join(root,"evidence");await fs.mkdir(source);await fs.mkdir(output);
 const write=async(name,data)=>{const dest=path.join(output,name);await fs.writeFile(dest,data,{flag:"wx"});return {path:dest,bytes:Buffer.byteLength(data),sha256:sha(data)};};
 const sourcePins={};
 for(const[name,item]of Object.entries(packet.source.files)){
  assert(!path.isAbsolute(name)&&!name.split("/").includes(".."));
  const b=Buffer.from(item.text);assert.equal(blob(b),item.git_blob,name);
  const p=path.join(source,name);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,b,{flag:"wx"});
  sourcePins[name]={bytes:b.length,sha256:sha(b),git_blob:item.git_blob};
 }
 const driverPin=await write("reproduce.cjs",packet.driver);
 const report={schema:"scopesignal.checkpoint-undo-regression/1",head:packet.source.head,tree:packet.source.tree,root,driver:driverPin,host:os.hostname(),node:process.version,started:new Date().toISOString(),sourceBefore:sourcePins,cases:[],screenshots:[],downloads:[],requests:[],serverRequests:[],blockedExternal:[],pageErrors:[],sourceUnchanged:false,browserClosed:false,profileRemoved:false,limits:["Unmodified exact source capsule and fictional local drafts only.","Installed Chrome/Chromium via standard CDP; fresh owned profile. Explicit evidence paths must be writable by that browser.","Keyboard activation and native browser downloads; no provider, account or existing profile.","Missing recovery is a user workflow gap, not a claim that Remove violates its present documented action.","Narrow viewport is not a physical phone. The test holds only completion delivery after a real native File.arrayBuffer read; it does not replace the admitted file bytes."]};
 const server=http.createServer(async(req,res)=>{try{
  const n=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname).replace(/^\/+/,"");report.serverRequests.push(n);
  const item=packet.source.files[n];if(!item){res.writeHead(404);res.end("Not found");return;}
  res.writeHead(200,{"Content-Type":(n.endsWith(".html")?"text/html":n.endsWith(".css")?"text/css":"application/javascript")+"; charset=utf-8","Cache-Control":"no-store"});res.end(item.text);
 }catch(e){res.writeHead(500);res.end("Fixture server error");}});
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const origin="http://127.0.0.1:"+server.address().port;report.origin=origin;
 class Browser{
  constructor(){this.seq=0;this.pending=new Map();this.downloads=new Map();this.asyncErrors=[];this.log="";this.closing=false;}
  async waitFor(fn,label,ms=10000){const end=Date.now()+ms;let last;while(Date.now()<end){if(this.asyncErrors.length)throw Error(this.asyncErrors.join("\n"));try{if(await fn())return;}catch(e){last=e;}await sleep(100);}throw Error("Timed out "+label+(last?": "+last.message:""));}
  command(method,params={},session=this.session){return new Promise((resolve,reject)=>{
   const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);reject(Error("CDP timeout "+method));},15000);
   this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));
  });}
  async evaluate(expression){const r=await this.command("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async key(name){const code={Enter:13,Backspace:8,Tab:9}[name];for(const type of ["keyDown","keyUp"])await this.command("Input.dispatchKeyEvent",{type,key:name,code:name,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,...(name==="Enter"&&type==="keyDown"?{text:"\r",unmodifiedText:"\r"}:{})});}
  async activate(selector){assert(await this.evaluate("!!document.querySelector("+JSON.stringify(selector)+")"),"Missing "+selector);await this.evaluate("document.querySelector("+JSON.stringify(selector)+").focus()");await this.key("Enter");}
  async fill(selector,value){await this.evaluate("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");e.focus();e.select();})()");await this.key("Backspace");if(value)await this.command("Input.insertText",{text:value});}
  async snapshot(){return this.evaluate("({label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,checkpoints:[...document.querySelectorAll('.scope-row')].map(row=>Object.fromEntries(['title','amount','evidence'].map(key=>[key,row.querySelector('[data-field=\"'+key+'\"]').value])))})");}
  async launch(){
   this.profile=await fs.mkdtemp(path.join(root,"profile-"));report.profile=this.profile;
   this.child=spawn(process.env.SCOPESIGNAL_CHROME||"/usr/bin/chromium-browser",["--headless=new","--disable-gpu","--disable-background-networking","--disable-component-update","--disable-sync","--no-first-run","--no-default-browser-check","--disable-dev-shm-usage","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0","--user-data-dir="+this.profile,"about:blank"],{stdio:["ignore","ignore","pipe"]});
   this.child.stderr.on("data",b=>{this.log=(this.log+b.toString()).slice(-32000);});let launchError;this.child.on("error",e=>{launchError=e;});
   let port,endpoint;await this.waitFor(async()=>{if(launchError)throw launchError;if(this.child.exitCode!==null)throw Error("Owned Chromium exited "+this.child.exitCode+": "+this.log);[port,endpoint]=(await fs.readFile(path.join(this.profile,"DevToolsActivePort"),"utf8")).trim().split("\n");return port&&endpoint;},"Chromium startup",20000);
   this.socket=new WebSocket("ws://127.0.0.1:"+port+endpoint);
   this.socket.addEventListener("message",event=>{const m=JSON.parse(event.data);
    if(m.id){const p=this.pending.get(m.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
    else if(m.method==="Runtime.exceptionThrown")report.pageErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    else if(m.method==="Network.requestWillBeSent")report.requests.push({url:m.params.request.url,type:m.params.type,sessionId:m.sessionId});
    else if(m.method==="Fetch.requestPaused"){const url=m.params.request.url,allow=url.startsWith(origin+"/")||url.startsWith("blob:")||url.startsWith("data:");if(!allow)report.blockedExternal.push(url);this.command(allow?"Fetch.continueRequest":"Fetch.failRequest",{requestId:m.params.requestId,...(!allow?{errorReason:"BlockedByClient"}:{})},m.sessionId).catch(e=>this.asyncErrors.push(e.message));}
    else if(m.method==="Browser.downloadWillBegin")this.downloads.set(m.params.guid,{...m.params,state:"started"});
    else if(m.method==="Browser.downloadProgress"){const d=this.downloads.get(m.params.guid);if(d)Object.assign(d,m.params);}
   });
   this.socket.addEventListener("close",()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error("CDP closed"));}this.pending.clear();});
   await new Promise((r,j)=>{this.socket.addEventListener("open",r,{once:true});this.socket.addEventListener("error",j,{once:true});});
   report.chromium=await this.command("Browser.getVersion",{},null);
   await this.command("Browser.setDownloadBehavior",{behavior:"allowAndName",downloadPath:output,eventsEnabled:true},null);
  }
  async newPage(phone){
   this.targetId=(await this.command("Target.createTarget",{url:"about:blank"},null)).targetId;
   this.session=(await this.command("Target.attachToTarget",{targetId:this.targetId,flatten:true},null)).sessionId;
   for(const method of ["Page.enable","Runtime.enable","Network.enable"])await this.command(method);
   await this.command("Fetch.enable",{patterns:[{urlPattern:"*"}]});
   await this.command("Page.addScriptToEvaluateOnNewDocument",{source:"(()=>{const original=File.prototype.arrayBuffer;window.__scopeUndoReads=[];File.prototype.arrayBuffer=function(...args){const p=original.apply(this,args);if(!this.name.startsWith('held-'))return p;return p.then(bytes=>new Promise(resolve=>window.__scopeUndoReads.push({nativeReadComplete:true,release(){resolve(bytes)}})));};})()"});
   await this.command("Emulation.setDeviceMetricsOverride",{width:phone?390:1280,height:phone?844:900,deviceScaleFactor:1,mobile:false});
   await this.command("Page.navigate",{url:origin+"/scope.html"});
   await this.waitFor(()=>this.evaluate("document.readyState==='complete'&&document.querySelectorAll('.scope-row').length===3"),"exact ScopeSignal fixture",10000);
  }
  async save(name){
   const old=new Set(this.downloads.keys());await this.activate("#scope-save");let d;
   await this.waitFor(()=>{d=[...this.downloads.values()].find(x=>!old.has(x.guid));return d&&d.state==="completed";},"native workspace download",10000);
   assert.equal(d.suggestedFilename,"scopesignal-workspace-v1.json");
   const p=path.join(output,d.guid),bytes=await fs.readFile(p);const dest=path.join(output,name+".json");await fs.rename(p,dest);
   const saved={path:dest,bytes:bytes.length,sha256:sha(bytes),suggestedFilename:d.suggestedFilename,record:JSON.parse(bytes.toString("utf8"))};report.downloads.push({...d,path:dest,sha256:saved.sha256});return saved;
  }
  async close(){
   if(this.socket?.readyState===WebSocket.OPEN){this.closing=true;try{await this.command("Browser.close",{},null);}catch(e){report.closeCommandError=e.message;}}
   if(this.child){const exited=()=>this.child.exitCode!==null||this.child.signalCode!==null;for(let i=0;i<30&&!exited();i++)await sleep(100);if(!exited()){report.cleanupSignal="SIGTERM";this.child.kill("SIGTERM");for(let i=0;i<30&&!exited();i++)await sleep(100);}report.browserClosed=exited();report.browserExitCode=this.child.exitCode;report.browserSignal=this.child.signalCode;}
   this.socket?.close();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error("Receiver ended"));}this.pending.clear();
   if(report.browserClosed&&this.profile){await fs.rm(this.profile,{recursive:true,maxRetries:3,retryDelay:100});report.profileRemoved=true;}
   await write("chromium.log",this.log);
  }
 }
 const browser=new Browser();
 try{
  await browser.launch();
  let serial=0;
  const undo="#scope-undo-remove",remove=i=>'button[data-remove="'+i+'"]';
  const available=()=>browser.evaluate("(()=>{const e=document.querySelector('#scope-undo-remove');return !!e&&!e.hidden&&!e.disabled&&e.checkVisibility();})()");
  async function requireUndo(){assert.equal(await available(),true,"The current removal has no usable Undo action");}
  async function unavailable(){assert.equal(await available(),false,"Undo must be unavailable");const before=await browser.snapshot();await browser.evaluate("document.querySelector('#scope-undo-remove')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))");assert.deepEqual(await browser.snapshot(),before,"Unavailable Undo must not change the draft");}
  async function fresh(phone=false){if(browser.targetId&&browser.session){await browser.command("Target.closeTarget",{targetId:browser.targetId},null);browser.session=null;}await browser.newPage(phone);}
  async function saved(label){return browser.save(String(++serial).padStart(2,"0")+"-"+label);}
  async function setFiles(file){const doc=await browser.command("DOM.getDocument");const node=await browser.command("DOM.querySelector",{nodeId:doc.root.nodeId,selector:"#scope-open"});await browser.command("DOM.setFileInputFiles",{nodeId:node.nodeId,files:[file]});}
  async function preview(file){await setFiles(file);await browser.waitFor(()=>browser.evaluate("!document.querySelector('#scope-open-preview').hidden"),"native file preview");}
  async function arm(index=1){const before=await browser.snapshot();await browser.activate(remove(index));await requireUndo();return before;}
  async function check(name,run){const row={name,started:new Date().toISOString()};try{row.evidence=await run();row.result="PASS";}catch(e){row.result="FAIL";row.error=e.stack;}report.cases.push(row);console.log(JSON.stringify({case:name,result:row.result,error:row.error?.split("\n")[0]}));}

  await check("Initial unavailable action and native last-row bound",async()=>{
   await fresh();await unavailable();const initial=await browser.snapshot();
   await browser.activate(remove(0));await browser.activate(remove(0));
   assert.equal(await browser.evaluate("document.querySelector('button[data-remove=\"0\"]').disabled"),true);
   assert.equal((await browser.snapshot()).checkpoints.length,1);
   return{initialRows:initial.checkpoints.length,lastRowProtected:true};
  });

  await check("Keyboard undo preserves complete raw draft, focus and native download",async()=>{
   await fresh();await browser.fill("#scope-label","  Orchard <fixture> Ω  ");await browser.fill("#scope-brief","First line\n\nKeep the final line.");await browser.fill("#scope-cap"," 2000.00 ");
   for(const[k,v]of Object.entries({title:"  Delivery Ω <literal>  ",amount:"007.50",evidence:"  Planned proof\n\nخدمة & final  "}))await browser.fill("#draft-1-"+k,v);
   const before=await arm(),after=await browser.snapshot(),downloadAfter=await saved("removed");assert.deepEqual(downloadAfter.record.draft,after);await requireUndo();
   await browser.activate(undo);assert.deepEqual(await browser.snapshot(),before);assert.equal(await browser.evaluate("document.activeElement.id"),"draft-1-title");
   const restored=await saved("restored");assert.deepEqual(restored.record.draft,before);assert.deepEqual(restored.record.events,[]);assert.equal(restored.record.stage,"draft");await unavailable();
   return{before,after,restoredFile:restored.sha256,focus:"draft-1-title",oneShot:true};
  });

  await check("First and final unfinished rows restore without validation or normalization",async()=>{
   const results=[];for(const index of [0,2]){await fresh();const raw={title:"",amount:"12..30",evidence:"  unfinished\n\nlast line  "};for(const[k,v]of Object.entries(raw))await browser.fill("#draft-"+index+"-"+k,v);
    const before=await arm(index);await browser.activate(undo);assert.deepEqual(await browser.snapshot(),before);assert.equal(await browser.evaluate("document.activeElement.id"),"draft-"+index+"-title");assert.equal(await browser.evaluate("document.querySelector('#scope-errors').hidden"),true);
    const file=await saved("unfinished-"+index);assert.deepEqual(file.record.draft.checkpoints[index],raw);results.push({index,raw,file:file.sha256});}
   return results;
  });

  await check("Later native field edits retire recovery without replacing newer work",async()=>{
   const results=[];for(const selector of ["#scope-label","#scope-brief","#scope-cap","#draft-0-title","#draft-0-amount","#draft-0-evidence"]){await fresh();await arm();await browser.fill(selector,"new authored value Ω");const edited=await browser.snapshot();await unavailable();assert.deepEqual(await browser.snapshot(),edited);results.push({selector,edited});}
   return results;
  });

  await check("Add, duplicate and reorder retire recovery",async()=>{
   const results=[];for(const selector of ["#scope-add",'button[data-duplicate="0"]','button[data-move="down"][data-index="0"]']){await fresh();await arm();await browser.activate(selector);const edited=await browser.snapshot();await unavailable();assert.deepEqual(await browser.snapshot(),edited);results.push({selector,edited});}
   return results;
  });

  await check("A silent field change cannot be overwritten by stale recovery",async()=>{
   await fresh();await arm();await browser.evaluate("document.querySelector('#scope-brief').value='Newer value without a dispatched input event'");
   const changed=await browser.snapshot();await browser.activate(undo);assert.deepEqual(await browser.snapshot(),changed);await unavailable();
   assert.match(await browser.evaluate("document.querySelector('#scope-order-status').textContent"),/draft changed/i);
   return{authoredSilentChange:true,preserved:changed};
  });

  await check("Repeated removals restore only the latest row once",async()=>{
   await fresh();const original=await arm(1),afterFirst=await browser.snapshot();await browser.activate(remove(0));await requireUndo();assert.equal((await browser.snapshot()).checkpoints.length,1);
   await browser.activate(undo);assert.deepEqual(await browser.snapshot(),afterFirst);await unavailable();assert.notDeepEqual(await browser.snapshot(),original);
   return{original,restored:afterFirst,firstRemovedRowStillAbsent:true};
  });

  await check("Restoring the twelfth row reinstates native maximum controls",async()=>{
   await fresh();for(let i=0;i<9;i++)await browser.activate("#scope-add");const before=await browser.snapshot();assert.equal(before.checkpoints.length,12);
   await browser.activate(remove(5));await requireUndo();assert.equal(await browser.evaluate("document.querySelector('#scope-add').disabled"),false);
   await browser.activate(undo);assert.deepEqual(await browser.snapshot(),before);assert.equal(await browser.evaluate("document.querySelector('#scope-add').disabled"),true);
   assert.equal(await browser.evaluate("[...document.querySelectorAll('[data-duplicate]')].every(e=>e.disabled)"),true);await unavailable();
   return{maximum:12,restoredRows:before.checkpoints.length,addAndDuplicateDisabled:true};
  });

  await check("Invalid review preserves undo; actual review, edit and approval retire it",async()=>{
   await fresh();await browser.fill("#draft-0-amount","");const invalid=await arm();await browser.activate('#scope-form button[type="submit"]');
   assert.equal(await browser.evaluate("document.querySelector('#scope-form').hidden"),false);await requireUndo();await browser.activate(undo);assert.deepEqual(await browser.snapshot(),invalid);
   await fresh();await arm();await browser.activate('#scope-form button[type="submit"]');await browser.waitFor(()=>browser.evaluate("!document.querySelector('#scope-review').hidden"),"review");
   const beforeReview=await saved("review");await unavailable();const afterReview=await saved("review-unchanged");assert.deepEqual(afterReview.record,beforeReview.record);
   await browser.activate("#scope-edit");await unavailable();assert.equal((await browser.snapshot()).checkpoints.length,2);
   await browser.activate('#scope-form button[type="submit"]');await browser.activate('[data-action="approve"][data-checkpoint="scope-1"]');
   const approved=await saved("approved");assert.equal(approved.record.events.length,1);assert.equal(await browser.evaluate("document.querySelector('#scope-edit').disabled"),true);
   await unavailable();const afterApproved=await saved("approved-unchanged");assert.deepEqual(afterApproved.record,approved.record);
   return{invalidDraft:invalid,reviewFile:beforeReview.sha256,approvedFile:approved.sha256,oneExplicitApproval:true};
  });

  await check("Undo retires a prepared different-file replacement preview",async()=>{
   await fresh();await browser.fill("#scope-label","Incoming file must not replace this draft");const incoming=await saved("incoming-preview");
   await browser.fill("#scope-label","Current authored draft");const before=await arm();await preview(incoming.path);await requireUndo();await browser.activate(undo);
   assert.deepEqual(await browser.snapshot(),before);assert.equal(await browser.evaluate("document.querySelector('#scope-open-preview').hidden"),true);assert.equal(await browser.evaluate("document.querySelector('#scope-open').value"),"");
   await browser.evaluate("document.querySelector('#scope-open-apply').dispatchEvent(new MouseEvent('click',{bubbles:true}))");assert.deepEqual(await browser.snapshot(),before);
   return{incomingFile:incoming.sha256,restored:before,staleReplacementRefused:true};
  });

  await check("Completed native file read released after Undo cannot revive a preview",async()=>{
   await fresh();await browser.fill("#scope-label","Held incoming file");const incoming=await saved("incoming-held");
   const held=path.join(output,"held-workspace.json");await fs.copyFile(incoming.path,held);
   await browser.fill("#scope-label","Current work survives the late file");const before=await arm();await setFiles(held);
   await browser.waitFor(()=>browser.evaluate("window.__scopeUndoReads[0]?.nativeReadComplete===true"),"actual completed native read");await requireUndo();await browser.activate(undo);
   const status=await browser.evaluate("document.querySelector('#scope-file-status').textContent");
   await browser.evaluate("(async()=>{window.__scopeUndoReads[0].release();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()");
   assert.deepEqual(await browser.snapshot(),before);assert.equal(await browser.evaluate("document.querySelector('#scope-open-preview').hidden"),true);assert.equal(await browser.evaluate("document.querySelector('#scope-file-status').textContent"),status);
   return{incomingFile:incoming.sha256,nativeReadCompletedBeforeHold:true,restored:before,lateCompletionIgnored:true};
  });

  await check("Invalid and canceled native files preserve undo; identical replacement consumes it",async()=>{
   await fresh();await arm();const remaining=await browser.snapshot(),same=await saved("same-remaining");await requireUndo();
   const invalid=path.join(output,"invalid-workspace.json");await fs.writeFile(invalid,"{",{flag:"wx"});await setFiles(invalid);
   await browser.waitFor(()=>browser.evaluate("document.querySelector('#scope-file-status').textContent.includes('Could not open')"),"native invalid file refusal");await requireUndo();assert.deepEqual(await browser.snapshot(),remaining);
   await preview(same.path);await browser.activate("#scope-open-cancel");await requireUndo();assert.deepEqual(await browser.snapshot(),remaining);
   await preview(same.path);await browser.activate("#scope-open-apply");assert.deepEqual(await browser.snapshot(),remaining);await unavailable();
   return{identicalNativeFile:same.sha256,invalidFileAndCancelPreserve:true,explicitReplacementRetires:true};
  });

  await check("Narrow viewport exposes the action and keyboard restores the intended row",async()=>{
   await fresh(true);const before=await arm(2);await browser.evaluate("document.querySelector('#scope-undo-remove').scrollIntoView({block:'center',behavior:'instant'})");
   const bounds=await browser.evaluate("(()=>{const r=document.querySelector('#scope-undo-remove').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,viewport:innerWidth,document:document.documentElement.scrollWidth};})()");
   assert(bounds.x>=0&&bounds.x+bounds.width<=bounds.viewport+1&&bounds.document<=bounds.viewport+1);assert(bounds.height>=40);
   const {data}=await browser.command("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});report.screenshots.push(await write("phone-undo-action.png",Buffer.from(data,"base64")));
   await browser.activate(undo);assert.deepEqual(await browser.snapshot(),before);assert.equal(await browser.evaluate("document.activeElement.id"),"draft-2-title");
   return{bounds,restored:before,focus:"draft-2-title"};
  });

  assert.equal(report.cases.length,13);
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.blockedExternal.filter(u=>!u.startsWith("https://fonts.googleapis.com/")&&!u.startsWith("https://fonts.gstatic.com/")),[]);
 }catch(e){report.error=e.message;report.stack=e.stack;}
 finally{
  await browser.close();await new Promise(r=>server.close(r));
  report.sourceUnchanged=true;for(const[n,p]of Object.entries(sourcePins))if(sha(await fs.readFile(path.join(source,n)))!==p.sha256)report.sourceUnchanged=false;
  report.finished=new Date().toISOString();
  report.result=report.error?"RECEIVING_ERROR":report.cases.length===13&&report.cases.every(c=>c.result==="PASS")?"PASS":"FAIL";
  const bytes=Buffer.from(JSON.stringify(report,null,2)+"\n");const receipt=await write("result.json",bytes);
  console.log(JSON.stringify({root,result:report.result,head:report.head,tree:report.tree,driver:driverPin,receipt,chromium:report.chromium,cases:report.cases.map(c=>({name:c.name,result:c.result,error:c.error?.split("\n")[0]})),error:report.error,sourceUnchanged:report.sourceUnchanged,browserClosed:report.browserClosed,profileRemoved:report.profileRemoved,browserExitCode:report.browserExitCode,browserSignal:report.browserSignal,pageErrors:report.pageErrors,blockedExternal:report.blockedExternal}));
  process.exitCode=report.result==="PASS"?0:1;
 }
}
async function run(){
 const sourceRoot=path.resolve(process.env.SCOPESIGNAL_SOURCE||path.join(__dirname,".."));
 const expected=process.env.SCOPESIGNAL_PINS?JSON.parse(await fs.readFile(process.env.SCOPESIGNAL_PINS,"utf8")).files:null;
 const names=(await fs.readdir(sourceRoot,{withFileTypes:true})).filter(e=>e.isFile()&&/\.(html|css)$/.test(e.name)).map(e=>e.name);
 for(const e of await fs.readdir(path.join(sourceRoot,"src"),{withFileTypes:true}))if(e.isFile()&&e.name.endsWith(".mjs"))names.push("src/"+e.name);
 const files={};for(const name of names.sort()){
  const bytes=await fs.readFile(path.join(sourceRoot,name)),git_blob=blob(bytes);
  if(expected)assert.equal(git_blob,expected[name],"declared source pin "+name);
  files[name]={text:bytes.toString("utf8"),git_blob};
 }
 if(expected)assert.deepEqual(Object.keys(files).sort(),Object.keys(expected).sort(),"declared source file set");
 assert.ok(files["scope.html"]&&files["src/scope-workspace.mjs"],"ScopeSignal source missing");
 const driver=await fs.readFile(__filename,"utf8");
 await main({source:{head:process.env.SCOPESIGNAL_SOURCE_PIN||"explicit source files; see sourceBefore",tree:"exact declared files; see sourceBefore",files},driver});
 for(const[name,item]of Object.entries(files))assert.equal(blob(await fs.readFile(path.join(sourceRoot,name))),item.git_blob,"original source changed "+name);
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
