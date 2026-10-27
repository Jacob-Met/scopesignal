import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceScript = join(root, 'scripts', 'serve.mjs');

async function started(t, script = sourceScript, cwd = root) {
  const child = spawn(process.execPath, [script], {
    cwd, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', errors = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  });
  let timer;
  try {
    const address = await Promise.race([
      new Promise((resolve, reject) => {
        const inspect = () => {
          const match = output.match(/ScopeSignal at (http:\/\/127\.0\.0\.1:\d+)/);
          if (match) resolve(match[1]);
        };
        child.stdout.on('data', inspect); inspect();
        closed.then(() => reject(new Error('Server exited before ready: ' + errors)), reject);
      }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000); }),
    ]);
    return address;
  } finally { clearTimeout(timer); }
}

async function get(origin, path, options) {
  const response = await fetch(origin + path, { ...options, signal: AbortSignal.timeout(5000) });
  return { status: response.status, type: response.headers.get('content-type'), body: Buffer.from(await response.arrayBuffer()) };
}

test('normal UI pages, stylesheet and runtime modules remain served byte-for-byte', { timeout: 20000 }, async t => {
  const origin = await started(t);
  for (const [path, file, type] of [
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/record.html', 'record.html', 'text/html; charset=utf-8'],
    ['/scope.html', 'scope.html', 'text/html; charset=utf-8'],
    ['/scope-compare.html', 'scope-compare.html', 'text/html; charset=utf-8'],
    ['/scope-csv.html', 'scope-csv.html', 'text/html; charset=utf-8'],
    ['/scope-library.html', 'scope-library.html', 'text/html; charset=utf-8'],
    ['/styles.css', 'styles.css', 'text/css; charset=utf-8'],
    ['/app.mjs', 'app.mjs', 'text/javascript; charset=utf-8'],
    ['/src/ledger.mjs', 'src/ledger.mjs', 'text/javascript; charset=utf-8'],
    ['/src/scope-workspace.mjs', 'src/scope-workspace.mjs', 'text/javascript; charset=utf-8'],
  ]) {
    const result = await get(origin, path);
    assert.equal(result.status, 200, path);
    assert.equal(result.type, type, path);
    assert.deepEqual(result.body, await readFile(join(root, file)), path);
  }
  const head = await fetch(origin + '/scope.html', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test('server never publishes git data, source/tests, unrelated files or non-read requests', { timeout: 20000 }, async t => {
  const origin = await started(t);
  for (const path of [
    '/.git/config', '/.git/HEAD', '/.gitignore', '/README.md', '/LICENSE', '/package.json',
    '/tests/ledger.test.mjs', '/scripts/serve.mjs', '/docs/authored-scope-history.md',
    '/out/result.md', '/src/../README.md', '/src/%2e%2e/README.md',
    '/src%2F..%2F.git%2Fconfig', '/%2eenv', '/does-not-exist.html',
  ]) {
    const response = await get(origin, path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body.toString(), 'Not found', path);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await get(origin, '/index.html', { method });
    assert.equal(response.status, 405, method);
  }
});

test('an isolated static root refuses files and directory symlinks leading outside its checkout', { timeout: 20000 }, async t => {
  const base = await mkdtemp(join(tmpdir(), 'scopesignal-server-admission-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const publicRoot = join(base, 'public');
  const privateRoot = join(base, 'private');
  await mkdir(join(publicRoot, 'scripts'), { recursive: true });
  await mkdir(privateRoot, { recursive: true });
  const script = join(publicRoot, 'scripts', 'serve.mjs');
  await copyFile(sourceScript, script);
  await writeFile(join(publicRoot, 'index.html'), '<p>Public test page</p>');
  await writeFile(join(privateRoot, 'secret.mjs'), 'SYNTHETIC PRIVATE FIXTURE');
  await symlink(join(privateRoot, 'secret.mjs'), join(publicRoot, 'leaked.mjs'));
  await symlink(privateRoot, join(publicRoot, 'src'));
  const origin = await started(t, script, base);
  assert.equal((await get(origin, '/')).body.toString(), '<p>Public test page</p>');
  for (const path of ['/leaked.mjs', '/src/secret.mjs']) {
    const response = await get(origin, path);
    assert.equal(response.status, 404, path);
  }
});
