import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeScopeWorkspace } from './source/src/scope-workspace-record.mjs';
import { createScopeReviewDocument } from './source/src/scope-review-export.mjs';

const root = dirname(fileURLToPath(import.meta.url));
assert.match(root, /^\/dev\/integration-scope47-/);
const source = join(root, 'source');
const entry = join(source, 'scripts/review-workspace.mjs');
const outputRoot = join(root, 'independent-v2');
await mkdir(outputRoot);
const sha = b => createHash('sha256').update(b).digest('hex');
const git = b => createHash('sha1').update(Buffer.from('blob ' + b.length + '\0')).update(b).digest('hex');
const pins = JSON.parse(await readFile(join(root, 'source-pins.json'), 'utf8'));
const measured = {};
for (const [path, pin] of Object.entries(pins.files)) {
  const bytes = await readFile(join(root, path));
  assert.equal(git(bytes), pin.gitBlob, 'immutable source pin ' + path);
  measured[path] = { ...pin, bytes: bytes.length, sha256: sha(bytes) };
}
const ownInputs = ['receive-scope47-v2.mjs', 'scope-fault-inject.c'];
for (const path of ownInputs) {
  const bytes = await readFile(join(root, path));
  measured[path] = { bytes: bytes.length, sha256: sha(bytes) };
}
const compiler = spawnSync('cc', ['-shared', '-fPIC', '-O2', '-Wall', '-Wextra', '-Werror',
  '-o', join(outputRoot, 'scope-fault-inject.so'), join(root, 'scope-fault-inject.c'), '-ldl'],
  { encoding: 'utf8', env: { ...process.env, TMPDIR: root }, timeout: 15000 });
await writeFile(join(outputRoot, 'compiler.json'), JSON.stringify(compiler, null, 2) + '\n');
assert.equal(compiler.error, undefined);
assert.equal(compiler.status, 0, compiler.stderr);
const shim = join(outputRoot, 'scope-fault-inject.so');
const cases = [], artifacts = [], htmlPaths = [];
async function inspect(path) {
  try { return await lstat(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function capture(name, command, args, options = {}) {
  const result = await new Promise((accept, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root, env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
    child.stdout.setEncoding('utf8').on('data', v => { stdout += v; });
    child.stderr.setEncoding('utf8').on('data', v => { stderr += v; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', (status, signal) => {
      clearTimeout(timer); accept({ command, args, status, signal, stdout, stderr });
    });
  });
  await writeFile(join(outputRoot, name + '.stdout'), result.stdout);
  await writeFile(join(outputRoot, name + '.stderr'), result.stderr);
  assert.equal(result.signal, null, name + ' must terminate normally');
  return result;
}
async function area(name) {
  const directory = join(outputRoot, name);
  await mkdir(directory);
  await writeFile(join(directory, 'unrelated.txt'), 'reviewer sentinel: preserve exact bytes\n');
  return directory;
}
async function invariant(directory, expected) {
  assert.equal(await readFile(join(directory, 'unrelated.txt'), 'utf8'), 'reviewer sentinel: preserve exact bytes\n');
  assert.deepEqual((await readdir(directory)).sort(), ['unrelated.txt', ...expected].sort());
}
function native(bytes) {
  return Buffer.from(createScopeReviewDocument(decodeScopeWorkspace(new TextDecoder('utf-8', { fatal: true }).decode(bytes))));
}
function validate(result, inputPath, outputPath, input, output) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const workspace = decodeScopeWorkspace(new TextDecoder('utf-8', { fatal: true }).decode(input));
  const { stage, checkpoints, approved, events } = workspace.summary;
  assert.deepEqual(JSON.parse(result.stdout), {
    schema: 'scopesignal.scope-review-receipt', version: 1, fixtureOnly: true, paymentEvidence: false,
    input: { path: inputPath, bytes: input.length, sha256: sha(input) },
    output: { path: outputPath, bytes: output.length, sha256: sha(output) },
    workspace: { stage, checkpoints, approved, events }
  });
  assert.deepEqual(output, native(input), 'actual output equals unchanged native exporter bytes');
}
async function normal(name, inputPath, options = {}) {
  const directory = await area(name);
  const outputPath = join(directory, options.filename ?? 'review.html');
  const input = await readFile(inputPath);
  const result = await capture(name, options.command ?? process.execPath,
    options.args ? options.args(inputPath, outputPath) : [entry, inputPath, outputPath],
    options);
  const output = await readFile(outputPath);
  validate(result, inputPath, outputPath, input, output);
  assert.deepEqual(await readFile(inputPath), input, 'source consumed without mutation');
  await invariant(directory, [options.filename ?? 'review.html']);
  htmlPaths.push(outputPath);
  artifacts.push({ path: outputPath.slice(root.length + 1), bytes: output.length, sha256: sha(output) });
  cases.push({ name, status: 'PASS', commandStatus: result.status,
    inputSha256: sha(input), outputSha256: sha(output), workspace: JSON.parse(result.stdout).workspace });
  return output.toString('utf8');
}
let fatal = null;
try {
  const reviewed = join(root, 'inputs/reviewed.json');
  const unfinished = join(root, 'inputs/unfinished.json');
  const csv = join(root, 'inputs/current-csv.json');
  const text = await normal('reviewed-history', reviewed);
  assert.match(text, /<dt>Simulated captured \(USD\)<\/dt><dd>\$0\.00<\/dd>/);
  assert.match(text, /<dt>Current simulated capture state<\/dt><dd>unknown<\/dd>/);
  assert.match(text, /<dt>Recorded approvals<\/dt><dd>1 of 2<\/dd>/);
  assert.match(text, /Pending guide note\nNot an approval/);
  assert.equal((text.match(/<li><h3>Event /g) ?? []).length, 6);
  const draft = await normal('unfinished-draft', unfinished);
  assert.match(draft, /No amounts are totaled, and no approvals or capture outcomes are implied/);
  assert.doesNotMatch(draft, /<dt>Simulated captured/);
  const current = await normal('accepted-csv', csv);
  assert.match(current, /&lt;\/textarea&gt;&lt;img id=&quot;csv-injected&quot;/);
  assert.match(current, /=SUM\(A1:A2\)/);

  const unknownRecord = JSON.parse(await readFile(reviewed, 'utf8'));
  unknownRecord.events = unknownRecord.events.slice(0, 4);
  const unknownPath = join(root, 'inputs/unknown.json');
  await writeFile(unknownPath, JSON.stringify(unknownRecord, null, 2) + '\n');
  const unknown = await normal('unknown-capture', unknownPath);
  assert.match(unknown, /<dt>Simulated captured \(USD\)<\/dt><dd>\$0\.00<\/dd>/);
  assert.match(unknown, /<dt>Current simulated capture state<\/dt><dd>unknown<\/dd>/);
  assert.equal((unknown.match(/<li><h3>Event /g) ?? []).length, 4);

  const reconciledRecord = JSON.parse(await readFile(reviewed, 'utf8'));
  reconciledRecord.events.push({
    seq: 7, type: 'paypal.capture.reconciled', at: 'T+007',
    checkpointId: 'scope-1', captureId: 'CAP-SCOPE-1',
    outcome: 'captured', source: 'sandbox-transaction-lookup'
  });
  const reconciledPath = join(root, 'inputs/reconciled.json');
  await writeFile(reconciledPath, JSON.stringify(reconciledRecord, null, 2) + '\n');
  const reconciled = await normal('explicit-reconciliation', reconciledPath);
  assert.match(reconciled, /<dt>Simulated captured \(USD\)<\/dt><dd>\$231\.19<\/dd>/);
  assert.match(reconciled, /<dt>Current simulated capture state<\/dt><dd>captured<\/dd>/);
  assert.equal((reconciled.match(/<li><h3>Event /g) ?? []).length, 7);

  const literalDirectory = join(root, 'literal # 100% 李');
  await mkdir(literalDirectory);
  const literalInput = join(literalDirectory, '-saved.json');
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), await readFile(unfinished)]);
  await writeFile(literalInput, bom);
  await normal('literal-bom', literalInput, {
    cwd: literalDirectory, filename: '-review # 100% 李.html',
    args: (input, output) => [entry, '--', '-saved.json', output]
  });

  const npmEnv = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => key.toLowerCase() !== 'npm_config_cache'));
  npmEnv.npm_config_cache = join(outputRoot, 'npm-cache');
  await normal('package-command', csv, { command: 'npm', cwd: source, env: npmEnv,
    args: (input, output) => ['run', '--silent', 'review:workspace', '--', input, output] });

  for (const phase of ['write', 'sync', 'link', 'cleanup']) {
    const name = 'failure-' + phase;
    const directory = await area(name);
    const output = join(directory, 'review.html');
    const before = await readFile(reviewed);
    let result;
    if (phase === 'write') {
      result = await capture(name, 'bash', ['-c', 'trap "" XFSZ; ulimit -f 1; exec "$@"',
        'reviewer-limit', process.execPath, entry, reviewed, output]);
    } else {
      result = await capture(name, process.execPath, [entry, reviewed, output], {
        env: { ...process.env, LD_PRELOAD: shim, SCOPE_REVIEW_PHASE: phase,
          SCOPE_REVIEW_GUARD: directory, SCOPE_REVIEW_TARGET: output }
      });
      assert.match(result.stderr, new RegExp('SCOPE_REVIEW_INJECT phase=' + phase + ' bytes=' + native(before).length));
    }
    assert.equal(result.status, 1, phase + ': truthful failure');
    assert.equal(result.stdout, '', phase + ': no success receipt');
    assert.match(result.stderr, /Scope review failed: /);
    assert.deepEqual(await readFile(reviewed), before);
    let preservedPublished = false, leftovers = [];
    if (phase === 'cleanup') {
      assert.match(result.stderr, /Review was created, but temporary cleanup failed:/);
      const published = await readFile(output);
      assert.deepEqual(published, native(before));
      leftovers = (await readdir(directory)).filter(n => n.startsWith('.scopesignal-review-'));
      assert.equal(leftovers.length, 1);
      assert.deepEqual(await readFile(join(directory, leftovers[0], 'review.html')), published);
      const a = await lstat(output), b = await lstat(join(directory, leftovers[0], 'review.html'));
      assert.equal(a.ino, b.ino);
      assert.equal(a.dev, b.dev);
      await invariant(directory, ['review.html', ...leftovers]);
      htmlPaths.push(output);
      artifacts.push({ path: output.slice(root.length + 1), bytes: published.length, sha256: sha(published) });
      preservedPublished = true;
    } else {
      assert.equal(await inspect(output), null, phase + ': no partial destination published');
      await invariant(directory, []);
      if (phase === 'write') assert.match(result.stderr, /EFBIG|file too large/i);
    }
    cases.push({ name, status: 'PASS', commandStatus: result.status,
      actualFaultObserved: true, inputSha256: sha(before), preservedPublished, leftovers });
  }

  const raceDirectory = await area('competing-different-inputs');
  const raceOutput = join(raceDirectory, 'winner.html');
  const competitors = [reviewed, csv];
  const results = await Promise.all(competitors.map((input, i) =>
    capture('race-' + i, process.execPath, [entry, input, raceOutput])));
  assert.equal(results.filter(r => r.status === 0).length, 1);
  const winner = results.findIndex(r => r.status === 0);
  const loser = 1 - winner;
  const output = await readFile(raceOutput);
  validate(results[winner], competitors[winner], raceOutput, await readFile(competitors[winner]), output);
  assert.equal(results[loser].status, 1);
  assert.equal(results[loser].stdout, '');
  assert.match(results[loser].stderr, /Output already exists; choose a new output path/);
  await invariant(raceDirectory, ['winner.html']);
  htmlPaths.push(raceOutput);
  artifacts.push({ path: raceOutput.slice(root.length + 1), bytes: output.length, sha256: sha(output) });
  cases.push({ name: 'competing-different-inputs', status: 'PASS', commandStatuses: results.map(r => r.status),
    winnerInput: competitors[winner].slice(root.length + 1), wholeWinnerSha256: sha(output) });
} catch (e) {
  fatal = { message: e.message, stack: e.stack };
}
let unchanged = true;
for (const [path, receipt] of Object.entries(measured)) {
  const bytes = await readFile(join(root, path));
  if (sha(bytes) !== receipt.sha256) unchanged = false;
}
const receipt = {
  result: fatal || !unchanged ? 'FAIL' : 'PASS',
  repository: pins.repository, head: pins.head, tree: pins.tree, acceptedParent: pins.acceptedParent,
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  source: measured, exactPinnedInputs: Object.keys(pins.files).length, unchanged,
  cases, artifacts, htmlPaths: htmlPaths.map(p => p.slice(root.length + 1)), fatal,
  boundary: 'Independent reviewer executed the exact current command in a private local process. No full suite rerun, browser rendering, deployment, provider request or real payment. Source closure and accepted fixtures were fetched from immutable Git source; fault injection affects only child processes and private output paths.'
};
await writeFile(join(outputRoot, 'receiving.json'), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
if (receipt.result !== 'PASS') process.exitCode = 1;
