import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeScopeWorkspace, decodeScopeWorkspace } from '../../../src/scope-workspace-record.mjs';
import { createScopeReview } from '../../../src/scope-plan.mjs';
import { createScopeReviewDocument } from '../../../src/scope-review-export.mjs';
const here = new URL('./', import.meta.url);
const digest = value => createHash('sha256').update(value).digest('hex');
const draft = {
  label: 'Harbor wayfinding — 李',
  brief: 'Compare the north and south routes.\nRetain literal <sample> text.',
  cap: '920.47',
  checkpoints: [
    { title: 'Route sketches', amount: '231.19', evidence: 'Two labeled planned alternatives' },
    { title: 'Pocket guide', amount: '517.03', evidence: 'Readable planned field guide' }
  ]
};
const review = createScopeReview(draft);
review.act('scope-1', 'approve', 'Accepted north-route evidence — ✓');
for (const action of ['order', 'request', 'lose', 'receipt', 'duplicate']) review.act('scope-1', action);
const reviewed = encodeScopeWorkspace({ draft, review, evidenceDrafts: new Map([['scope-2', 'Pending guide note\nNot an approval']]) });
const unfinished = encodeScopeWorkspace({ draft: {
  label: '  Unfinished café  ', brief: 'Literal unfinished brief\n',
  cap: 'later', checkpoints: [{ title: '  ', amount: '', evidence: 'Unfinished <evidence> & \"quote\"' }]
} });
const controls = [];
for (const [name, contents] of [['reviewed', reviewed], ['unfinished', unfinished]]) {
  const input = new URL(name + '.json', here);
  const html = createScopeReviewDocument(decodeScopeWorkspace(contents));
  await writeFile(input, contents);
  await writeFile(new URL(name + '.native.html', here), html);
  controls.push({ name, inputBytes: Buffer.byteLength(contents), inputSha256: digest(contents), htmlBytes: Buffer.byteLength(html), htmlSha256: digest(html), summary: decodeScopeWorkspace(contents).summary });
}
const missing = spawnSync(process.execPath, ['scripts/review-workspace.mjs', fileURLToPath(new URL('reviewed.json', here)), fileURLToPath(new URL('reviewed.cli.html', here))], { encoding: 'utf8' });
const packageFile = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
console.log(JSON.stringify({
  source: 'cdffd2476cae0c7332dff64677ae814b7f594947',
  node: process.version, availableScripts: packageFile.scripts, controls,
  proposedCommandBaseline: { status: missing.status, signal: missing.signal, stdout: missing.stdout, stderr: missing.stderr },
  boundary: 'The native decoder and HTML exporter are successful controls. The missing CLI is a new capability gap, not a defect in the existing browser export.'
}, null, 2));
if (missing.status === 0 || !missing.stderr.includes('MODULE_NOT_FOUND')) process.exitCode = 1;
