// Executes the untouched HTTP-fetched public snapshot after direct Mac Chrome
// navigation proved unavailable. The receipt keeps that limitation explicit.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output=resolve(process.argv[2]);
const mode=process.argv[3]||'baseline';
assert(['baseline','release'].includes(mode));
const source=resolve(output,'public-source');
const fetched=JSON.parse(await readFile(resolve(output,'public-fetch-receipt.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=new Map();
for(const [file,a] of Object.entries(fetched.fetchAssets)) {
  const bytes=await readFile(resolve(source,file));
  assert.equal(hash(bytes),a.sha256,file+' equals HTTP-fetched bytes');
  files.set(file,bytes);
}
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer((req,res)=>{
  const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  const bytes=files.get(file);
  if(!bytes){res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const result={schema:'scopesignal.public-draft-receiving.v1',mode,startedAt:new Date().toISOString(),sourceCommit:fetched.sourceCommit,publicUrl:fetched.publicUrl,publicFetchAt:fetched.startedAt,executionUrl:origin,livePublicPageInteraction:false,sourceSha256:Object.fromEntries(Object.entries(fetched.fetchAssets).map(([p,a])=>[p,a.sha256])),browserSha256:{},pageErrors:[],blockedRequests:[],states:{},limitations:['Direct native Mac Chrome navigation to the public URL timed out before rendering.','This actual browser interaction executes untouched, hash-verified public response bytes from an owned loopback origin.','Synthetic fixture only; no payment, provider, credential or customer-data operations.','Third-party font requests blocked; screenshots show fallback fonts.']};
let browser;
const responseTasks=[];
try {
  browser=await chromium.launch({executablePath:'/workspace/scratch/a4a1879c582f/t95-receiving/browser/chromium',headless:true});
  result.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();result.blockedRequests.push(route.request().url());return route.abort()});
  const page=await context.newPage();
  page.on('pageerror',e=>result.pageErrors.push(e.message));
  page.on('response',response=>{
    const u=new URL(response.url());
    if(u.origin!==origin)return;
    const name=decodeURIComponent(u.pathname).slice(1)||'index.html';
    if(files.has(name))responseTasks.push(response.body().then(b=>{assert.equal(hash(b),fetched.fetchAssets[name].sha256);result.browserSha256[name]=hash(b)}));
  });
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.locator('#evidence-handoff').waitFor();
  await page.evaluate(()=>{globalThis.receivingInputs=[];for(const type of ['input','click'])document.addEventListener(type,e=>{if(e.target.closest('#workspace'))globalThis.receivingInputs.push({type:e.type,trusted:e.isTrusted,target:e.target.id||e.target.dataset.id||e.target.tagName})},true)});
  const snapshot=()=>page.evaluate(()=>({draft:document.querySelector('#evidence-handoff').value,accepted:document.querySelector('#evidence-accessibility').value,acceptedReadonly:document.querySelector('#evidence-accessibility').readOnly,approved:document.querySelector('#approved').innerText,events:document.querySelector('#ledger-count').innerText,captured:document.querySelector('#captured').innerText,inputs:globalThis.receivingInputs}));
  result.states.initial=await snapshot();
  const draft='\n\nDraft </textarea><img id="injected-evidence" src=x onerror="globalThis.injectedEvidence=true"> & “quoted” 😀\n';
  await page.locator('#evidence-handoff').fill(draft);
  await page.locator('#evidence-accessibility').fill('  Human reviewed\naccessibility evidence  ');
  result.states.beforeApproval=await snapshot();
  assert.equal(result.states.beforeApproval.draft,draft);
  await page.locator('.checkpoints').screenshot({path:resolve(output,mode+'-before-approval.png')});
  await page.locator('.approve[data-id="accessibility"]').click();
  result.states.afterApproval=await snapshot();
  await page.locator('.checkpoints').screenshot({path:resolve(output,mode+'-after-approval.png')});
  const after=result.states.afterApproval;
  assert.equal(after.approved,'2 / 3');assert.equal(after.events,'8 events');assert.equal(after.captured,'$400.00');
  if(mode==='baseline'){
    assert.equal(after.draft,result.states.initial.draft);assert.notEqual(after.draft,draft);
  }else{
    assert.equal(after.draft,draft);assert.equal(after.accepted,'Human reviewed\naccessibility evidence');
    assert.equal(after.acceptedReadonly,true);
    assert.equal(await page.locator('.suggest[data-id="accessibility"]').isDisabled(),true);
    assert.deepEqual(await page.locator('#ledger-body tr').evaluateAll(rows=>rows.slice(4,7).map(r=>r.lastElementChild.innerText)),['webhook received','duplicate ignored','reconciled · counted once']);
  }
  assert(after.inputs.some(e=>e.type==='input'&&e.trusted));assert(after.inputs.some(e=>e.type==='click'&&e.trusted&&e.target==='accessibility'));
  assert.equal(await page.locator('#injected-evidence').count(),0);
  await Promise.all(responseTasks);
  for(const file of fetched.requiredBrowserAssets||files.keys())assert(result.browserSha256[file],file+' loaded in actual browser');
  assert.deepEqual(result.pageErrors,[]);
  assert(result.blockedRequests.every(url=>new URL(url).hostname==='fonts.googleapis.com'));
  result.baselineReproduced=mode==='baseline';result.publicBytesRepairVerified=mode==='release';result.passed=true;
  await context.close();
} catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1}
finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  result.completedAt=new Date().toISOString();
  await mkdir(output,{recursive:true});
  await writeFile(resolve(output,'browser-receipt.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:result.passed,baselineReproduced:result.baselineReproduced,sourceCommit:result.sourceCommit,browser:result.browser,assets:Object.keys(result.browserSha256).length,states:result.states,failure:result.failure,limitations:result.limitations},null,2));
}

