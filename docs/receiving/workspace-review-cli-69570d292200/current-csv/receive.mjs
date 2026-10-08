import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { decodeScopeWorkspace } from '../../../../src/scope-workspace-record.mjs';
import { createScopeReviewDocument } from '../../../../src/scope-review-export.mjs';
const pins = [
  {
    "path": ".github/workflows/pages.yml",
    "sha": "2fac275ab0183987bccac3ba787a133795a70016"
  },
  {
    "path": ".github/workflows/test.yml",
    "sha": "b97f2716367bb4c5ed930693e3c3e7fdc02c792e"
  },
  {
    "path": "app.mjs",
    "sha": "7398ab71912a6e5e55a1da8ccef3f8fdee82c135"
  },
  {
    "path": "fixture-timeline.css",
    "sha": "6fa3b725f49ef21346821cd8db599d0cd6728223"
  },
  {
    "path": "index.html",
    "sha": "043b57fce51f0e9571c666139a654bfc36362be0"
  },
  {
    "path": "record-view.css",
    "sha": "ad73b8678228eacdbd7ddf36d56c573b2fc34e4a"
  },
  {
    "path": "record.html",
    "sha": "5718956e264ba46e699d21e2c04d54d4ddd14b5d"
  },
  {
    "path": "scope-compare.css",
    "sha": "c1d4cbb891fec75585b222e020d63fd642db5a62"
  },
  {
    "path": "scope-compare.html",
    "sha": "746a563caa69b6db5b11c01463816b5496e3ca48"
  },
  {
    "path": "scope-history.css",
    "sha": "993ab82f32c1546d688d949b72f8312f82c432ec"
  },
  {
    "path": "scope-workspace.css",
    "sha": "be05fd582636ad9a4fbd5227fc00d8f37d3b5ded"
  },
  {
    "path": "scope.html",
    "sha": "cce5cf1081fe009831be11745952df5841e8368b"
  },
  {
    "path": "src/agents.mjs",
    "sha": "ae1141b4f45ac8a064aa684fdcf47e938daf085d"
  },
  {
    "path": "src/fixture-record.mjs",
    "sha": "5eda4b74b5067e16de9e7de1bbd8935ff69895e8"
  },
  {
    "path": "src/fixture-timeline-view.mjs",
    "sha": "780e12706ee16ebcbf87692b7a21681c4722092d"
  },
  {
    "path": "src/fixture-timeline.mjs",
    "sha": "b686daaf49b53c44a06f4be8d9ef878886acf57e"
  },
  {
    "path": "src/ledger.mjs",
    "sha": "beb94176ae3b1a2f29890c5752e47c25694f01f0"
  },
  {
    "path": "src/payment-status.mjs",
    "sha": "2c5ba31e85e41b1f62dbf1612582574ce677237e"
  },
  {
    "path": "src/record-reader.mjs",
    "sha": "e6f69a87605b9808058a4e46df6b923ebb22c9dd"
  },
  {
    "path": "src/record-view.mjs",
    "sha": "08dbca153a600bf7ff6b41fb378b86b62422925f"
  },
  {
    "path": "src/scope-compare-ui.mjs",
    "sha": "c8d4686b7986506c03ad3e76e1f739ec534bfa29"
  },
  {
    "path": "src/scope-compare.mjs",
    "sha": "f2dd4d5240131b18aa0ee86ba59dcd5a3076eb28"
  },
  {
    "path": "src/scope-comparison-export.mjs",
    "sha": "642fad5c2664b2153e2f27ebf0f50aed801d899f"
  },
  {
    "path": "src/scope-draft-removal.mjs",
    "sha": "658db4f41e44ce241b24a0fd744be0193d3fe283"
  },
  {
    "path": "src/scope-history-view.mjs",
    "sha": "93abdcd8abbbbfbee99cdb5207c10ea346d3177e"
  },
  {
    "path": "src/scope-history.mjs",
    "sha": "f34a8ca89a897e03a1a1ca1abf7d243f1a42e4b6"
  },
  {
    "path": "src/scope-plan.mjs",
    "sha": "b36d91a6bbdd3d8cd7e15dcc0550a549ac7135c8"
  },
  {
    "path": "src/scope-review-export.mjs",
    "sha": "d5e56a7a3f1608a1927bce2c08c1f787bf50e2ad"
  },
  {
    "path": "src/scope-revision-draft.mjs",
    "sha": "e94e190710a7902b816184333bb40ad2ed90bcc0"
  },
  {
    "path": "src/scope-workspace-record.mjs",
    "sha": "d9141b3e1ac74b33f996ec6d68756ece5c190162"
  },
  {
    "path": "src/scope-workspace.mjs",
    "sha": "e3dda4a14c8c3bc26d6da1a1baeb9a7f205eb12b"
  },
  {
    "path": "src/workers-ai.mjs",
    "sha": "7951c2f09b7063bd481d3391ae914d6066d2b241"
  },
  {
    "path": "styles.css",
    "sha": "31353c93740241c42551710bd12599338c017e45"
  },
  {
    "path": "tests/capture-identity-receiving.test.mjs",
    "sha": "c3fe9b9608203ea4c380bff3686636766165bc39"
  },
  {
    "path": "tests/capture-identity.test.mjs",
    "sha": "da6bb46fd523bbc4f75a423036678e11d3f6ea1e"
  },
  {
    "path": "tests/evidence-drafts.test.mjs",
    "sha": "b9c621ad8e350e1dff6febd7085b3c4c18dfafae"
  },
  {
    "path": "tests/fixture-record.test.mjs",
    "sha": "9bfd274a3d8eea072a194dad9ed58fb7ecee056c"
  },
  {
    "path": "tests/fixture-timeline.test.mjs",
    "sha": "7a21b46c09f68b73da79923c82cb628eaa79ef7c"
  },
  {
    "path": "tests/ledger.test.mjs",
    "sha": "7099cf44e492946a77ffc7d9432e568eb0b39d50"
  },
  {
    "path": "tests/payment-presentation.test.mjs",
    "sha": "8a39d57ca330195b62ab483a017490706fffe7ad"
  },
  {
    "path": "tests/record-reader.test.mjs",
    "sha": "562f7db7b2052c26f66e29601b4fca931b0a8a48"
  },
  {
    "path": "tests/recovery-current-state.test.mjs",
    "sha": "e943100360140f6739b8a67f4e5c0d6b5216b11a"
  },
  {
    "path": "tests/scope-compare.test.mjs",
    "sha": "9a819f18159b91091510370d3a33a0e660f5ef49"
  },
  {
    "path": "tests/scope-comparison-export.test.mjs",
    "sha": "af64444d190d08af72c788bb1fb1592cff4d153b"
  },
  {
    "path": "tests/scope-draft-removal.test.mjs",
    "sha": "89691157b36094678cab3a4a59b9eea911352787"
  },
  {
    "path": "tests/scope-history.test.mjs",
    "sha": "dfa2d9aa6938dbb1dd26307b2798c9310506fb8e"
  },
  {
    "path": "tests/scope-plan.test.mjs",
    "sha": "4dc7bc945f0e0728a79a26363eb276852da8334b"
  },
  {
    "path": "tests/scope-review-export.test.mjs",
    "sha": "b5b6dbcbac2ba71ac82a45d5043f65b46dbea8be"
  },
  {
    "path": "tests/scope-revision-draft.test.mjs",
    "sha": "03219dd86a781a7bd8085252533e04b1b9281919"
  },
  {
    "path": "tests/scope-workspace-record.test.mjs",
    "sha": "5606ab99933f9665634971662d41c4b5ca93ec83"
  },
  {
    "path": "tests/workers-ai-contract.test.mjs",
    "sha": "37f499d284f772a77dfe3702f02e5c01fc7391ec"
  },
  {
    "path": "tests/workspace-form-values.test.mjs",
    "sha": "961c7ff3c9a58ec1418aede8b0f50194cfcadbbc"
  },
  {
    "path": "scope-csv.css",
    "sha": "ead1550b73fbace9a31bf6828e32cd805effc2a0"
  },
  {
    "path": "scope-csv.html",
    "sha": "3503c05f9ee702ea62a7d16cf811d3fc9c0c7c93"
  },
  {
    "path": "src/scope-checkpoint-csv-ui.mjs",
    "sha": "b6bd27ee3b1c975ba9491ade683fb8be5e372267"
  },
  {
    "path": "src/scope-checkpoint-csv.mjs",
    "sha": "f75c6d49cd1d118f8418c63b6dab7132f9ead169"
  },
  {
    "path": "tests/scope-checkpoint-csv.test.mjs",
    "sha": "11dbc16eb431d8c8c7e3ca3c9666f4b42d5f3d88"
  }
];
const sha = data => createHash('sha256').update(data).digest('hex');
for (const pin of pins) {
  const bytes = await readFile(pin.path);
  const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  assert.equal(blob, pin.sha, pin.path);
}
const source = await readFile(new URL('source-workspace.json', import.meta.url));
const original = await readFile('docs/receiving/checkpoint-csv-cf5799f6d38b/downloads/literal-draft.json');
assert.deepEqual(source, original);
const workspace = decodeScopeWorkspace(new TextDecoder('utf-8', { fatal: true }).decode(source));
const expected = Buffer.from(createScopeReviewDocument(workspace));
const output = await readFile(new URL('scope-review.html', import.meta.url));
const receipt = JSON.parse(await readFile(new URL('command-receipt.json', import.meta.url), 'utf8'));
assert.deepEqual(output, expected);
assert.equal(receipt.input.sha256, sha(source));
assert.equal(receipt.output.sha256, sha(output));
assert.deepEqual(receipt.workspace, { stage: 'draft', checkpoints: 2, approved: 0, events: 0 });
console.log(JSON.stringify({
  result: 'PASS',
  acceptedParent: '5bbb52087aa3c5b33d1694887ff3d1380b826e5e',
  acceptedTree: '7bf94d8851045d5619f21c2ef6881c1714149e5c',
  unchangedCurrentInputs: pins.length,
  sourceBlob: 'fd57d5ad7be3113c9db60cdeb7754e98ed53a06c',
  inputBytes: source.length, inputSha256: sha(source),
  outputBytes: output.length, outputSha256: sha(output),
  equalsExistingNativeExport: true,
  preservedRawAmounts: workspace.draft.checkpoints.map(row => row.amount),
  boundary: 'Actual native command consumes the accepted CSV owner’s real saved artifact. No browser flow or provider action executed.'
}, null, 2));
