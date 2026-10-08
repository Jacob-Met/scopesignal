// Independent native browser receiver. No package installation or provider calls.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const [sourceArg, outputArg, pinArg, mode = 'candidate'] = process.argv.slice(2);
assert(sourceArg && outputArg && pinArg, 'source, new output and source-pin JSON required');
assert(['candidate', 'append-negative'].includes(mode), 'unknown receiver mode');
const source = resolve(sourceArg), output = resolve(outputArg);
const pin = JSON.parse(await readFile(pinArg, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(done => setTimeout(done, ms));
await mkdir(output, { recursive: false });
const profile = resolve(output, 'fresh-profile');
await mkdir(profile);
const records = [], downloads = [], served = {}, blocked = [], pageErrors = [];
const driverHash = hash(await readFile(new URL(import.meta.url)));
const inputHashes = {};
for (const file of ['scope.html', 'src/scope-workspace.mjs', 'src/scope-draft-removal.mjs']) {
  inputHashes[file] = hash(await readFile(resolve(source, file)));
  assert.equal(inputHashes[file], pin.files[file], `frozen product pin: ${file}`);
}
let altered = null;
if (mode === 'append-negative') {
  const text = await readFile(resolve(source, 'src/scope-draft-removal.mjs'), 'utf8');
  const needle = 'checkpoints.splice(index, 0, { ...checkpoint });';
  assert.equal(text.split(needle).length, 2, 'mutation must match one restore statement');
  altered = Buffer.from(text.replace(needle, 'checkpoints.push({ ...checkpoint });'));
  await writeFile(resolve(output, 'mutated-scope-draft-removal.mjs'), altered);
}

class Connection extends EventEmitter {
  constructor(url) {
    super();
    this.socket = new WebSocket(url);
    this.pending = new Map(); this.next = 1;
    this.ready = new Promise((done, reject) => {
      this.socket.addEventListener('open', done, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(Error(JSON.stringify(message.error)));
        else request.done(message.result || {});
      } else this.emit(message.method, message);
    });
  }
  async call(method, params = {}, sessionId) {
    await this.ready;
    return new Promise((done, reject) => {
      const id = this.next++;
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(Error(`CDP timeout: ${method}`));
      }, 10000);
      this.pending.set(id, { done, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  event(name, predicate = () => true) {
    return new Promise((done, reject) => {
      const listener = message => {
        if (!predicate(message.params)) return;
        clearTimeout(timer); this.off(name, listener); done(message.params);
      };
      const timer = setTimeout(() => { this.off(name, listener); reject(Error(`Event timeout: ${name}`)); }, 10000);
      this.on(name, listener);
    });
  }
}

const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(source, '.' + (pathname === '/' ? '/scope.html' : pathname));
    if (!path.startsWith(source + sep)) throw Error('source boundary');
    const relative = path.slice(source.length + 1).split(sep).join('/');
    let bytes = await readFile(path);
    assert.equal(hash(bytes), pin.files[relative], `unrecognized or changed served source: ${relative}`);
    if (altered && relative === 'src/scope-draft-removal.mjs') bytes = altered;
    served[relative] = hash(bytes);
    response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(bytes);
  } catch (error) {
    if (!String(error).includes('ENOENT')) pageErrors.push({ sourceError: String(error) });
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.SCOPESIGNAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const processLog = [];
const chromeProcess = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-sync', '--disable-background-networking',
  '--disable-component-update', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
chromeProcess.stdout.on('data', bytes => processLog.push(String(bytes)));
chromeProcess.stderr.on('data', bytes => processLog.push(String(bytes)));
let launchError = null, connection, browserVersion = null;
chromeProcess.on('error', error => { launchError = String(error); });
async function until(callback, caption) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = await callback();
    if (value) return value;
    await delay(25);
  }
  throw Error(`Condition timeout: ${caption}`);
}

const fixture = () => ({
  label: '  Independent <scope> λ  ', brief: 'Fictional receiver\nNo real payment or provider.', cap: '1000.00',
  checkpoints: [
    { title: 'Twin <literal>', amount: ' 010.00 ', evidence: 'FIRST proof\nretain it' },
    { title: 'Twin <literal>', amount: '020.50', evidence: '\nMIDDLE_REMOVED_PROOF\n λ 😀 &  \n' },
    { title: 'Final handoff', amount: '30.00', evidence: 'LAST proof' }
  ]
});
const readDraft = () => ({
  ...Object.fromEntries(['label', 'brief', 'cap'].map(key => [key, document.querySelector('#scope-' + key).value])),
  checkpoints: [...document.querySelectorAll('.scope-row')].map(row => Object.fromEntries(
    ['title', 'amount', 'evidence'].map(key => [key, row.querySelector('[data-field="' + key + '"]').value])))
});

async function scenario(name, action) {
  const { browserContextId } = await connection.call('Target.createBrowserContext');
  const { targetId } = await connection.call('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await connection.call('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => connection.call(method, params, sessionId);
  const evaluate = async (fn, ...args) => {
    const result = await call('Runtime.evaluate', {
      expression: `(${fn.toString()})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true
    });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  };
  const intercept = message => {
    if (message.sessionId !== sessionId) return;
    const { requestId, request } = message.params;
    const allowed = new URL(request.url).origin === origin;
    if (!allowed) blocked.push({ name, url: request.url });
    void call(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest',
      allowed ? { requestId } : { requestId, errorReason: 'BlockedByClient' }).catch(error => pageErrors.push({ name, interception: String(error) }));
  };
  const pageError = message => {
    if (message.sessionId === sessionId) pageErrors.push({ name, exception: message.params.exceptionDetails?.text });
  };
  connection.on('Fetch.requestPaused', intercept);
  connection.on('Runtime.exceptionThrown', pageError);
  const field = async (selector, value) => evaluate((selector, value) => {
    const input = document.querySelector(selector); if (!input) throw Error('missing ' + selector);
    input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
  }, selector, value);
  const click = async selector => {
    const position = await evaluate(selector => {
      const node = document.querySelector(selector);
      if (!node || node.disabled || !node.getClientRects().length) throw Error('unavailable ' + selector);
      node.scrollIntoView({ behavior: 'instant', block: 'center' });
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, selector);
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position });
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...position });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...position });
  };
  const available = () => evaluate(() => !document.querySelector('#scope-undo-remove').disabled);
  const snapshot = () => evaluate(readDraft);
  const remove = index => click('[data-remove="' + index + '"]');
  const download = async (selector, label) => {
    const directory = resolve(output, 'downloads', label); await mkdir(directory, { recursive: true });
    await connection.call('Browser.setDownloadBehavior', { behavior: 'allowAndName', browserContextId, downloadPath: directory, eventsEnabled: true });
    const beginning = connection.event('Browser.downloadWillBegin');
    const completion = connection.event('Browser.downloadProgress', e => e.state === 'completed');
    await click(selector);
    const [begun, completed] = await Promise.all([beginning, completion]);
    assert.equal(completed.guid, begun.guid);
    const path = resolve(directory, begun.guid), bytes = await readFile(path);
    downloads.push({ label, file: path.slice(output.length + 1), suggestedFilename: begun.suggestedFilename, bytes: bytes.length, sha256: hash(bytes) });
    return { path, bytes };
  };
  const open = async path => {
    const { root } = await call('DOM.getDocument', {});
    const { nodeId } = await call('DOM.querySelector', { nodeId: root.nodeId, selector: '#scope-open' });
    await call('DOM.setFileInputFiles', { nodeId, files: [path] });
    await until(() => evaluate(() => !document.querySelector('#scope-open-preview').hidden), 'file preview');
  };
  try {
    await call('Page.enable'); await call('Runtime.enable');
    await call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await call('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: origin + '/scope.html' });
    await until(() => evaluate(() => document.querySelectorAll('.scope-row').length === 3), 'three loaded rows');
    const draft = fixture();
    for (const key of ['label', 'brief', 'cap']) await field('#scope-' + key, draft[key]);
    for (const [index, row] of draft.checkpoints.entries()) {
      for (const key of ['title', 'amount', 'evidence']) await field('#draft-' + index + '-' + key, row[key]);
    }
    assert.deepEqual(await snapshot(), draft, 'receiver entered exact fixture fields');
    const observation = await action({ draft, field, click, evaluate, call, available, snapshot, remove, download, open });
    records.push({ name, passed: true, observation });
    console.log(JSON.stringify({ name, passed: true }));
  } catch (error) {
    records.push({ name, passed: false, error: String(error.stack) });
    console.log(JSON.stringify({ name, passed: false, error: String(error.message).slice(0,160) }));
  } finally {
    connection.off('Fetch.requestPaused', intercept); connection.off('Runtime.exceptionThrown', pageError);
    await connection.call('Target.disposeBrowserContext', { browserContextId });
  }
}

let harnessError = null;
try {
  const active = await until(async () => {
    if (launchError || chromeProcess.exitCode !== null) throw Error(launchError || 'Chrome exited: ' + processLog.join(''));
    try { return (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); }
    catch { return null; }
  }, 'Chrome debugging endpoint');
  connection = new Connection(`ws://127.0.0.1:${active[0]}${active[1]}`);
  browserVersion = await connection.call('Browser.getVersion');
  await scenario('restore original middle row while preserving current edits', async h => {
    await h.remove(1); assert.equal(await h.available(), true);
    await h.field('#scope-label', 'Changed scope label');
    await h.field('#scope-cap', '2000.00');
    await h.field('#draft-0-amount', ' 0012.34 ');
    await h.field('#draft-1-evidence', '\nEdited surviving last evidence\n');
    const expected = structuredClone(h.draft);
    expected.label = 'Changed scope label'; expected.cap = '2000.00';
    expected.checkpoints[0].amount = ' 0012.34 ';
    expected.checkpoints[2].evidence = '\nEdited surviving last evidence\n';
    await h.evaluate(() => document.querySelector('#scope-undo-remove').focus());
    await h.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await h.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    assert.deepEqual(await h.snapshot(), expected);
    assert.equal(await h.available(), false, 'recovery is single use');
    assert.equal(await h.evaluate(() => document.activeElement.id), 'draft-1-title');
    await h.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await h.evaluate(() => document.querySelector('#draft-1-title').scrollIntoView({ behavior: 'instant', block: 'center' }));
    const screenshot = await h.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(output, 'restored-phone.png'), Buffer.from(screenshot.data, 'base64'));
    return { expected, actual: await h.snapshot(), focus: 'draft-1-title' };
  });
  if (mode === 'candidate') {
    await scenario('second removal replaces only the latest recovery', async h => {
      await h.remove(1); await h.remove(0); await h.click('#scope-undo-remove');
      const expected = { ...h.draft, checkpoints: [h.draft.checkpoints[0], h.draft.checkpoints[2]] };
      assert.deepEqual(await h.snapshot(), expected); assert.equal(await h.available(), false);
      return { expected };
    });
    for (const [name, selector] of [['add', '#scope-add'], ['copy', '[data-duplicate="0"]'], ['move', '[data-move="down"][data-index="0"]']]) {
      await scenario('successful ' + name + ' retires prior recovery', async h => {
        await h.remove(1); assert.equal(await h.available(), true);
        await h.click(selector); assert.equal(await h.available(), false);
        return { draft: await h.snapshot() };
      });
    }
    await scenario('successful review and return to editing cannot revive recovery', async h => {
      await h.remove(1); await h.click('#scope-form button[type="submit"]');
      assert.equal(await h.evaluate(() => document.querySelector('#scope-form').hidden), true);
      await h.click('#scope-edit'); assert.equal(await h.available(), false);
      assert.equal((await h.snapshot()).checkpoints.length, 2);
      return { draft: await h.snapshot() };
    });
    await scenario('failed validation and disabled boundary movement preserve recovery', async h => {
      await h.remove(1); await h.field('#scope-cap', '1.00');
      await h.click('#scope-form button[type="submit"]');
      assert.equal(await h.evaluate(() => document.querySelector('#scope-errors').hidden), false);
      assert.equal(await h.available(), true);
      assert.equal(await h.evaluate(() => document.querySelector('[data-move="up"][data-index="0"]').disabled), true);
      await h.evaluate(() => document.querySelector('[data-move="up"][data-index="0"]').click());
      assert.equal(await h.available(), true);
      await h.click('#scope-undo-remove');
      assert.deepEqual(await h.snapshot(), { ...h.draft, cap: '1.00' });
      return { restoredInvalidDraft: await h.snapshot() };
    });
    await scenario('actual downloads and file preview preserve recovery; undo invalidates preview', async h => {
      await h.remove(1);
      const saved = await h.download('#scope-save', 'removed-workspace');
      assert.equal(await h.available(), true);
      const parsed = JSON.parse(saved.bytes.toString('utf8'));
      assert.equal(parsed.fixtureOnly, true); assert.equal(parsed.paymentEvidence, false);
      assert.equal(saved.bytes.includes(Buffer.from('MIDDLE_REMOVED_PROOF')), false);
      const report = await h.download('#scope-review-download', 'removed-review');
      assert.equal(report.bytes.includes(Buffer.from('MIDDLE_REMOVED_PROOF')), false);
      assert.equal(await h.available(), true);
      await h.open(saved.path); assert.equal(await h.available(), true);
      await h.click('#scope-undo-remove'); assert.deepEqual(await h.snapshot(), h.draft);
      assert.equal(await h.evaluate(() => document.querySelector('#scope-open-preview').hidden), true);
      return { savedWorkspaceKeys: Object.keys(parsed), previewCanceledByUndo: true };
    });
    await scenario('confirmed workspace replacement retires prior recovery', async h => {
      const saved = await h.download('#scope-save', 'replacement-workspace');
      await h.remove(1); assert.equal(await h.available(), true);
      await h.open(saved.path); assert.equal(await h.available(), true);
      await h.click('#scope-open-apply');
      assert.deepEqual(await h.snapshot(), h.draft); assert.equal(await h.available(), false);
      return { restoredByFile: true, oldRecoveryRetired: true };
    });
  }
} catch (error) { harnessError = String(error.stack); }
finally {
  if (connection) {
    try { await connection.call('Browser.close'); } catch {}
    connection.socket.close();
  } else chromeProcess.kill();
  await new Promise(done => server.close(done));
  await writeFile(resolve(output, 'chrome.log'), processLog.join(''));
  const receipt = {
    schema: 'scopesignal.independent-removal-receiving.v1', at: new Date().toISOString(),
    mode, sourceCommit: pin.commit, sourceTree: pin.tree, source, node: process.version,
    browserVersion, driverHash, inputHashes, served, mutationHash: altered && hash(altered),
    records, downloads, blocked, pageErrors, harnessError,
    allPassed: records.length > 0 && records.every(record => record.passed) && !harnessError && pageErrors.length === 0,
    bounds: ['fresh native profile', 'no sandbox-disabling flags', 'external page requests blocked', 'authored fictional fields only', 'no product source file edits']
  };
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  const manifest = [];
  for (const name of await readdir(output)) {
    if (['fresh-profile', 'downloads', 'manifest.json'].includes(name)) continue;
    const bytes = await readFile(resolve(output, name)); manifest.push({ name, bytes: bytes.length, sha256: hash(bytes) });
  }
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ mode, allPassed: receipt.allPassed, groups: records.length, failed: records.filter(x => !x.passed).map(x => x.name), pageErrors, harnessError }));
  process.exitCode = receipt.allPassed ? 0 : 1;
}
