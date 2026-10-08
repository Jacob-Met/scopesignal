/* ScopeSignal authored-history native browser receiving.
 * node check-scope-history.cjs SOURCE_ROOT NEW_OUTPUT_DIRECTORY
 * Uses the actual source page and existing private Chromium; fictional inputs only.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const sourceRoot = fs.realpathSync(process.argv[2]);
const output = path.resolve(process.argv[3]);
fs.mkdirSync(output);
const temporary = path.join(output, 'tmp');
fs.mkdirSync(temporary);
process.env.TMPDIR = temporary;
const { chromium } = require(process.env.SCOPESIGNAL_PLAYWRIGHT || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chrome = process.env.SCOPESIGNAL_CHROME || '/tmp/hamon-project-browser-ce7eb129730f/portable-153/chromium';
const sourceNames = ['scope.html','styles.css','scope-workspace.css','src/scope-workspace.mjs','src/scope-plan.mjs','src/scope-workspace-record.mjs','src/scope-review-export.mjs','src/ledger.mjs','src/payment-status.mjs'];
const optional = ['src/scope-history.mjs','src/scope-history-view.mjs','scope-history.css'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const pins = () => Object.fromEntries([...sourceNames,...optional.filter(n=>fs.existsSync(path.join(sourceRoot,n)))].map(n=>[n,sha(fs.readFileSync(path.join(sourceRoot,n)))]));
const report = {schema:'scopesignal.authored-history.browser.v1',sourceRoot,started:new Date().toISOString(),probeSha256:sha(fs.readFileSync(__filename)),sourceBefore:pins(),node:process.version,groups:[],downloads:[],externalRequests:[],pageErrors:[],served:[]};
let browser, server;
async function group(name, fn) { try { await fn(); report.groups.push({name,passed:true}); return true; } catch(error) {report.groups.push({name,passed:false,error:error.stack});report.error=error.stack;return false;} }
(async()=>{
  server=http.createServer((req,res)=>{
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const relative=pathname==='/'?'scope.html':decodeURIComponent(pathname.slice(1));
    const filename=path.resolve(sourceRoot,relative);
    if(!filename.startsWith(sourceRoot+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);res.end();return;}
    const bytes=fs.readFileSync(filename);
    report.served.push({path:relative,sha256:sha(bytes)});
    const mime=relative.endsWith('.mjs')||relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.html')?'text/html':'application/json';
    res.writeHead(200,{'Content-Type':mime+';charset=utf-8'});res.end(bytes);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  report.chromium=browser.version();
  const context=await browser.newContext({viewport:{width:1180,height:960},acceptDownloads:true});
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    report.externalRequests.push({url:route.request().url(),action:'blocked'});return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(origin+'/scope.html');
  await page.locator('#draft-0-title').waitFor();
  const cp=id=>page.locator('.scope-review-card[data-checkpoint="'+id+'"]');
  const act=async(id,action)=>{await cp(id).locator('button[data-action="'+action+'"]').click();};
  async function save(name) {
    const waiting=page.waitForEvent('download');
    await page.locator('#scope-save').click();
    const download=await waiting;
    const filename=path.join(output,name);
    await download.saveAs(filename);
    const bytes=fs.readFileSync(filename);
    report.downloads.push({file:name,suggestedFilename:download.suggestedFilename(),bytes:bytes.length,sha256:sha(bytes)});
    return {filename,bytes,record:JSON.parse(bytes)};
  }
  let before;
  if(!await group('native authored scope preserves pending evidence and recovery state',async()=>{
    await page.locator('[data-remove="2"]').click();
    await page.locator('#scope-label').fill('Authored two-checkpoint recovery <literal>');
    await page.locator('#scope-brief').fill('Inspect this fictional recovery without changing the reviewed work.');
    await page.locator('#scope-cap').fill('700.00');
    await page.locator('#draft-0-title').fill('Alpha <literal>');
    await page.locator('#draft-0-amount').fill('125.50');
    await page.locator('#draft-0-evidence').fill('Planned Alpha evidence');
    await page.locator('#draft-1-title').fill('Beta <literal>');
    await page.locator('#draft-1-amount').fill('225.75');
    await page.locator('#draft-1-evidence').fill('Planned Beta evidence');
    await page.locator('#scope-form button[type="submit"]').click();
    await page.locator('#scope-review').waitFor({state:'visible'});
    await cp('scope-2').locator('[data-evidence]').fill('Pending Beta note\n<not yet accepted>');
    await cp('scope-1').locator('[data-evidence]').fill('Accepted Alpha proof\nSecond line');
    await act('scope-1','approve');
    assert.equal(await cp('scope-2').locator('[data-evidence]').inputValue(),'Pending Beta note\n<not yet accepted>');
    for(const action of ['order','request','lose','receipt','duplicate'])await act('scope-1',action);
    assert.match(await cp('scope-1').innerText(),/Capture state: unknown/);
    assert.equal(await page.locator('#scope-captured').innerText(),'$0.00');
    report.unknownAfterReceipts={eventCount:await page.locator('#scope-event-count').innerText(),captured:await page.locator('#scope-captured').innerText(),state:await cp('scope-1').locator('.scope-review-state').innerText()};
    await act('scope-1','reconcile');
    assert.equal(await page.locator('#scope-captured').innerText(),'$125.50');
    await cp('scope-2').locator('[data-evidence]').fill('Accepted Beta proof, separate from its plan');
    for(const action of ['approve','order','request','receipt'])await act('scope-2',action);
    assert.equal(await page.locator('#scope-captured').innerText(),'$351.25');
    assert.equal(await page.locator('#scope-approved').innerText(),'2 / 2');
    before=await save('current-before-history.json');
    assert.equal(before.record.events.length,11);
    assert.equal(before.record.draft.label,'Authored two-checkpoint recovery <literal>');
    report.currentTotals={cap:await page.locator('#scope-total').innerText(),captured:await page.locator('#scope-captured').innerText(),remaining:await page.locator('#scope-remaining').innerText(),unallocated:await page.locator('#scope-unallocated').innerText()};
  }))return;
  if(!await group('authored history exposes every recorded prefix without changing the workspace',async()=>{
    assert.equal(await page.locator('#scope-history').count(),1,'The authored workspace has no event-by-event history panel.');
    await page.locator('#scope-history summary').click();
    const choose=page.locator('#scope-history-event');
    assert.equal(await choose.locator('option').count(),12);
    await page.locator('#scope-open').setInputFiles(before.filename);
    await page.locator('#scope-open-preview').waitFor({state:'visible'});
    const observations=[];
    for(const [index,captured,approved,alpha,beta] of [
      [0,'$0.00','0 / 2','not_started','not_started'],
      [1,'$0.00','1 / 2','not_started','not_started'],
      [3,'$0.00','1 / 2','pending','not_started'],
      [4,'$0.00','1 / 2','unknown','not_started'],
      [5,'$0.00','1 / 2','unknown','not_started'],
      [6,'$0.00','1 / 2','unknown','not_started'],
      [7,'$125.50','1 / 2','captured','not_started'],
      [8,'$125.50','2 / 2','captured','not_started'],
      [10,'$125.50','2 / 2','captured','pending'],
      [11,'$351.25','2 / 2','captured','captured']
    ]) {
      await choose.selectOption(String(index));
      assert.equal(await page.locator('#scope-history-captured').innerText(),captured);
      assert.equal(await page.locator('#scope-history-approved').innerText(),approved);
      for(const [id,state] of [['scope-1',alpha],['scope-2',beta]])assert.equal(await page.locator('[data-history-checkpoint="'+id+'"]').getAttribute('data-capture-state'),state);
      if(index>0)assert.deepEqual(JSON.parse(await page.locator('#scope-history-event-json').innerText()),before.record.events[index-1]);
      const historyText=await page.locator('#scope-history').innerText();
      assert.equal(historyText.includes('Pending Beta note'),false);
      if(index===0)assert.equal(historyText.includes('Accepted Alpha proof'),false);
      if(index===1)assert.match(historyText,/Accepted Alpha proof\nSecond line/);
      if(index<8)assert.equal(historyText.includes('Accepted Beta proof, separate from its plan'),false);
      assert.equal(await page.locator('#scope-captured').innerText(),'$351.25');
      assert.equal(await page.locator('#scope-open-preview').isVisible(),true);
      observations.push({index,captured,approved,alpha,beta});
    }
    report.historyPrefixes=observations;
    const after=await save('current-after-history.json');
    assert.deepEqual(after.bytes,before.bytes);
    assert.equal(await page.locator('#scope-open-preview').isVisible(),true);
    await choose.selectOption('4');
    await page.locator('#scope-history-next').focus();
    await page.keyboard.press('Enter');
    assert.equal(await choose.inputValue(),'5');
    await page.locator('#scope-history-previous').focus();
    await page.keyboard.press('Space');
    assert.equal(await choose.inputValue(),'4');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    report.phone={width:390,noHorizontalOverflow:true};
  }))return;
  report.passed=true;
})().catch(error=>{report.error=error.stack;}).finally(async()=>{
  if(browser)await browser.close().catch(()=>{});
  if(server)await new Promise(resolve=>server.close(resolve));
  report.sourceAfter=pins();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);
  report.finished=new Date().toISOString();
  report.passed=Boolean(report.passed)&&report.sourceUnchanged&&report.pageErrors.length===0;
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({passed:report.passed,groups:report.groups.map(({name,passed})=>({name,passed})),sourceUnchanged:report.sourceUnchanged,pageErrors:report.pageErrors.length,externalRequests:report.externalRequests.length}));
  process.exitCode=report.passed?0:1;
});
