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
const hostedRequests = new Map(), hostedBodies = {}, bodyReads = [];
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
  origin = 'https://jacobmetoyer.com/scopesignal';
  const expectedHosted = JSON.parse(fs.readFileSync(path.join(source, '..', 'current-receiving-08b4d1c', 'browser', 'receipt.json'), 'utf8')).served;
  for (const [filename, expected] of Object.entries(expectedHosted)) { const response = await fetch(origin + '/' + filename + '?receiving=64f1024', {cache:'no-store'}); assert.equal(response.status, 200, filename); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(sha(bytes), expected, 'Hosted HTTP source ' + filename); served[filename] = sha(bytes); }
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
    if (msg.method === 'Network.responseReceived') { const url = msg.params.response.url; if (url.startsWith(origin + '/')) { const filename = new URL(url).pathname.slice(new URL(origin).pathname.length + 1); if (Object.hasOwn(expectedHosted, filename)) hostedRequests.set(msg.params.requestId, filename); } }
    if (msg.method === 'Network.loadingFinished' && hostedRequests.has(msg.params.requestId)) { const filename = hostedRequests.get(msg.params.requestId); bodyReads.push(send('Network.getResponseBody', {requestId:msg.params.requestId}).then(r => { const b = Buffer.from(r.body, r.base64Encoded ? 'base64' : 'utf8'); assert.equal(sha(b), expectedHosted[filename], 'Rendered source ' + filename); hostedBodies[filename] = sha(b); }).catch(e => pageErrors.push(String(e)))); }
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      if (request.url.startsWith(origin + '/')) await send('Fetch.continueRequest', { requestId });
      else { blocked.push(request.url); await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); }
    }
  });
  for (const method of ['Page.enable', 'Runtime.enable', 'DOM.enable', 'Network.enable']) await send(method);
  await send('Network.setCacheDisabled', {cacheDisabled:true});
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const version = await send('Browser.getVersion');
  await fresh();
  await check('filled middle-row removal preserves surviving rows', async () => {
    await fill('#draft-1-title', '  Removed <draft> 🧭  ');
    await fill('#draft-1-amount', 'unfinished');
    await fill('#draft-1-evidence', 'first line\n<literal>& evidence');
    const before = await readDraft();
    await click('[data-remove="1"]');
    const after = await readDraft();
    assert.deepEqual(after, { ...before, checkpoints: [before.checkpoints[0], before.checkpoints[2]] });
    if (mode === 'baseline') { assert.equal(await evaluate(`document.querySelectorAll('#scope-undo-remove').length`), 0); return { missingRecoveryControl: true, removed: before.checkpoints[1], remaining: after }; }
    assert.equal(await undoEnabled(), true);
    await fill('#scope-brief', 'Later project edit');
    await fill('#draft-1-evidence', 'Later surviving row edit');
    const edited = await readDraft();
    await keyboardUndo();
    const restored = await readDraft();
    assert.deepEqual(restored, { ...edited, checkpoints: [edited.checkpoints[0], before.checkpoints[1], edited.checkpoints[1]] });
    assert.equal(await undoEnabled(), false);
    assert.equal(await evaluate('document.activeElement.id'), 'draft-1-title');
    return { exactRawRestoration: true, laterEditsPreserved: true, singleUse: true };
  });

    await check('current authored history follows restored rows and retires on draft editing', async () => {
      await fresh(); const before = await readDraft();
      await click('[data-remove="1"]'); await click('#scope-undo-remove');
      await click('#scope-form button[type="submit"]');
      assert.equal(await evaluate("document.querySelector('#scope-history').hidden"), false);
      assert.equal(await evaluate("document.querySelectorAll('.scope-history-checkpoint').length"), 3);
      assert.equal(await evaluate("document.querySelector('#scope-history-position').textContent"), 'Before the first event');
      assert.equal(await undoEnabled(), false);
      await click('#scope-edit');
      assert.equal(await evaluate("document.querySelector('#scope-history').hidden"), true);
      assert.equal(await evaluate("document.querySelectorAll('.scope-history-checkpoint').length"), 0);
      assert.deepEqual(await readDraft(), before);
      await click('[data-remove="1"]'); await click('#scope-form button[type="submit"]');
      assert.equal(await evaluate("document.querySelectorAll('.scope-history-checkpoint').length"), 2);
      assert.equal(await undoEnabled(), false);
      await click('#scope-edit'); await click('[data-remove="0"]'); await click('#scope-undo-remove');
      assert.equal(await evaluate("document.querySelector('#scope-history').hidden"), true);
      return { restoredReviewRows: 3, removedReviewRows: 2, staleHistoryCleared: true };
    });
    await check('history navigation after undo preserves recorded decisions and current pending evidence', async () => {
      await fresh(); await click('[data-remove="1"]'); await click('#scope-undo-remove');
      await click('#scope-form button[type="submit"]');
      await fill('.scope-review-card:first-child .scope-evidence', 'Exact accepted evidence <history> 🧭');
      await click('.scope-review-card:first-child [data-action="approve"]');
      await fill('.scope-review-card:nth-child(2) .scope-evidence', 'Unapproved pending edit stays current');
      const readCurrent = () => evaluate("({events:document.querySelector('#scope-event-body').textContent,approved:document.querySelector('#scope-approved').textContent,captured:document.querySelector('#scope-captured').textContent,evidence:[...document.querySelectorAll('.scope-review-card .scope-evidence')].map(e=>({value:e.value,readOnly:e.readOnly}))})");
      const before = await readCurrent();
      const saveCurrent = async name => {
        const dir = path.join(downloads, name); fs.mkdirSync(dir);
        await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
        await click('#scope-save'); const file = path.join(dir, 'scopesignal-workspace-v1.json');
        await waitFor(() => fs.existsSync(file), name + ' download'); return fs.readFileSync(file);
      };
      const savedBefore = await saveCurrent('history-before');
      await click('#scope-history > summary'); await click('#scope-history-previous');
      assert.equal(await evaluate("document.querySelector('#scope-history-approved').textContent"), '0 / 3');
      assert.equal(await evaluate("document.querySelector('#scope-history-position').textContent"), 'Before the first event');
      assert.deepEqual(await readCurrent(), before);
      await click('#scope-history-latest');
      assert.equal(await evaluate("document.querySelector('#scope-history-approved').textContent"), '1 / 3');
      assert.equal(await evaluate("document.querySelector('.scope-history-accepted').textContent"), 'Exact accepted evidence <history> 🧭');
      assert.deepEqual(await readCurrent(), before);
      assert.deepEqual(await saveCurrent('history-after'), savedBefore);
      assert.equal(await undoEnabled(), false);
      return { navigationPreservedCurrent: true, identicalActualDownloads: 2 };
    });

  await Promise.all(bodyReads);
  assert.deepEqual(Object.keys(hostedBodies).sort(), Object.keys(expectedHosted).sort());
  const screen = await send('Page.captureScreenshot', {format:'png', captureBeyondViewport:false});
  fs.writeFileSync(path.join(output,'hosted-history.png'),Buffer.from(screen.data,'base64'));
  assert.deepEqual(pageErrors, []);
  for (const [filename, expected] of Object.entries(sourcePins)) assert.equal(sha(fs.readFileSync(path.join(source, filename))), expected, filename);
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify({ mode, source, hostedUrl: origin, qualifiedSource: "08b4d1cc4656efcb12880bc1f970aa1dfed1d930", runtime: process.version, browser: version.product, results, sourcePins, served, hostedBodies, blocked, pageErrors }, null, 2) + '\n');
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
