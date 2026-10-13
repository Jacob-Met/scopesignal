import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'scripts', 'serve.mjs');

function childServer(t, { cwd = root, port = '0' } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', value => { stdout += value; });
  child.stderr.on('data', value => { stderr += value; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  });
  const until = async (promise, message) => {
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 10000);
      })]);
    } finally { clearTimeout(timer); }
  };
  return {
    exited: () => until(exited, 'Server did not exit'),
    ready: () => until(new Promise((resolve, reject) => {
      const inspect = () => {
        const match = stdout.match(/^ScopeSignal at (http:\/\/127\.0\.0\.1:\d+)\r?$/m);
        if (match) resolve(match[1]);
      };
      child.stdout.on('data', inspect); inspect();
      exited.then(result => reject(new Error('Server exited before ready: ' + JSON.stringify(result))), reject);
    }), 'Server did not report ready'),
  };
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

test('absolute invocation serves its own project from another working directory and reports PORT=0', { timeout: 20000 }, async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'scopesignal-foreign-cwd-'));
  await writeFile(join(cwd, 'index.html'), 'Different project: this must not be served.');
  const server = childServer(t, { cwd });
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const address = await server.ready();
  assert(Number(new URL(address).port) > 0);
  for (const [path, file, mime] of [
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/scope.html', 'scope.html', 'text/html; charset=utf-8'],
    ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
    ['/src/ledger.mjs', 'src/ledger.mjs', 'text/javascript; charset=utf-8'],
  ]) {
    const { response, bytes } = await get(address + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), mime);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(bytes, await readFile(join(root, file)));
  }
  const missing = await get(address + '/missing-scope-signal-file');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.bytes.toString(), 'Not found');
});

test('a valid explicit port is honored', { timeout: 20000 }, async t => {
  const reserve = createServer();
  await new Promise((resolve, reject) => { reserve.once('error', reject); reserve.listen(0, '127.0.0.1', resolve); });
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const server = childServer(t, { port });
  assert.equal(await server.ready(), 'http://127.0.0.1:' + port);
  assert.equal((await get('http://127.0.0.1:' + port)).response.status, 200);
});

test('invalid ports fail before advertising a server', { timeout: 20000 }, async t => {
  for (const port of ['-1', '65536', '1.5', 'not-a-port']) {
    await t.test(port, async t => {
      const result = await childServer(t, { port }).exited();
      assert.equal(result.code, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /PORT must be an integer from 0 to 65535/);
    });
  }
});

test('an occupied port refuses startup without disturbing its existing listener', { timeout: 20000 }, async t => {
  const existing = createServer((req, res) => res.end('Original listener'));
  t.after(() => new Promise(resolve => existing.close(resolve)));
  await new Promise((resolve, reject) => { existing.once('error', reject); existing.listen(0, '127.0.0.1', resolve); });
  const port = existing.address().port;
  const result = await childServer(t, { port }).exited();
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ScopeSignal could not start.*EADDRINUSE/);
  const response = await get('http://127.0.0.1:' + port);
  assert.equal(response.bytes.toString(), 'Original listener');
});
