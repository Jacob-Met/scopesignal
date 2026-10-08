import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, mkdir, symlink, link, lstat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { MAX_WORKSPACE_BYTES, encodeScopeWorkspace, decodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeReview } from '../src/scope-plan.mjs';
import { createScopeReviewDocument } from '../src/scope-review-export.mjs';

const entry = fileURLToPath(new URL('../scripts/review-workspace.mjs', import.meta.url));
const repository = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const draft = () => ({
  label: 'Festival guide — 東京',
  brief: 'Two routes.\nKeep <draft> & literal text.',
  cap: '707.31',
  checkpoints: [
    { title: 'Walking route', amount: '203.17', evidence: 'Planned route options' },
    { title: 'Printed guide', amount: '401.09', evidence: 'Planned readable guide' }
  ]
});
function reviewed() {
  const source = draft();
  const review = createScopeReview(source);
  review.act('scope-1', 'approve', 'Accepted route — ✓');
  for (const action of ['order', 'request', 'lose', 'receipt', 'duplicate']) review.act('scope-1', action);
  return encodeScopeWorkspace({ draft: source, review, evidenceDrafts: new Map([['scope-2', 'Pending guide\nnot accepted']]) });
}
function run(args, cwd = repository) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8', timeout: 8000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  return result;
}
async function area(t) {
  const path = await mkdtemp(join(tmpdir(), 'scopesignal-review-cli-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
async function absent(path) {
  await assert.rejects(lstat(path), { code: 'ENOENT' });
}
async function noTemporaryFiles(path) {
  assert.deepEqual((await readdir(path)).filter(name => name.startsWith('.scopesignal-review-')), []);
}
function refused(result) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Scope review failed: /);
}
async function optionalSymlink(t, target, path) {
  try { await symlink(target, path); return true; } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') { t.skip('This Windows account cannot create symlinks.'); return false; }
    throw error;
  }
}

test('help and usage are explicit and create no files', async t => {
  const directory = await area(t);
  const help = run(['--help'], directory);
  assert.equal(help.status, 0);
  assert.equal(help.stderr, '');
  assert.match(help.stdout, /SAVED.json NEW.html/);
  for (const args of [[], ['one'], ['one', 'two', 'three'], ['--unknown', 'out'], ['--']]) {
    const result = run(args, directory);
    assert.equal(result.status, 64);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Usage:/);
  }
  assert.deepEqual(await readdir(directory), []);
});

test('reviewed history produces byte-exact existing HTML and a measured receipt in Unicode paths', async t => {
  const directory = await area(t);
  const input = join(directory, 'saved # 100% 李.json');
  const output = join(directory, 'review # 100% 李.html');
  const source = reviewed();
  await writeFile(input, source);
  const result = run([input, output]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const bytes = await readFile(output);
  assert.deepEqual(bytes, Buffer.from(createScopeReviewDocument(decodeScopeWorkspace(source))));
  assert.equal(await readFile(input, 'utf8'), source);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    schema: 'scopesignal.scope-review-receipt', version: 1, fixtureOnly: true, paymentEvidence: false,
    input: { path: input, bytes: Buffer.byteLength(source), sha256: hash(source) },
    output: { path: output, bytes: bytes.length, sha256: hash(bytes) },
    workspace: { stage: 'review', checkpoints: 2, approved: 1, events: 6 }
  });
  const second = join(directory, 'second.html');
  assert.equal(run([input, second]).status, 0);
  assert.deepEqual(await readFile(second), bytes);
  await noTemporaryFiles(directory);
});

test('unfinished fields, a UTF-8 BOM, and literal leading-dash paths use the unchanged draft exporter', async t => {
  const directory = await area(t);
  const source = encodeScopeWorkspace({ draft: {
    label: '  café  ', brief: 'Unfinished\n', cap: 'later',
    checkpoints: [{ title: ' ', amount: '', evidence: '<unfinished> & \"quoted\"' }]
  } });
  const input = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source)]);
  await writeFile(join(directory, '-saved.json'), input);
  const result = run(['--', '-saved.json', '-review.html'], directory);
  assert.equal(result.status, 0, result.stderr);
  const output = await readFile(join(directory, '-review.html'));
  assert.deepEqual(output, Buffer.from(createScopeReviewDocument(decodeScopeWorkspace(source))));
  assert.equal(JSON.parse(result.stdout).input.sha256, hash(input));
  assert.deepEqual(JSON.parse(result.stdout).workspace, { stage: 'draft', checkpoints: 1, approved: 0, events: 0 });
  assert.deepEqual(await readFile(join(directory, '-saved.json')), input);
  await noTemporaryFiles(directory);
});

test('admission and HTML-only refusals create no output and preserve source bytes', async t => {
  const directory = await area(t);
  const forged = JSON.parse(reviewed());
  forged.events.push({ ...forged.events[0] });
  const unsupported = draft();
  unsupported.brief = 'Retain NUL\0in JSON';
  const unsupportedSource = encodeScopeWorkspace({ draft: unsupported });
  assert.equal(decodeScopeWorkspace(unsupportedSource).draft.brief, unsupported.brief);
  const samples = [
    ['malformed', Buffer.from('{')],
    ['wrong-schema', Buffer.from(JSON.stringify({ schema: 'other' }))],
    ['forged-history', Buffer.from(JSON.stringify(forged))],
    ['invalid-utf8', Buffer.from([0xc3, 0x28])],
    ['too-large', Buffer.alloc(MAX_WORKSPACE_BYTES + 1, 0x20)],
    ['html-only', Buffer.from(unsupportedSource)]
  ];
  for (const [name, bytes] of samples) await t.test(name, async () => {
    const input = join(directory, name + '.json');
    const output = join(directory, name + '.html');
    await writeFile(input, bytes);
    refused(run([input, output]));
    assert.deepEqual(await readFile(input), bytes);
    await absent(output);
    await noTemporaryFiles(directory);
  });
});

test('the exact 1 MiB input boundary is accepted and the consumed-byte hash includes JSON padding', async t => {
  const directory = await area(t);
  const source = encodeScopeWorkspace({ draft: draft() });
  const bytes = Buffer.concat([Buffer.from(source), Buffer.alloc(MAX_WORKSPACE_BYTES - Buffer.byteLength(source), 0x20)]);
  const input = join(directory, 'limit.json');
  const output = join(directory, 'limit.html');
  await writeFile(input, bytes);
  const result = run([input, output]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).input.bytes, MAX_WORKSPACE_BYTES);
  assert.equal(JSON.parse(result.stdout).input.sha256, hash(bytes));
  assert.equal(await readFile(output, 'utf8'), createScopeReviewDocument(decodeScopeWorkspace(source)));
});

test('existing output, the saved input itself, and hardlink aliases remain unchanged', async t => {
  const directory = await area(t);
  const input = join(directory, 'saved.json');
  const source = reviewed();
  await writeFile(input, source);
  const existing = join(directory, 'existing.html');
  await writeFile(existing, 'previous review\n');
  refused(run([input, existing]));
  assert.equal(await readFile(existing, 'utf8'), 'previous review\n');
  refused(run([input, input]));
  const alias = join(directory, 'alias.html');
  await link(input, alias);
  refused(run([input, alias]));
  assert.equal(await readFile(input, 'utf8'), source);
  assert.equal(await readFile(alias, 'utf8'), source);
  await noTemporaryFiles(directory);
});

test('existing and dangling destination symlinks are never followed or replaced', async t => {
  const directory = await area(t);
  const input = join(directory, 'saved.json');
  await writeFile(input, reviewed());
  for (const dangling of [false, true]) await t.test(String(dangling), async child => {
    const target = join(directory, dangling ? 'absent-target' : 'retained-target');
    if (!dangling) await writeFile(target, 'keep target');
    const output = join(directory, dangling ? 'dangling.html' : 'linked.html');
    if (!await optionalSymlink(child, target, output)) return;
    refused(run([input, output]));
    assert.equal((await lstat(output)).isSymbolicLink(), true);
    if (dangling) await absent(target);
    else assert.equal(await readFile(target, 'utf8'), 'keep target');
  });
  await noTemporaryFiles(directory);
});

test('missing and nonregular input or unusable output parents refuse before publication', async t => {
  const directory = await area(t);
  const input = join(directory, 'saved.json');
  await writeFile(input, reviewed());
  const output = join(directory, 'new.html');
  refused(run([join(directory, 'missing.json'), output]));
  refused(run([directory, output]));
  await absent(output);
  const missingParent = join(directory, 'missing-parent', 'review.html');
  refused(run([input, missingParent]));
  await absent(dirname(missingParent));
  refused(run([input, join(input, 'review.html')]));
  refused(run([input, directory]));
  assert.equal(await readFile(input, 'utf8'), reviewed());
  await noTemporaryFiles(directory);
});

test('input symlinks are explicitly refused', async t => {
  const directory = await area(t);
  const source = join(directory, 'source.json');
  const input = join(directory, 'linked.json');
  const output = join(directory, 'review.html');
  await writeFile(source, reviewed());
  if (!await optionalSymlink(t, source, input)) return;
  refused(run([input, output]));
  await absent(output);
  assert.equal(await readFile(source, 'utf8'), reviewed());
});

test('a FIFO input is refused without waiting for a writer', { skip: process.platform === 'win32' }, async t => {
  const directory = await area(t);
  const input = join(directory, 'pipe.json');
  const made = spawnSync('mkfifo', [input], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  refused(run([input, join(directory, 'review.html')]));
  await absent(join(directory, 'review.html'));
});

test('concurrent invocations publish exactly one complete review', async t => {
  const directory = await area(t);
  const input = join(directory, 'saved.json');
  const output = join(directory, 'one.html');
  const source = reviewed();
  await writeFile(input, source);
  const results = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, input, output], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('CLI publication timed out')); }, 8000);
    child.stdout.setEncoding('utf8').on('data', value => { stdout += value; });
    child.stderr.setEncoding('utf8').on('data', value => { stderr += value; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', (status, signal) => { clearTimeout(timeout); resolve({ status, signal, stdout, stderr }); });
  })));
  assert.equal(results.filter(result => result.status === 0).length, 1);
  for (const result of results.filter(result => result.status !== 0)) refused(result);
  assert.equal(await readFile(output, 'utf8'), createScopeReviewDocument(decodeScopeWorkspace(source)));
  assert.equal(await readFile(input, 'utf8'), source);
  await noTemporaryFiles(directory);
});

test('the public package command returns the same physical artifact and JSON receipt', async t => {
  const directory = await area(t);
  const input = join(directory, 'saved.json');
  const output = join(directory, 'package.html');
  const source = reviewed();
  await writeFile(input, source);
  // npm run may inherit both uppercase and lowercase cache settings. Retire
  // both spellings before supplying this test's private cache.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'npm_config_cache'));
  env.npm_config_cache = join(directory, 'npm-cache');
  const npmCli = process.env.npm_execpath ?? resolve(dirname(process.execPath),
    process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : '../lib/node_modules/npm/bin/npm-cli.js');
  const result = spawnSync(process.execPath, [npmCli, 'run', '--silent', 'review:workspace', '--', input, output], {
    cwd: repository, encoding: 'utf8', timeout: 10000, env
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).output.sha256, hash(await readFile(output)));
  assert.equal(await readFile(output, 'utf8'), createScopeReviewDocument(decodeScopeWorkspace(source)));
});
