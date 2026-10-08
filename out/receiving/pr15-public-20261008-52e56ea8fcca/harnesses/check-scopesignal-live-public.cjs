// Narrow final-public receiving, using the installed upstream Puppeteer driver.
// It verifies the actual browser response bytes against the immutable release
// and exercises one draft -> approval -> real download -> native viewer path.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const puppeteer=require('/Users/me/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core');
const cfg=require(path.resolve(process.argv[2]));
const out=path.resolve(process.argv[3]);
const base=new URL(cfg.baseUrl);
assert.equal(base.href,'https://jacobmetoyer.com/scopesignal/');
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const result={schema:'scopesignal.live-public-receiving.v1',startedAt:new Date().toISOString(),sourceCommit:cfg.sourceCommit,sourceTree:cfg.sourceTree,publicUrl:base.href,deployment:cfg.deployment,node:process.version,platform:process.platform,expectedAssets:cfg.assets,browserAssets:{},checks:[],states:{},downloads:[],pageErrors:[],responseErrors:[],blockedRequests:[],unexpectedRequests:[],limitations:['Synthetic fixture only; no payments, credentials or customer data.','Desktop native Chrome receiving; physical phone/Safari acceptance is not asserted.','Existing third-party font requests are blocked; screenshots use fallback fonts.']};
result.inputMethod='DOM selection of existing textarea contents, then trusted Puppeteer keyboard typing and native pointer approval.';
let browser,profile;
const tasks=[];
async function check(name,run){try{await run();result.checks.push({name,pass:true})}catch(e){result.checks.push({name,pass:false,error:e.message});throw e}}
function sourcePath(url){const u=new URL(url);return u.origin===base.origin&&u.pathname.startsWith(base.pathname)?decodeURIComponent(u.pathname.slice(base.pathname.length))||'index.html':null}
async function guard(page,role){
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=request.url(),u=new URL(url);
    if((request.method()==='GET'&&u.origin===base.origin)||url.startsWith('data:')||url.startsWith('blob:'))return request.continue();
    const event={role,url,method:request.method()};result.blockedRequests.push(event);
    if(!(request.method()==='GET'&&u.hostname==='fonts.googleapis.com'))result.unexpectedRequests.push(event);
    return request.abort();
  });
  page.on('pageerror',error=>result.pageErrors.push({role,error:error.message}));
  page.on('response',response=>{
    const name=sourcePath(response.url());
    if(!name||!['document','script','stylesheet'].includes(response.request().resourceType()))return;
    const task=(async()=>{
      assert(cfg.assets[name], 'Unpinned browser source '+name);
      assert.equal(response.status(),200,name+' browser HTTP status');
      const bytes=await response.buffer(),a={bytes:bytes.length,sha256:hash(bytes),gitBlob:blob(bytes),url:response.url()};
      result.browserAssets[name]=a;
      assert.equal(a.gitBlob,cfg.assets[name].gitBlob,name+' browser Git blob');
      assert.equal(a.sha256,cfg.assets[name].sha256,name+' browser SHA256');
    })().catch(error=>result.responseErrors.push({role,name,error:error.message}));
    tasks.push(task);
  });
}
async function fill(page,selector,text){
  await page.click(selector);await page.$eval(selector,node=>node.select());
  await page.keyboard.type(text);
  assert.equal(await page.$eval(selector,node=>node.value),text,selector+' trusted native text entry');
}
async function state(page){return page.evaluate(()=>({url:location.href,approved:document.querySelector('#approved').innerText,captured:document.querySelector('#captured').innerText,remaining:document.querySelector('#remaining').innerText,events:document.querySelector('#ledger-count').innerText,draft:document.querySelector('#evidence-handoff').value,accepted:document.querySelector('#evidence-accessibility').value,acceptedReadonly:document.querySelector('#evidence-accessibility').readOnly,results:[...document.querySelectorAll('#ledger-body tr')].map(r=>r.lastElementChild.innerText),trace:globalThis.receivingInput||[]}))}
(async()=>{
  await fs.mkdir(out,{recursive:true});const downloads=path.join(out,'downloads');await fs.mkdir(downloads);
  profile=await fs.mkdtemp(path.join(out,'browser-profile-'));
  browser=await puppeteer.launch({headless:true,userDataDir:profile,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking','--no-first-run','--no-default-browser-check']});
  result.browser=await browser.version();
  const context=await browser.createBrowserContext();const app=await context.newPage();await app.setViewport({width:1440,height:1000});await guard(app,'fixture');
  const cdp=await app.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await app.goto(base.href,{waitUntil:'networkidle0',timeout:30000});await app.waitForSelector('#evidence-handoff',{timeout:5000});
  result.livePublicPageInteraction=true;
  await app.evaluate(()=>{globalThis.receivingInput=[];for(const type of ['input','click'])document.addEventListener(type,e=>{if(e.target.closest('#workspace'))globalThis.receivingInput.push({type:e.type,trusted:e.isTrusted,target:e.target.id||e.target.dataset.id||e.target.tagName})},true)});
  result.states.initial=await state(app);
  const draft='\n\nDraft </textarea><img id="injected-evidence" src=x onerror="globalThis.injectedEvidence=true"> & “quoted” 😀\n';
  const accepted='Human reviewed\naccessibility evidence';
  await check('Actual public approval preserves the literal pending draft and accepted evidence',async()=>{
    assert.equal(result.states.initial.events,'7 events');assert.equal(result.states.initial.captured,'$400.00');
    await fill(app,'#evidence-handoff',draft);await fill(app,'#evidence-accessibility','  '+accepted+'  ');
    result.states.beforeApproval=await state(app);
    await app.click('.approve[data-id="accessibility"]');
    const after=result.states.afterApproval=await state(app);
    assert.equal(after.draft,draft);assert.equal(after.accepted,accepted);assert.equal(after.acceptedReadonly,true);
    assert.equal(after.approved,'2 / 3');assert.equal(after.events,'8 events');assert.equal(after.captured,'$400.00');assert.equal(after.remaining,'$800.00');
    assert.deepEqual(after.results.slice(4,7),['webhook received','duplicate ignored','reconciled · counted once']);
    assert(after.trace.some(e=>e.type==='input'&&e.trusted));assert(after.trace.some(e=>e.type==='click'&&e.trusted&&e.target==='accessibility'));
    assert.equal(await app.$$eval('#injected-evidence',nodes=>nodes.length),0);
    assert.equal(await app.evaluate(()=>globalThis.injectedEvidence===true),false);
  });
  // Inspect the long surviving value with native keyboard navigation so its
  // leading newlines do not obscure the text in the receiving screenshot.
  await app.click('#evidence-handoff');await app.keyboard.down('Meta');await app.keyboard.press('ArrowDown');await app.keyboard.up('Meta');
  assert.equal(await app.$eval('#evidence-handoff',n=>n.value),draft);
  await (await app.$('.checkpoints')).screenshot({path:path.join(out,'live-checkpoints.png')});
  const file=path.join(downloads,'scopesignal-fixture-record-v1.json');
  let exported;
  await check('Production download records the accepted evidence and excludes the pending draft',async()=>{
    await app.click('#export-record');
    for(let i=0;i<100;i++){try{await fs.access(file);break}catch{}await new Promise(r=>setTimeout(r,50))}
    const bytes=await fs.readFile(file);exported=JSON.parse(bytes);
    assert.equal(exported.schema,'scopesignal.fixture-record');assert.equal(exported.fixtureOnly,true);assert.equal(exported.paymentEvidence,false);
    assert.equal(exported.events.length,8);assert.equal(exported.summary.approved,2);assert.equal(exported.summary.captured,40000);
    assert.equal(exported.checkpoints.find(c=>c.id==='accessibility').approval.acceptedEvidence,accepted);
    assert.equal(exported.checkpoints.find(c=>c.id==='handoff').approval,null);assert(!bytes.includes('injected-evidence'));
    result.downloads.push({file:'downloads/scopesignal-fixture-record-v1.json',bytes:bytes.length,sha256:hash(bytes),summary:exported.summary});
  });
  let viewer;
  await check('Actual public saved-record link and native file chooser retain the original draft',async()=>{
    const opened=context.waitForTarget(t=>t.url()===new URL('record.html',base).href,{timeout:5000});
    await app.click('#inspect-record');viewer=await(await opened).page();await viewer.setViewport({width:1440,height:1000});await guard(viewer,'viewer');
    await viewer.reload({waitUntil:'networkidle0'});
    assert.equal(await viewer.evaluate(()=>window.opener),null);
    const chooser=viewer.waitForFileChooser({timeout:5000});await viewer.click('#record-file');await(await chooser).accept([file]);
    await viewer.waitForFunction(()=>document.querySelector('#record-status').textContent.includes('Opened scopesignal-fixture-record-v1.json.'),{timeout:5000});
    const openedState=await viewer.evaluate(()=>({url:location.href,evidence:document.querySelector('[data-checkpoint-id="accessibility"] .accepted-evidence').textContent,events:document.querySelectorAll('.saved-event').length,captured:document.querySelector('.record-totals>div:nth-child(3) dd').textContent,approved:document.querySelector('.record-totals>div:nth-child(2) dd').textContent,storage:{local:localStorage.length,session:sessionStorage.length}}));
    result.states.viewer=openedState;assert.equal(openedState.evidence,accepted);assert.equal(openedState.events,8);assert.equal(openedState.captured,'$400.00');assert.equal(openedState.approved,'2 / 3');assert.deepEqual(openedState.storage,{local:0,session:0});
    const parent=result.states.afterViewer=await state(app);assert.equal(parent.draft,draft);assert.equal(parent.events,'8 events');
    await viewer.screenshot({path:path.join(out,'live-record.png'),fullPage:true});
  });
  await Promise.all(tasks);
  await check('Actual public browser bytes match the release with no script errors or unexpected requests',async()=>{
    for(const name of cfg.requiredBrowserAssets)assert(result.browserAssets[name],name+' observed in actual public browser');
    assert.deepEqual(result.responseErrors,[]);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.unexpectedRequests,[]);
  });
  result.passed=true;await context.close();
})().catch(error=>{result.passed=false;result.failure=error.stack;process.exitCode=1}).finally(async()=>{
  await browser?.close();if(profile)await fs.rm(profile,{recursive:true,force:true});
  result.completedAt=new Date().toISOString();await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'browser-receipt.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:result.passed,sourceCommit:result.sourceCommit,browser:result.browser,livePublicPageInteraction:result.livePublicPageInteraction,checks:result.checks,downloads:result.downloads,browserAssets:Object.keys(result.browserAssets).length,failure:result.failure},null,2));
});
