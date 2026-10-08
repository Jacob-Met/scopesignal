// Optional actual-browser receiving. Reuses installed Puppeteer and Chromium;
// all project files are served unchanged from an isolated source directory.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, stat, copyFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.SCOPESIGNAL_PUPPETEER || 'puppeteer');
const root = resolve(process.env.SCOPESIGNAL_SOURCE || '.');
const out = resolve(process.env.SCOPESIGNAL_EVIDENCE || 'out/checkpoint-csv');
const profile = resolve(out, 'fresh-profile');
const downloadDirectory = resolve(out, 'browser-downloads');
const fixtures = resolve(out, 'fixtures');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { encodeScopeWorkspace, decodeScopeWorkspace } = await import(pathToFileURL(resolve(root, 'src/scope-workspace-record.mjs')));
const inputManifest = process.env.SCOPESIGNAL_SOURCE_MANIFEST
  ? JSON.parse(await readFile(process.env.SCOPESIGNAL_SOURCE_MANIFEST, 'utf8')) : null;
const paths = inputManifest?.files.map(file => file.path) || [
  'scope-csv.html', 'scope-csv.css', 'src/scope-checkpoint-csv.mjs', 'src/scope-checkpoint-csv-ui.mjs',
  'scope.html', 'src/scope-workspace.mjs', 'src/scope-workspace-record.mjs', 'src/scope-plan.mjs', 'src/ledger.mjs'
];
async function pinSource() {
  return Object.fromEntries(await Promise.all(paths.map(async path => {
    const file = resolve(root, path), bytes = await readFile(file), info = await stat(file);
    return [path, { sha256: sha(bytes), bytes: bytes.length, mode: info.mode & 0o111 ? '100755' : '100644' }];
  })));
}
const sourceBefore = await pinSource();
if (inputManifest) for (const file of inputManifest.files) {
  assert.equal(sourceBefore[file.path].sha256, file.sha256, file.path);
  assert.equal(sourceBefore[file.path].mode, file.mode, file.path);
}
try { await stat(profile); throw new Error('Use a new receiver output/profile directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(out, { recursive: true });
await mkdir(downloadDirectory, { recursive: true });
await mkdir(fixtures, { recursive: true });
const checks = [], failures = [], pageErrors = [], externalRequests = [], served = {}, downloads = [];
const types = { '.html':'text/html;charset=utf-8', '.mjs':'text/javascript;charset=utf-8', '.css':'text/css;charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const file = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!file.startsWith(root + sep)) throw new Error('Outside source');
    const bytes = await readFile(file); served[file.slice(root.length + 1)] = sha(bytes);
    response.writeHead(200, { 'content-type':types[extname(file)] || 'application/octet-stream', 'cache-control':'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const csv = rows => '\uFEFFdeliverable,amount,evidence\r\n' + rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
const details = {label:'  Launch & 雪  ',brief:'A fictional project\nwith exact spacing  ',cap:'100.00'};
const rowsA = [
  ['Poster, first pass', ' 040.00 ', '\nProof "A"\n</textarea><img id="csv-injected" src="https://invalid.test/x" onerror="globalThis.csvInjected=true">  '],
  ['=SUM(A1:A2)', '60', 'Final handoff\twith literal whitespace']
];
const draftA = {...details, checkpoints:rowsA.map(([title,amount,evidence]) => ({title,amount,evidence}))};
const pathsByName = {};
async function fixture(name, contents) {
  const path = resolve(fixtures, name); await writeFile(path, contents); pathsByName[name] = { path, sha256:sha(await readFile(path)) }; return path;
}
const fileA = await fixture('checkpoint-A.csv', csv(rowsA));
const fileB = await fixture('checkpoint-B.csv', csv([['Different row','1.00','Other evidence']]));
const incomplete = await fixture('unfinished.csv', csv([['Unfinished amount','=SUM(A1:A2)','Planned proof']]));
const malformed = await fixture('unclosed-quote.csv', 'deliverable,amount,evidence\n"Unclosed,1,E');
const carriage = await fixture('embedded-CR.csv', csv([['CR evidence','1','A\r\nB']]));
const oversized = await fixture('too-large.csv', Buffer.alloc(1024 * 1024 + 1, 65));
const injectionState = page => page.evaluate(() => ({node:Boolean(document.querySelector('#csv-injected')),flag:Boolean(globalThis.csvInjected)}));
let browser, page, author, browserVersion = null, client;
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(predicate, message, milliseconds = 10000) {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > milliseconds) throw new Error(message);
    await sleep(30);
  }
}
async function check(name, run) {
  console.log('START ' + name); const started = performance.now();
  await run(); checks.push({name,result:'pass',milliseconds:Math.round(performance.now()-started)}); console.log('PASS ' + name);
}
async function click(target, selector) {
  await target.bringToFront();
  await target.click(selector);
}
async function choose(target, selector, file) {
  const waiting = target.waitForFileChooser(); await click(target, selector); const chooser = await waiting; await chooser.accept([file]);
}
async function fill(target, selector, value) {
  await click(target, selector);
  await target.keyboard.down('Control'); await target.keyboard.press('KeyA'); await target.keyboard.up('Control');
  await target.keyboard.press('Backspace'); await target.keyboard.type(value);
}
async function values(target) {
  return target.evaluate(() => ({
    label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,
    checkpoints:[...document.querySelectorAll('.scope-row')].map((row,index) => ({
      title:document.querySelector('#draft-'+index+'-title').value,amount:document.querySelector('#draft-'+index+'-amount').value,
      evidence:document.querySelector('#draft-'+index+'-evidence').value
    }))
  }));
}
async function download(target, selector, name) {
  const count = downloads.length; await click(target, selector);
  await until(() => downloads.length > count, 'No actual browser download event');
  const item = downloads[count];
  await until(() => item.state === 'completed' || item.state === 'canceled', 'Browser download did not finish');
  assert.equal(item.state, 'completed');
  const original = resolve(downloadDirectory, item.guid), destination = resolve(out, name);
  const bytes = await readFile(original); await copyFile(original, destination);
  item.receivingPath = destination; item.bytes = bytes.length; item.sha256 = sha(bytes);
  return {bytes,path:destination,item};
}
async function previewCsv(file, metadata = details) {
  await choose(page, '#csv-file', file);
  await fill(page, '#csv-label', metadata.label); await fill(page, '#csv-brief', metadata.brief); await fill(page, '#csv-cap', metadata.cap);
  await click(page, '#csv-review');
  await page.waitForFunction(() => !document.querySelector('#csv-preview').hidden);
}
async function nativeOpen(file) {
  const before = await values(author);
  await choose(author, '#scope-open', file);
  await author.waitForFunction(() => !document.querySelector('#scope-open-preview').hidden);
  assert.deepEqual(await values(author), before);
  await click(author, '#scope-open-apply');
}
async function holdNextRead(fileName) {
  await page.evaluate(name => {
    const original = File.prototype.arrayBuffer;
    globalThis.csvReadHeld = false;
    let release;
    const gate = new Promise(done => {release=done;});
    globalThis.csvReleaseRead = () => {File.prototype.arrayBuffer=original;release();};
    File.prototype.arrayBuffer = async function(...args) {
      const genuine = await Reflect.apply(original,this,args);
      if(this.name===name){globalThis.csvReadHeld=true;await gate;}
      return genuine;
    };
  }, fileName);
}
try {
  browser = await puppeteer.launch({headless:true,userDataDir:profile,
    ...(process.env.SCOPESIGNAL_CHROME ? {executablePath:process.env.SCOPESIGNAL_CHROME} : {}),
    args:['--disk-cache-size=1048576','--disable-background-networking'],timeout:30000});
  browserVersion = await browser.version();
  client = await browser.target().createCDPSession();
  await client.send('Browser.setDownloadBehavior', {behavior:'allowAndName',downloadPath:downloadDirectory,eventsEnabled:true});
  client.on('Browser.downloadWillBegin', item => downloads.push({...item,state:'started'}));
  client.on('Browser.downloadProgress', event => {
    const item=downloads.find(item=>item.guid===event.guid);if(item)Object.assign(item,event);
  });
  async function freshPage() {
    const next=await browser.newPage();next.setDefaultTimeout(10000);await next.setViewport({width:1360,height:1000});
    next.on('pageerror',error=>pageErrors.push(String(error)));
    await next.setRequestInterception(true);
    next.on('request',request=>{
      const url=request.url();
      if(url.startsWith('blob:')||new URL(url).origin===origin)return void request.continue();
      externalRequests.push(url);void request.abort();
    });
    return next;
  }
  page=await freshPage();author=await freshPage();
  await page.goto(origin+'/scope-csv.html',{waitUntil:'networkidle0'});
  await author.goto(origin+'/scope.html',{waitUntil:'networkidle0'});
  const initialAuthor=await values(author);
  await check('review requires an explicit CSV choice and starts no download',async()=>{
    await click(page, '#csv-review');
    await page.waitForFunction(()=>!document.querySelector('#csv-errors').hidden);
    assert.match(await page.$eval('#csv-errors',n=>n.textContent),/Choose a checkpoint CSV/);
    assert.equal(await page.$eval('#csv-download',n=>n.disabled),true);
    assert.equal(downloads.length,0);
    assert.deepEqual(await values(author),initialAuthor);
  });
  await check('literal CSV review downloads a native draft and the real workspace imports it explicitly',async()=>{
    await previewCsv(fileA);
    assert.equal(await page.$eval('#csv-preview-label',n=>n.textContent),details.label);
    assert.equal(await page.$eval('#csv-preview-brief',n=>n.textContent),details.brief);
    const visible=await page.$$eval('#csv-preview-rows tr',rows=>rows.map(row=>[...row.querySelectorAll('td')].map(cell=>cell.textContent)));
    assert.deepEqual(visible,rowsA);
    assert.deepEqual(await injectionState(page),{node:false,flag:false});
    assert.equal(downloads.length,0);
    assert.deepEqual(await values(author),initialAuthor);
    const result=await download(page,'#csv-download','literal-draft.json');
    assert.equal(result.item.suggestedFilename,'scopesignal-checkpoint-draft-v1.json');
    assert.equal(result.bytes.toString('utf8'),encodeScopeWorkspace({draft:draftA}));
    assert.deepEqual(decodeScopeWorkspace(result.bytes.toString('utf8')).draft,draftA);
    await nativeOpen(result.path);assert.deepEqual(await values(author),draftA);
    await click(author, '#scope-form button[type="submit"]');
    await author.waitForFunction(()=>!document.querySelector('#scope-review').hidden);
    assert.equal(await author.$eval('#scope-event-count',n=>n.textContent),'0 events');
    assert.equal(await author.$eval('#scope-approved',n=>n.textContent),'0 / 2');
    assert.deepEqual(await injectionState(author),{node:false,flag:false});
    await click(author, '#scope-edit');
    await page.screenshot({path:resolve(out,'desktop-reviewed-literal-draft.png'),fullPage:true});
  });
  await check('unfinished formula amounts stay literal and the ordinary workspace still refuses scope review',async()=>{
    await previewCsv(incomplete);
    assert.match(await page.$eval('#csv-budget',n=>n.textContent),/unfinished/);
    const result=await download(page,'#csv-download','unfinished-draft.json');
    const record=JSON.parse(result.bytes.toString('utf8'));
    assert.equal(record.draft.checkpoints[0].amount,'=SUM(A1:A2)');
    assert.equal(record.stage,'draft');assert.deepEqual(record.events,[]);assert.deepEqual(record.evidenceDrafts,[]);
    await nativeOpen(result.path);await click(author, '#scope-form button[type="submit"]');
    assert.equal(await author.$eval('#scope-form',n=>n.hidden),false);
    assert.equal(await author.$eval('#scope-review',n=>n.hidden),true);
    assert.match(await author.$eval('#scope-errors',n=>n.textContent),/positive USD amount/);
    assert.equal((await values(author)).checkpoints[0].amount,'=SUM(A1:A2)');
  });
  await check('metadata changes and cancel retire genuine in-flight file reads',async()=>{
    for(const mode of ['metadata','cancel']){
      await choose(page,'#csv-file',fileA);await holdNextRead('checkpoint-A.csv');await click(page, '#csv-review');
      await page.waitForFunction(()=>globalThis.csvReadHeld===true);
      if(mode==='metadata')await fill(page,'#csv-cap','200.00');else await click(page, '#csv-cancel');
      await page.evaluate(()=>globalThis.csvReleaseRead());
      await page.waitForFunction(()=>document.querySelector('#csv-preview').hidden&&document.querySelector('#csv-download').disabled);
      await sleep(80);
      assert.equal(await page.$eval('#csv-preview',n=>n.hidden),true);
      assert.equal(await page.$eval('#csv-download',n=>n.disabled),true);
      assert.equal(await page.$eval('#csv-review',n=>n.disabled),false);
    }
    await choose(page,'#csv-file',fileA);await holdNextRead('checkpoint-A.csv');await click(page, '#csv-review');
    await page.waitForFunction(()=>globalThis.csvReadHeld===true);
    await choose(page,'#csv-file',fileB);await click(page, '#csv-review');
    await page.waitForFunction(()=>!document.querySelector('#csv-preview').hidden);
    await page.evaluate(()=>globalThis.csvReleaseRead());await sleep(80);
    assert.equal(await page.$eval('#csv-preview-rows td[data-field="title"]',n=>n.textContent),'Different row');
    const result=await download(page,'#csv-download','newest-file-draft.json');
    assert.equal(JSON.parse(result.bytes).draft.checkpoints[0].title,'Different row');
  });
  await check('malformed, embedded-CR and oversized files refuse without exporting a prefix or changing another workspace',async()=>{
    const before=await values(author), count=downloads.length;
    for(const [file,pattern]of [[malformed,/unclosed quoted field/],[carriage,/LF line breaks/],[oversized,/no larger than 1 MiB/]]){
      await choose(page,'#csv-file',file);await click(page, '#csv-review');
      await page.waitForFunction(()=>!document.querySelector('#csv-errors').hidden);
      assert.match(await page.$eval('#csv-errors',n=>n.textContent),pattern);
      assert.equal(await page.$eval('#csv-preview',n=>n.hidden),true);
      assert.equal(await page.$eval('#csv-download',n=>n.disabled),true);
      assert.deepEqual(await values(author),before);
      assert.equal(downloads.length,count);
    }
  });
  await check('download preparation failure preserves the reviewed bytes for an explicit retry',async()=>{
    await previewCsv(fileA);
    await page.evaluate(()=>{globalThis.csvOriginalObjectUrl=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('receiver preparation failure');};});
    const count=downloads.length;await click(page, '#csv-download');
    assert.match(await page.$eval('#csv-status',n=>n.textContent),/could not start/);
    assert.equal(await page.$eval('#csv-download',n=>n.disabled),false);assert.equal(downloads.length,count);
    await page.evaluate(()=>{URL.createObjectURL=globalThis.csvOriginalObjectUrl;});
    const result=await download(page,'#csv-download','retry-draft.json');
    assert.equal(result.bytes.toString('utf8'),encodeScopeWorkspace({draft:draftA}));
  });
  await check('phone layout, keyboard download and unchanged storage remain usable',async()=>{
    await page.setViewport({width:390,height:844});
    const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert(size.scroll<=size.width+1,JSON.stringify(size));
    await page.focus('#csv-download');
    const count=downloads.length;await page.keyboard.press('Enter');
    await until(()=>downloads.length>count&&downloads[count].state==='completed','Keyboard download did not finish');
    assert.equal(downloads[count].suggestedFilename,'scopesignal-checkpoint-draft-v1.json');
    await page.screenshot({path:resolve(out,'phone-reviewed-draft.png'),fullPage:true});
    assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
    assert.deepEqual(pageErrors,[]);
    assert.equal(externalRequests.filter(url=>!url.startsWith('https://fonts.googleapis.com/css2?')).length,0);
  });
}catch(error){failures.push({after:checks.at(-1)?.name||null,error:String(error.stack||error)});console.error(error.stack||error);}
finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
  const sourceAfter=await pinSource();assert.deepEqual(sourceAfter,sourceBefore);
  const receipt={schema:'scopesignal.checkpoint-csv-browser.v1',at:new Date().toISOString(),source:root,tree:inputManifest?.tree||null,
    node:process.version,browser:browserVersion,checks,failures,pageErrors,externalRequests,
    request_note:'Only the unchanged authoring stylesheet requested its existing external font; it was blocked. The converter uses local assets only.',
    controlled_holds:'Late-read controls hold genuine File.arrayBuffer results; they do not replace their bytes. Object-URL failure is receiving-only and restored for retry.',
    served,downloads,fixtures:pathsByName,sourceBefore,sourceAfter,passed:failures.length===0};
  await writeFile(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({passed:receipt.passed,checks:checks.length,failures:failures.length,out}));
}
if(failures.length)process.exitCode=1;
