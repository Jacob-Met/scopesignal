import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync,
  mkdirSync, linkSync, symlinkSync, lstatSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createLedger, replayFixture } from '../src/ledger.mjs';
import { createFixtureRecord, serializeFixtureRecord } from '../src/fixture-record.mjs';
import { MAX_RECORD_BYTES, MAX_RECORD_EVENTS, readFixtureRecord } from '../src/record-reader.mjs';
import { createRecordReviewDocument } from '../src/record-review-export.mjs';

const cli = fileURLToPath(new URL('../scripts/review-record.mjs', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'record review cli '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function run(root, args, extra = []) {
  const result = spawnSync(process.execPath, [...extra, cli, ...args], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}
function refused(result) {
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^record-review: "/);
  assert(!result.stderr.includes('\n    at '));
}
function stages(root) {
  return readdirSync(root).filter(name => name.startsWith('.scopesignal-record-review-'));
}
function success(root, input, output) {
  const before = readFileSync(join(root, input));
  const result = run(root, [input, output]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  const expected = Buffer.from(createRecordReviewDocument(
    readFixtureRecord(new TextDecoder('utf-8', { fatal: true }).decode(before)), basename(input)));
  assert.deepEqual(readFileSync(join(root, output)), expected);
  assert.deepEqual(report, {
    format: 'scopesignal.record-review-cli.v1',
    input: resolve(root, input), output: resolve(root, output),
    inputBytes: before.length, outputBytes: expected.length,
    inputSha256: sha(before), outputSha256: sha(expected),
    eventCount: readFixtureRecord(new TextDecoder().decode(before)).events.length,
    fixtureOnly: true, paymentEvidence: false,
  });
  assert.equal(result.stdout, JSON.stringify(report) + '\n');
  assert.deepEqual(readFileSync(join(root, input)), before);
  assert.deepEqual(stages(root), []);
  return expected;
}

test('all recovery prefixes produce exact existing HTML and complete byte receipts', t => {
  const root = fixture(t);
  const events = replayFixture().events;
  for (let count = 0; count <= events.length; count++) {
    const input = 'prefix-' + count + '.json';
    writeFileSync(join(root, input), serializeFixtureRecord(events.slice(0, count)));
    const first = success(root, input, count + '-first.html');
    assert.deepEqual(success(root, input, count + '-second.html'), first);
  }
});

test('BOM, Unicode, carriage returns and literal filename/evidence survive the native renderer', t => {
  const root = fixture(t);
  const ledger = createLedger();
  ledger.append('checkpoint.approved', {
    checkpointId: 'journey', approver: 'human-reviewer',
    acceptedEvidence: '  Café 😀\n\r\n\t\u0080 <b>literal</b> & "quote"  ',
  });
  const input = 'record & <label>\nCafé.json';
  writeFileSync(join(root, input), '\ufeff' + serializeFixtureRecord(ledger.events));
  const html = success(root, input, 'review.html').toString();
  assert(html.includes('&#13;'));
  assert(html.includes('&lt;b&gt;literal&lt;/b&gt;'));
  assert(!html.includes('<b>literal</b>'));
});

test('the raw byte ceiling is inclusive, including BOM bytes and a growth sentinel', t => {
  const root = fixture(t);
  const ordinary = serializeFixtureRecord([]);
  const exact = Buffer.from(ordinary + ' '.repeat(MAX_RECORD_BYTES - Buffer.byteLength(ordinary)));
  writeFileSync(join(root, 'exact.json'), exact);
  success(root, 'exact.json', 'exact.html');
  writeFileSync(join(root, 'bom.json'), Buffer.concat([Buffer.from('\ufeff'), exact.subarray(0, exact.length - 3)]));
  success(root, 'bom.json', 'bom.html');
  writeFileSync(join(root, 'over.json'), Buffer.concat([exact, Buffer.from(' ')]));
  refused(run(root, ['over.json', 'over.html']));
  // Controlled descriptor-stat seam: an acquired file grows after its size check.
  const preload = join(root, 'small-stat.mjs');
  writeFileSync(preload, "import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';"
    + "const original=fs.fstatSync;fs.fstatSync=(...args)=>{const stat=original(...args);stat.size=0;return stat};syncBuiltinESMExports();");
  refused(run(root, ['over.json', 'grown.html'], ['--import', preload]));
  assert(!readdirSync(root).includes('over.html'));
  assert(!readdirSync(root).includes('grown.html'));
  assert.deepEqual(stages(root), []);
});

test('native 512-event admission retains every duplicate and refuses event 513', t => {
  const root = fixture(t);
  const ledger = replayFixture();
  while (ledger.events.length < MAX_RECORD_EVENTS) ledger.recordWebhook('journey', 'WH-EVT-FIXTURE-001', 'CAP-FIXTURE-001');
  writeFileSync(join(root, 'full.json'), serializeFixtureRecord(ledger.events));
  success(root, 'full.json', 'full.html');
  ledger.recordWebhook('journey', 'WH-EVT-FIXTURE-001', 'CAP-FIXTURE-001');
  writeFileSync(join(root, 'extra.json'), serializeFixtureRecord(ledger.events));
  refused(run(root, ['extra.json', 'extra.html']));
  assert(!readdirSync(root).includes('extra.html'));
});

test('malformed bytes, late facts and unsupported records refuse before an artifact exists', t => {
  const root = fixture(t);
  const base = createFixtureRecord(replayFixture().events);
  const changes = [
    record => { record.events.at(-1).captureId = 'CHANGED'; },
    record => { record.summary.captured = 80000; },
    record => { record.version = 2; },
    record => { record.paymentEvidence = true; },
  ];
  const inputs = [Buffer.from([0xc3, 0x28]), Buffer.from('{'), Buffer.from('null')];
  for (const change of changes) {
    const record = structuredClone(base);
    change(record);
    inputs.push(Buffer.from(JSON.stringify(record)));
  }
  for (const [index, input] of inputs.entries()) {
    writeFileSync(join(root, 'bad.json'), input);
    refused(run(root, ['bad.json', 'bad-' + index + '.html']));
    assert.deepEqual(readFileSync(join(root, 'bad.json')), input);
  }
  assert.deepEqual(readdirSync(root), ['bad.json']);
});

test('HTML-only text refusal preserves an otherwise admitted JSON record', t => {
  const root = fixture(t);
  for (const value of ['kept\0text', 'kept\ud800text']) {
    const ledger = createLedger();
    ledger.append('checkpoint.approved', { checkpointId: 'journey', approver: 'human-reviewer', acceptedEvidence: value });
    const bytes = Buffer.from(serializeFixtureRecord(ledger.events));
    readFixtureRecord(bytes.toString());
    writeFileSync(join(root, 'original.json'), bytes);
    refused(run(root, ['original.json', 'refused.html']));
    assert.deepEqual(readFileSync(join(root, 'original.json')), bytes);
    assert.deepEqual(readdirSync(root), ['original.json']);
  }
});

test('occupied paths, aliases and absent parents keep input and previous outputs exact', t => {
  const root = fixture(t);
  const bytes = Buffer.from(serializeFixtureRecord([]));
  writeFileSync(join(root, 'input.json'), bytes);
  writeFileSync(join(root, 'occupied.html'), 'keep existing');
  mkdirSync(join(root, 'directory'));
  linkSync(join(root, 'input.json'), join(root, 'hardlink.html'));
  if (process.platform !== 'win32') {
    symlinkSync('input.json', join(root, 'symlink.html'));
    symlinkSync('missing-target', join(root, 'dangling.html'));
  }
  const outputs = ['input.json', 'occupied.html', 'directory', 'hardlink.html', 'missing/parent.html'];
  if (process.platform !== 'win32') outputs.push('symlink.html', 'dangling.html');
  const names = readdirSync(root);
  for (const output of outputs) {
    refused(run(root, ['input.json', output]));
    assert.deepEqual(readFileSync(join(root, 'input.json')), bytes);
    assert.equal(readFileSync(join(root, 'occupied.html'), 'utf8'), 'keep existing');
    assert.deepEqual(readdirSync(root), names);
  }
  if (process.platform !== 'win32') assert(lstatSync(join(root, 'dangling.html')).isSymbolicLink());
});

test('nonregular and missing input refuse promptly, with argument checking before file work', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'directory'));
  for (const input of ['directory', 'missing.json']) refused(run(root, [input, 'new.html']));
  if (process.platform !== 'win32') {
    const fifo = spawnSync('mkfifo', [join(root, 'pipe')], { encoding: 'utf8' });
    assert.equal(fifo.status, 0, fifo.stderr);
    refused(run(root, ['pipe', 'new.html']));
  }
  for (const args of [[], ['input'], ['input', 'out', 'extra'], ['', 'out'], ['-', 'out'], ['--unknown', 'out'], ['--help', 'out']]) {
    refused(run(root, args));
  }
  const help = run(root, ['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage:/);
  assert.equal(help.stderr, '');
  assert(!readdirSync(root).includes('new.html'));
  assert.deepEqual(stages(root), []);
});

test('two actual publishers cannot replace one another at the same destination', async t => {
  const root = fixture(t);
  const input = Buffer.from(serializeFixtureRecord(replayFixture().events));
  writeFileSync(join(root, 'input.json'), input);
  const invoke = () => new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cli, 'input.json', 'shared.html'], { cwd: root });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status, signal) => resolveResult({ status, signal, stdout, stderr }));
  });
  const results = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(results.map(value => value.status).sort(), [0, 2]);
  const winner = results.find(value => value.status === 0);
  assert.equal(JSON.parse(winner.stdout).outputSha256, sha(readFileSync(join(root, 'shared.html'))));
  refused(results.find(value => value.status === 2));
  assert.deepEqual(readFileSync(join(root, 'input.json')), input);
  assert.deepEqual(stages(root), []);
});

test('controlled write, cleanup and receipt faults distinguish unpublished from retained output', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'input.json'), serializeFixtureRecord([]));
  const cases = [
    ['stage', "const orig=fs.writeFileSync;fs.writeFileSync=(path,...args)=>{if(String(path).includes('.scopesignal-record-review-'))throw Error('stage write refused');return orig(path,...args)};", false],
    ['cleanup', "const orig=fs.rmSync;fs.rmSync=(path,...args)=>{if(String(path).includes('.scopesignal-record-review-'))throw Error('stage cleanup refused');return orig(path,...args)};", true],
    ['receipt', "const orig=fs.writeSync;fs.writeSync=(fd,...args)=>{if(fd===1)throw Error('receipt delivery refused');return orig(fd,...args)};", true],
  ];
  for (const [name, fault, published] of cases) {
    const preload = join(root, name + '.mjs');
    writeFileSync(preload, "import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';" + fault + 'syncBuiltinESMExports();');
    const output = name + '.html';
    const result = run(root, ['input.json', output], ['--import', preload]);
    refused(result);
    assert.equal(readdirSync(root).includes(output), published);
    assert.equal(result.stderr.includes('Complete output was created at'), published);
    if (published) {
      const expected = createRecordReviewDocument(readFixtureRecord(readFileSync(join(root, 'input.json'), 'utf8')), 'input.json');
      assert.equal(readFileSync(join(root, output), 'utf8'), expected);
    }
    for (const stage of stages(root)) rmSync(join(root, stage), { recursive: true });
  }
});
