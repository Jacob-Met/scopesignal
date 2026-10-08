#!/usr/bin/env node
import { constants } from 'node:fs';
import { lstat, open, mkdtemp, link, unlink, rmdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { MAX_WORKSPACE_BYTES, decodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeReviewDocument } from '../src/scope-review-export.mjs';

const usage = `Usage: node scripts/review-workspace.mjs [--] SAVED.json NEW.html

Create the existing standalone fictional scope review from a saved workspace.
Requires Node 24 or newer. Reads one regular UTF-8 file (at most 1 MiB).
NEW.html must not exist; its parent directory must already exist.
No approvals, saved workspace, payment, or browser state are changed.

Use -- before paths beginning with "-". Use --help for this message.
Success prints a JSON receipt with the exact input and output hashes.
`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function readWorkspace(path) {
  const before = await lstat(path);
  if (!before.isFile()) throw new Error('Input must be a regular file, not a directory, symlink, or device.');
  // Refuse a swapped symlink/FIFO on platforms with these open flags.
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const file = await open(path, flags);
  try {
    const current = await file.stat();
    if (!current.isFile() || current.dev !== before.dev || current.ino !== before.ino) {
      throw new Error('Input changed while opening it; choose a stable regular file.');
    }
    if (current.size > MAX_WORKSPACE_BYTES) throw new Error('Input exceeds the 1 MiB workspace limit.');
    // A bounded descriptor read also catches growth after the size observation.
    const buffer = Buffer.alloc(MAX_WORKSPACE_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > MAX_WORKSPACE_BYTES) throw new Error('Input exceeds the 1 MiB workspace limit.');
    return buffer.subarray(0, length);
  } finally {
    await file.close();
  }
}

async function publishNew(path, bytes) {
  // The private temporary directory and destination share a filesystem. link()
  // publishes the completed file exclusively, including against dangling links.
  const temporaryDirectory = await mkdtemp(join(dirname(path), '.scopesignal-review-'));
  const temporaryFile = join(temporaryDirectory, 'review.html');
  let file;
  let failure;
  let published = false;
  try {
    file = await open(temporaryFile, 'wx', 0o600);
    await file.writeFile(bytes);
    await file.sync();
    await file.close();
    file = null;
    await link(temporaryFile, path);
    published = true;
  } catch (error) {
    failure = error;
  }
  const cleanupErrors = [];
  if (file) {
    try { await file.close(); } catch (error) { cleanupErrors.push(error.message); }
  }
  try { await unlink(temporaryFile); } catch (error) {
    if (error.code !== 'ENOENT') cleanupErrors.push(error.message);
  }
  try { await rmdir(temporaryDirectory); } catch (error) {
    cleanupErrors.push(error.message);
  }
  if (failure) {
    const detail = failure.code === 'EEXIST' ? 'Output already exists; choose a new output path.' : failure.message;
    throw new Error(detail + (cleanupErrors.length ? ' Temporary cleanup failed: ' + cleanupErrors.join('; ') : ''));
  }
  if (cleanupErrors.length) {
    throw new Error((published ? 'Review was created, but ' : '') + 'temporary cleanup failed: ' + cleanupErrors.join('; '));
  }
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write(usage);
    return;
  }
  const literalPaths = args[0] === '--';
  if (literalPaths) args = args.slice(1);
  if (args.length !== 2 || args.some(path => !path || (!literalPaths && path.startsWith('-')))) {
    process.stderr.write(usage);
    process.exitCode = 64;
    return;
  }
  const [inputPath, outputPath] = args.map(path => resolve(path));
  const input = await readWorkspace(inputPath);
  const workspace = decodeScopeWorkspace(new TextDecoder('utf-8', { fatal: true }).decode(input));
  const output = Buffer.from(createScopeReviewDocument(workspace), 'utf8');
  await publishNew(outputPath, output);
  const { stage, checkpoints, approved, events } = workspace.summary;
  process.stdout.write(JSON.stringify({
    schema: 'scopesignal.scope-review-receipt', version: 1,
    fixtureOnly: true, paymentEvidence: false,
    input: { path: inputPath, bytes: input.length, sha256: sha256(input) },
    output: { path: outputPath, bytes: output.length, sha256: sha256(output) },
    workspace: { stage, checkpoints, approved, events }
  }, null, 2) + '\n');
}

main(process.argv.slice(2)).catch(error => {
  process.stderr.write('Scope review failed: ' + error.message + '\n');
  process.exitCode = 1;
});
