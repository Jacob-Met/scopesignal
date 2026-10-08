import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [sourceArg, outputArg, mode = 'candidate'] = process.argv.slice(2);
const source = path.resolve(sourceArg), output = path.resolve(outputArg);
if (!['baseline', 'candidate'].includes(mode)) throw new Error('Use baseline or candidate.');
if (fs.existsSync(output)) throw new Error('Choose a new receiving output directory.');
if (fs.statfsSync(path.dirname(output)).bavail * fs.statfsSync(path.dirname(output)).bsize < 768 * 1024 ** 2 || os.freemem() < 1536 * 1024 ** 2) throw new Error('Insufficient receiving capacity.');
fs.mkdirSync(output);
const profile = path.join(output, 'profile'), downloads = path.join(output, 'downloads');
fs.mkdirSync(downloads);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const sourceFiles = ['scope.html', 'styles.css', 'scope-workspace.css', ...fs.readdirSync(path.join(source, 'src')).filter(f => f.endsWith('.mjs')).map(f => 'src/' + f)];
const sourcePins = Object.fromEntries(sourceFiles.map(f => [f, sha(fs.readFileSync(path.join(source, f)))]));
const results = [], pageErrors = [], blocked = [], served = {};
let chrome, socket, server, sequence = 0;
const pending = new Map();
const waitFor = async (probe, label, timeout = 12000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { try { const value = await probe(); if (value) return value; } catch (error) { if (!/context|Cannot read properties/.test(String(error))) throw error; } await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error('Timed out: ' + label);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 15000);
  pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
  return reply.result.value;
};
const check = async (name, fn) => { try { const detail = await fn(); results.push({ name, pass: true, detail }); } catch (error) { results.push({ name, pass: false, error: String(error.stack || error) }); throw error; } };
const readDraft = () => evaluate(`({label:document.querySelector('#scope-label').value,brief:document.querySelector('#scope-brief').value,cap:document.querySelector('#scope-cap').value,checkpoints:[...document.querySelectorAll('.scope-row')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(f=>[f.dataset.field,f.value])))})`);
const fill = async (selector, value) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await send('Input.insertText', { text: value });
};
const click = async selector => {
  const p = await evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||e.closest('[hidden]'))throw Error('Control unavailable');e.scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p });
};
let origin, navigation = 0;
const fresh = async () => { const url = origin + '/scope.html?receiving=' + (++navigation); await send('Page.navigate', { url }); await waitFor(() => evaluate(`location.href===${JSON.stringify(url)} && document.readyState==='complete' && document.querySelectorAll('.scope-row').length===3 && !!document.querySelector('#draft-2-title')`), 'draft startup'); };
const loadFile = async file => { const doc = await send('DOM.getDocument'); const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#scope-open' }); await send('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [file] }); };
const undoEnabled = () => evaluate(`!!document.querySelector('#scope-undo-remove') && !document.querySelector('#scope-undo-remove').disabled`);
const keyboardUndo = async (key = 'Enter') => {
  await evaluate(`document.querySelector('#scope-undo-remove').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key === 'Enter' ? 'Enter' : 'Space', windowsVirtualKeyCode: key === 'Enter' ? 13 : 32, text: key === 'Enter' ? '\r' : ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key === 'Enter' ? 'Enter' : 'Space', windowsVirtualKeyCode: key === 'Enter' ? 13 : 32 });
};
try {
  server = http.createServer((req, res) => {
    let relative;
    try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, ''); } catch { res.writeHead(400).end(); return; }
    const filename = path.resolve(source, relative || 'scope.html');
    if (!filename.startsWith(source + path.sep)) { res.writeHead(403).end(); return; }
    try { const bytes = fs.readFileSync(filename); served[relative] = sha(bytes); res.setHeader('Content-Type', filename.endsWith('.mjs') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html'); res.end(bytes); } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  const chromePath = process.env.SCOPESIGNAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErrors = '';
  chrome.stderr.on('data', bytes => { chromeErrors = (chromeErrors + bytes).slice(-20000); });
  chrome.on('error', error => { chromeErrors += String(error); });
  const activePort = path.join(profile, 'DevToolsActivePort');
  await waitFor(() => fs.existsSync(activePort), 'Chrome debugging endpoint');
  const port = fs.readFileSync(activePort, 'utf8').split(/\r?\n/)[0];
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', async event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const p = pending.get(msg.id); if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); } return; }
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      if (request.url.startsWith(origin + '/')) await send('Fetch.continueRequest', { requestId });
      else { blocked.push(request.url); await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); }
    }
  });
  for (const method of ['Page.enable', 'Runtime.enable', 'DOM.enable']) await send(method);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const version = await send('Browser.getVersion');

  let savedReview;
  const readHistory = () => evaluate("({hidden:document.querySelector('#scope-history').hidden,rows:[...document.querySelectorAll('.scope-history-checkpoint')].map(c=>({heading:c.querySelector('h4').textContent,planned:c.querySelector('dd').textContent})),position:document.querySelector('#scope-history-position').textContent,approved:document.querySelector('#scope-history-approved').textContent})");
  const save = async name => {
    const dir=path.join(downloads,name); fs.mkdirSync(dir);
    await send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
    await click('#scope-save');
    const file=path.join(dir,'scopesignal-workspace-v1.json');
    await waitFor(()=>fs.existsSync(file),'download '+name);
    return file;
  };
  await check('edited review evidence survives removal recovery and history rebuild',async()=>{
    await fresh();
    await fill('#draft-1-title','Independent restored middle row');
    await click('#scope-form button[type="submit"]');
    await fill('.scope-review-card:nth-child(2) .scope-evidence','LATEST pending review evidence <&> 🧭');
    await click('#scope-edit');
    let h=await readHistory();
    assert.equal(h.hidden,true,'history must be hidden after editing');
    assert.equal(h.rows.length,0,'history cards must be cleared after editing');
    const before=await readDraft();
    assert.equal(before.checkpoints[1].evidence,'LATEST pending review evidence <&> 🧭');
    await click('[data-remove="1"]');
    await fill('#draft-1-title','Survivor edited after removal');
    const removed=await readDraft();
    await click('#scope-undo-remove');
    const restored=await readDraft();
    assert.deepEqual(restored.checkpoints,[removed.checkpoints[0],before.checkpoints[1],removed.checkpoints[1]]);
    assert.equal((await readHistory()).rows.length,0,'undo must not resurrect stale review history');
    await click('#scope-form button[type="submit"]');
    h=await readHistory();
    assert.equal(h.hidden,false);assert.equal(h.rows.length,3);assert.equal(h.position,'Before the first event');
    assert.match(h.rows[1].heading,/Independent restored middle row/);
    assert.equal(h.rows[1].planned,before.checkpoints[1].evidence);
    assert.match(h.rows[2].heading,/Survivor edited after removal/);
    assert.equal(await undoEnabled(),false);
    savedReview=await save('restored-review');
    return {history:h,draft:restored,download:savedReview};
  });
  await check('explicit review replacement retires undo and navigation/new decisions preserve current evidence',async()=>{
    await fresh();await click('[data-remove="1"]');assert.equal(await undoEnabled(),true);
    await loadFile(savedReview);
    await waitFor(()=>evaluate("!document.querySelector('#scope-open-preview').hidden"),'review replacement preview');
    assert.equal(await undoEnabled(),true);
    await click('#scope-open-apply');
    assert.equal(await undoEnabled(),false);
    assert.equal(await evaluate("document.querySelector('#scope-form').hidden"),true);
    assert.match((await readHistory()).rows[1].heading,/Independent restored middle row/);
    await fill('.scope-review-card:nth-child(1) .scope-evidence','Accepted after restored replacement');
    await click('.scope-review-card:nth-child(1) [data-action="approve"]');
    await fill('.scope-review-card:nth-child(3) .scope-evidence','Current unapproved evidence must survive navigation');
    const beforeFile=await save('before-navigation'),beforeBytes=fs.readFileSync(beforeFile);
    await click('#scope-history > summary');await click('#scope-history-previous');
    assert.equal((await readHistory()).approved,'0 / 3');
    await click('.scope-review-card:nth-child(1) [data-action="order"]');
    assert.equal((await readHistory()).position,'After event 2 of 2','new decision refreshes history to latest');
    assert.equal(await evaluate("document.querySelector('.scope-review-card:nth-child(3) .scope-evidence').value"),'Current unapproved evidence must survive navigation');
    await click('#scope-history-previous');await click('#scope-history-latest');
    assert.equal(await undoEnabled(),false);
    const afterFile=await save('after-new-decision');
    const before=JSON.parse(beforeBytes),after=JSON.parse(fs.readFileSync(afterFile,'utf8'));
    assert.equal(await evaluate("document.querySelector('#scope-event-count').textContent"),'2 events');
    return {beforeDownload:beforeFile,afterDownload:afterFile,pendingEvidencePreserved:true,latestPosition:(await readHistory()).position};
  });
  assert.deepEqual(pageErrors, []);
  for (const [filename, expected] of Object.entries(sourcePins)) assert.equal(sha(fs.readFileSync(path.join(source, filename))), expected, filename);
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify({ mode, source, runtime: process.version, browser: version.product, results, sourcePins, served, blocked, pageErrors }, null, 2) + '\n');
  console.log(JSON.stringify({ mode, passed: results.filter(r => r.pass).length, receipt: path.join(output, 'receipt.json'), browser: version.product }));
} catch (error) {
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ mode, source, results, pageErrors, blocked, sourcePins, error: String(error.stack || error) }, null, 2) + '\n');
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  if (chrome && chrome.exitCode === null) await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (chrome && chrome.exitCode === null) chrome.kill();
  server?.close();
}
