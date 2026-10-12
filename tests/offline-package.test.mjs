import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const builder = join(root, 'scripts', 'package-offline.mjs');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (script, args = [], options = {}) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', ...options });

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'scopesignal-package-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('package includes all current pages and exact source bytes; repeated builds are deterministic', async t => {
  const temp = await directory(t);
  const out = join(temp, 'review with spaces');
  const result = run(builder, ['--out', out, '--source-ref', 'fixture-source']);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(join(out, 'MANIFEST.json'), 'utf8'));
  assert.deepEqual(manifest.pages, ['index.html', 'record.html', 'scope-compare.html', 'scope-csv.html', 'scope-library.html', 'scope.html']);
  for (const file of manifest.files) {
    const actual = await readFile(join(out, file.path));
    assert.equal(actual.length, file.bytes);
    assert.equal(sha256(actual), file.sha256);
    if (file.origin === 'source') assert.deepEqual(actual, await readFile(join(root, file.path)));
  }
  assert.equal(run(join(out, 'verify-package.mjs'), [], { cwd: temp }).status, 0);
  const next = join(temp, 'repeat');
  assert.equal(run(builder, ['--out', next, '--source-ref', 'fixture-source']).status, 0);
  assert.deepEqual(await readFile(join(next, 'MANIFEST.json')), await readFile(join(out, 'MANIFEST.json')));
});

test('existing destination and destinations inside source are refused without replacement', async t => {
  const temp = await directory(t);
  const out = join(temp, 'existing');
  await mkdir(out);
  await writeFile(join(out, 'keep.txt'), 'retained');
  assert.notEqual(run(builder, ['--out', out, '--source-ref', 'fixture-source']).status, 0);
  assert.deepEqual(await readdir(out), ['keep.txt']);
  assert.equal(await readFile(join(out, 'keep.txt'), 'utf8'), 'retained');
  assert.notEqual(run(builder, ['--out', root, '--source-ref', 'fixture-source']).status, 0);
});

test('unadmitted external stylesheet leaves the requested destination absent', async t => {
  const temp = await directory(t);
  const source = join(temp, 'source');
  await mkdir(source);
  for (const path of ['scripts/package-offline.mjs', 'scripts/serve.mjs', 'README.md', 'docs/authored-scope-history.md', 'LICENSE', 'package.json', 'index.html', 'src']) {
    await mkdir(dirname(join(source, path)), { recursive: true });
    await cp(join(root, path), join(source, path), { recursive: true });
  }
  await writeFile(join(source, 'styles.css'), '@import url("https://example.invalid/font.css");\n');
  const out = join(temp, 'refused');
  const result = run(join(source, 'scripts/package-offline.mjs'), ['--out', out, '--source-ref', 'fixture-source']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /External stylesheet/);
  assert.ok(!(await readdir(temp)).includes('refused'));
});

test('verifier rejects changed, missing and additional package files', async t => {
  const temp = await directory(t);
  const out = join(temp, 'review');
  assert.equal(run(builder, ['--out', out, '--source-ref', 'fixture-source']).status, 0);
  const verify = () => run(join(out, 'verify-package.mjs'));
  const before = await readFile(join(out, 'index.html'));
  await writeFile(join(out, 'index.html'), 'changed');
  assert.notEqual(verify().status, 0);
  await writeFile(join(out, 'index.html'), before);
  await writeFile(join(out, 'unlisted.txt'), 'extra');
  assert.notEqual(verify().status, 0);
  await rm(join(out, 'unlisted.txt'));
  await rm(join(out, 'scope.html'));
  assert.notEqual(verify().status, 0);
});

test('ordinary launcher serves package bytes from a foreign cwd and refuses invalid ports', async t => {
  const temp = await directory(t);
  const out = join(temp, 'review');
  assert.equal(run(builder, ['--out', out, '--source-ref', 'fixture-source']).status, 0);
  const launcher = join(out, 'start-scopesignal.mjs');
  for (const port of ['0', '-1', '65536', '3.5', 'abc', '']) assert.notEqual(run(launcher, [], { cwd: temp, env: { ...process.env, PORT: port } }).status, 0);
  await writeFile(join(temp, 'index.html'), 'foreign cwd decoy');
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, [launcher], { cwd: temp, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; });
  const deadline = Date.now() + 10000;
  while (!stdout.includes(`http://127.0.0.1:${port}`)) {
    assert.equal(child.exitCode, null, stderr);
    assert.ok(Date.now() < deadline, `launcher did not become ready: ${stderr}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  for (const path of ['index.html', 'scope.html', 'record.html', 'scope-csv.html', 'scope-compare.html', 'scope-library.html', 'src/ledger.mjs']) {
    const response = await fetch(`http://127.0.0.1:${port}/${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(join(out, path)));
  }
});
