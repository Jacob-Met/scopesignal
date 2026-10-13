import {
  constants, openSync, closeSync, fstatSync, readSync, writeSync,
  mkdtempSync, writeFileSync, linkSync, rmSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { MAX_RECORD_BYTES, readFixtureRecord } from '../src/record-reader.mjs';
import { createRecordReviewDocument } from '../src/record-review-export.mjs';

const usage = 'Usage: node scripts/review-record.mjs SAVED.json NEW.html\n'
  + '       node scripts/review-record.mjs --help\n\n'
  + 'Create a standalone HTML review of one saved fixed-fixture record.\n'
  + 'Node 24+; UTF-8 input up to 1 MiB; output must not exist.\n'
  + 'Use ./ for a filename beginning with -. No stdin or authored-workspace input.\n'
  + 'The review is synthetic fixture data, not payment evidence.\n';

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (written === 0) throw new Error('Output delivery made no progress.');
    offset += written;
  }
}

function readRecordBytes(path) {
  // Opening nonblocking permits rejecting a FIFO before waiting for a writer.
  // Admission and the byte bound apply to this acquired descriptor.
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('Input must be a regular file.');
    if (stat.size > MAX_RECORD_BYTES) throw new Error('Input exceeds the 1 MiB limit.');
    const bytes = Buffer.alloc(MAX_RECORD_BYTES + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, null);
      if (read === 0) break;
      count += read;
    }
    if (count > MAX_RECORD_BYTES) throw new Error('Input exceeds the 1 MiB limit.');
    return bytes.subarray(0, count);
  } finally {
    closeSync(fd);
  }
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let publishedPath;
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    writeAll(1, Buffer.from(usage));
  } else {
    if (args.length !== 2 || args.some(value => !value || value.startsWith('-'))) {
      throw new Error('Expected SAVED.json and a new HTML path. Use --help for usage.');
    }
    const [input, output] = args.map(value => resolve(value));
    const inputBytes = readRecordBytes(input);
    // Match the saved-record viewer: fatal UTF-8, consuming one leading BOM.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(inputBytes);
    const record = readFixtureRecord(text);
    const html = Buffer.from(createRecordReviewDocument(record, basename(input)));
    const receipt = {
      format: 'scopesignal.record-review-cli.v1',
      input, output,
      inputBytes: inputBytes.length, outputBytes: html.length,
      inputSha256: digest(inputBytes), outputSha256: digest(html),
      eventCount: record.events.length,
      fixtureOnly: true, paymentEvidence: false,
    };

    // Publish complete bytes exclusively on the destination filesystem.
    // The private stage is the only path this command ever removes.
    const stage = mkdtempSync(join(dirname(output), '.scopesignal-record-review-'));
    try {
      const stagedFile = join(stage, 'review.html');
      writeFileSync(stagedFile, html, { flag: 'wx', mode: 0o600 });
      linkSync(stagedFile, output);
      publishedPath = output;
    } finally {
      rmSync(stage, { recursive: true });
    }
    writeAll(1, Buffer.from(JSON.stringify(receipt) + '\n'));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const retained = publishedPath
    ? ' Complete output was created at ' + JSON.stringify(publishedPath) + '; keep or inspect that file.'
    : '';
  try {
    writeAll(2, Buffer.from('record-review: ' + JSON.stringify(message) + retained + '\n'));
  } catch {
    // A failed diagnostic stream must still leave a failing exit status.
  }
  process.exitCode = 2;
}
