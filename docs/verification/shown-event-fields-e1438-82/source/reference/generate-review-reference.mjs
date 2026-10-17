import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFixtureRecord } from './source/src/record-reader.mjs';
import { createRecordReviewDocument } from './source/src/record-review-export.mjs';

// One bounded reference generation, separate from any actual browser download.
const fixture = await readFile(new URL('./examples/shown-events.fixture.json', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (fixture.length !== 3520 || sha(fixture) !== '8639e3ac91311f7b3d50082bc7424a605f7d83fbc49b1a40b7916399cda6e942') throw new Error('Fixture changed');
const record = readFixtureRecord(fixture.toString('utf8'));
const output = Buffer.from(createRecordReviewDocument(record, 'shown-events.fixture.json'), 'utf8');
const directory = new URL('./reference-v1/', import.meta.url);
await mkdir(directory);
const target = new URL('scopesignal-record-review.html', directory);
await writeFile(target, output, { flag: 'wx' });
const reread = await readFile(target);
if (!reread.equals(output)) throw new Error('Reference whole-byte readback mismatch');
process.stdout.write(JSON.stringify({ schema: 'scopesignal.shown-disclosures.export-reference/1',
  filename: 'shown-events.fixture.json', output: fileURLToPath(target), bytes: output.length, sha256: sha(output),
  qualification: 'Generated once by the unchanged maintained exporter from the admitted manual eight-event fixture; this is expected reference data, not an actual browser download.' }) + '\n');
