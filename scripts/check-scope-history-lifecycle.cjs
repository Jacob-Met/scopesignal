/* ScopeSignal authored-history lifecycle and refusal browser receiving.
 * node check-scope-history-lifecycle.cjs SOURCE_ROOT NEW_OUTPUT_DIRECTORY
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
const report = {schema:'scopesignal.authored-history.lifecycle.v1',sourceRoot,started:new Date().toISOString(),probeSha256:sha(fs.readFileSync(__filename)),sourceBefore:pins(),node:process.version,groups:[],downloads:[],externalRequests:[],pageErrors:[],served:[]};
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
  let pending, clean;
  if(!await group('zero-history review and historical navigation preserve current pending evidence',async()=>{
    await page.locator('#scope-form button[type="submit"]').click();
    await page.locator('#scope-review').waitFor({state:'visible'});
    assert.equal(await page.locator('#scope-history-event option').count(),1);
    assert.equal(await page.locator('#scope-history-next').isDisabled(),true);
    assert.equal(await page.locator('#scope-history-previous').isDisabled(),true);
    await cp('scope-2').locator('[data-evidence]').fill('\nPending Beta <literal>\nStill unrecorded');
    await cp('scope-3').locator('[data-evidence]').fill('Pending Gamma stays current');
    await cp('scope-1').locator('[data-evidence]').fill('Accepted Alpha <literal>\nLine two');
    await act('scope-1','approve');
    pending=await save('pending-before-navigation.json');
    await page.locator('#scope-history > summary').click();
    await page.locator('#scope-history-event').selectOption('0');
    assert.equal(await cp('scope-2').locator('[data-evidence]').inputValue(),'\nPending Beta <literal>\nStill unrecorded');
    assert.equal((await page.locator('#scope-history').innerText()).includes('Pending Beta'),false);
    assert.equal((await page.locator('#scope-history').innerText()).includes('Accepted Alpha'),false);
    await page.locator('#scope-open').setInputFiles(pending.filename);
    await page.locator('#scope-open-preview').waitFor({state:'visible'});
    await page.locator('#scope-history-next').click();
    assert.equal(await page.locator('#scope-open-preview').isVisible(),true);
    assert.match(await page.locator('#scope-history').innerText(),/Accepted Alpha <literal>\nLine two/);
    const after=await save('pending-after-navigation.json');
    assert.deepEqual(after.bytes,pending.bytes);
    await page.locator('#scope-history-event').selectOption('0');
    await page.locator('#scope-history').screenshot({path:path.join(output,'desktop-history.png')});
    await act('scope-2','approve');
    assert.equal(await page.locator('#scope-open-preview').isVisible(),false);
    assert.equal(await page.locator('#scope-history-event').inputValue(),'2');
    assert.equal(await cp('scope-3').locator('[data-evidence]').inputValue(),'Pending Gamma stays current');
    assert.match(await page.locator('[data-history-checkpoint="scope-2"]').innerText(),/Pending Beta <literal>\nStill unrecorded/);
    report.pendingNavigation={downloadsIdentical:true,unrecordedTextExcluded:true,explicitDecisionAdvancedToLatest:true,explicitDecisionInvalidatedOpenPreview:true};
  }))return;
  if(!await group('native draft replacement clears the earlier scope and review starts at its own zero point',async()=>{
    const record=structuredClone(pending.record);
    record.stage='draft';record.events=[];record.evidenceDrafts=[];
    record.draft={label:'Replacement scope <literal>',brief:'A different authored plan with the same positional ID.',cap:'900.00',
      checkpoints:[{title:'Replacement deliverable',amount:'125.25',evidence:'Replacement planned evidence'}]};
    const input=path.join(output,'authored-replacement-draft.json');
    fs.writeFileSync(input,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
    await page.locator('#scope-open').setInputFiles(input);
    await page.locator('#scope-open-preview').waitFor({state:'visible'});
    await page.locator('#scope-open-apply').click();
    assert.equal(await page.locator('#scope-history').isVisible(),false);
    assert.equal(await page.locator('#scope-history-source').textContent(),'');
    assert.equal(await page.locator('[data-history-checkpoint]').count(),0);
    await page.locator('#scope-form button[type="submit"]').click();
    await page.locator('#scope-review').waitFor({state:'visible'});
    await page.locator('#scope-history > summary').click();
    assert.equal(await page.locator('#scope-history-source').innerText(),'Replacement scope <literal>');
    assert.equal(await page.locator('#scope-history-event option').count(),1);
    assert.equal(await page.locator('[data-history-checkpoint]').count(),1);
    assert.equal(await page.locator('#scope-history-captured').innerText(),'$0.00');
    assert.equal((await page.locator('#scope-history').innerText()).includes('Accepted Alpha'),false);
    clean=await save('replacement-review-zero.json');
    report.replacement={oldScopeCleared:true,newScopeEventCount:0,checkpointCount:1};
  }))return;
  if(!await group('a real native serialization refusal disables only history and a valid replacement recovers it',async()=>{
    await page.locator('#scope-edit').click();
    await page.locator('#scope-cap').fill('0'.repeat(70)+'900.00');
    await page.locator('#scope-form button[type="submit"]').click();
    await page.locator('#scope-review').waitFor({state:'visible'});
    assert.equal(await page.locator('#scope-total').innerText(),'$900.00');
    assert.match(await page.locator('#scope-history-status').innerText(),/history is unavailable.*Project cap must be text of at most 64/);
    assert.equal(await page.locator('#scope-history-display').isVisible(),false);
    assert.equal(await page.locator('#scope-history-event').isDisabled(),true);
    assert.equal(await page.locator('[data-history-checkpoint]').count(),0);
    await cp('scope-1').locator('[data-evidence]').fill('The existing review remains usable');
    await act('scope-1','approve');
    assert.equal(await page.locator('#scope-approved').innerText(),'1 / 1');
    assert.equal(await page.locator('#scope-action-status').evaluate(element=>element.classList.contains('error')),false);
    report.historyRefusal={cause:'Native review accepts a positive cap with more than 64 entered characters; unchanged workspace serialization refuses it.',currentApprovalCount:'1 / 1',oldHistoryCleared:true};
    await page.locator('#scope-open').setInputFiles(clean.filename);
    await page.locator('#scope-open-preview').waitFor({state:'visible'});
    await page.locator('#scope-open-apply').click();
    await page.locator('#scope-history > summary').click();
    assert.equal(await page.locator('#scope-history-display').isVisible(),true);
    assert.equal(await page.locator('#scope-history-event').isDisabled(),false);
    assert.equal(await page.locator('#scope-history-event').inputValue(),'0');
    assert.equal(await page.locator('#scope-history-approved').innerText(),'0 / 1');
    report.historyRefusal.validReplacementRecovered=true;
  }))return;
  if(!await group('historical large safe-cent values remain exact on a narrow native page',async()=>{
    await page.locator('#scope-edit').click();
    await page.locator('#scope-cap').fill('90071992547409.91');
    await page.locator('#draft-0-amount').fill('90071992547409.91');
    await page.locator('#draft-0-title').fill('Large amount <literal> '+ 'x'.repeat(110));
    await page.locator('#scope-form button[type="submit"]').click();
    await page.locator('#scope-review').waitFor({state:'visible'});
    for(const action of ['approve','order','request','receipt'])await act('scope-1',action);
    await page.locator('#scope-history > summary').click();
    await page.locator('#scope-history-event').selectOption('3');
    assert.equal(await page.locator('#scope-history-captured').innerText(),'$0.00');
    assert.equal(await page.locator('#scope-history-remaining').innerText(),'$90,071,992,547,409.91');
    assert.equal(await page.locator('#scope-captured').innerText(),'$90,071,992,547,409.91');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.locator('#scope-history').screenshot({path:path.join(output,'phone-history.png')});
    await page.locator('#scope-history-latest').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#scope-history-event').inputValue(),'4');
    assert.equal(await page.locator('#scope-history-captured').innerText(),'$90,071,992,547,409.91');
    report.largeAmount={phoneWidth:390,noHorizontalOverflow:true,pendingAmount:'$90,071,992,547,409.91',latestCaptured:'$90,071,992,547,409.91'};
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
