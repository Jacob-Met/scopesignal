# Native receiving handoff: equal checkpoint amounts

ScopeSignal issue48 is implemented and locally source/native-qualified, but its pull-request/browser/merge gates are held under Jacob's no-GitHub-Actions directive. This is custody for an existing native Node/Chrome worker, not deployment or authorization to change serving source, install software, trigger Actions or merge.

## Exact source

- Original healthy/missing-action checkout: 5bbb52087aa3c5b33d1694887ff3d1380b826e5e.
- Candidate receiving parent: 226d6d90cb949ce3d6edf97b99153831bd95e8fb, tree19bc2c9589f78fdd82c8345475be2d39f46b8fb0.
- Overlay: publication-packet.zip,96,245bytes, SHA256 d26163268431adf960a66551561cbadf07d11bf6b87288c7b91dc59b1061211f, Git blobff4bb1328cdc5c18e688536b2e38cc17bfb0744d. It contains exactly21 repository-relative files. Every mode/content digest is in publication-manifest.json.gz; the archive has been extracted in memory and all21 members read back exactly.
- Browser driver: scripts/check-scope-allocation.mjs, Git997bf0e4255ea4b3af5004aa812cf3c7dc295ebe, SHA256 a1cd5f37658a853ebacea1aa2ab96da291f45b22ca3854a00d16dbfe745e9d2f. It is unexecuted. The source-reviewed successor adds only full intended-input equality; all previous input injection/assertions remain. Its original unexecuted version is preserved in author/original-evidence.zip.
- Fresh default observed during custody audit is6f17ea30fe8659dc4ae47cae6cb3a8e32c1d2508/tree245c0dd6. It is not substituted for the fixed receiving parent above. Any later integration requires its own complete current-parent proof.

## Use existing native tools and isolated source

Use an already installed Node24+ and Chrome/Chromium executable. Do not install a browser, npm dependency or paid replacement. Materialize the two exact commits in separate new owned worktrees/copies using the ordinary existing repository tools. Overlay the21 admitted files onto only the226d candidate copy, after checking archive and member identities. Keep the5bbb original unchanged. The workflow YAML in the packet is inert in a local copy; do not publish it or create a PR.

Create an existing parent directory for a new evidence run, then pass two *nonexistent* output directories to the unchanged receiver. The receiver creates an ephemeral loopback server and a dedicated browser profile, blocks nonlocal page traffic, records actual native workspace downloads/source hashes/observations, waits for exclusive Chrome exit, and removes only its own profile. No account or provider is used.

With SCOPESIGNAL_CHROME pointing to that existing executable, run the same candidate driver twice:

    node CANDIDATE/scripts/check-scope-allocation.mjs ORIGINAL EVIDENCE/original baseline
    node CANDIDATE/scripts/check-scope-allocation.mjs CANDIDATE EVIDENCE/candidate candidate

Retain exact stdout/stderr, exit status, receipt-before-cleanup.json, receipt.json, all native downloads and phone image. Record actual Node/Chrome versions and checkout/source identities. The first original control now asserts the literal intended fixture, including empty/unfinished amounts and LF/whitespace, before using the observed draft/download as evidence. If it fails, retain that failure before changing anything; it is not automatically a product defect. Candidate acceptance requires all10 groups, zero page errors, allowed inherited-font blocking only, exact source/served hashes and successful cleanup. Read actual results rather than assuming the group count.

The unchanged normal Node suite may be run natively from the isolated candidate as npm test (no installation needed). Prior author8/8 and peer6/6 remain bound to their original5bbb dependency source; no repeated or newer-parent test outcome is claimed in this handoff. Root/source reviews accept the candidate and direct64-character guard composition, while actual DOM/browser and the required repository gates remain separate.

Send back a compact source-bound receipt with original failures and exact evidence identities. Do not dispatch/rerun/push/open a PR/merge or modify workflow filters to manufacture an Actions-free pass. Evidence custody and an ordinary issue comment have been separately audited against current workflows; code integration is still held.

## Existing native-worker route, subject to owner re-admission

Fresh central recovery identifies cf5799f6d38b/root, the existing ScopeSignal #37 / PR45 owner, as the first native receiving contact. Its updated primary record https://github.com/Jacob-Met/hamon/issues/140#issuecomment-6066540307 reports an existing ThinkPad browser run started at20:27UTC in /tmp/scopesignal-public-cf5799f6d38b-zkr3qyuc and separately supported native Node24.19.0 source qualification. This is a recorded prior capability, not a new probe or a guarantee that the worker is currently free. Its Mac is explicitly offline; its RecallWeave140 browser work remains owned and queued. Request explicit re-admission of this bounded local receiving task through that existing owner before using any runtime. Do not reuse or change its original directory/profile/source.

The adjacent selected-checkpoint-import owner estate-68094585a1c2 / receiving_review, continued by scope_receiving, has recent actual native Chromium evidence in ScopeSignal35/PR46. That record identifies Node22 browser receiving; it does not establish our required Node24 runtime. PR46 merged as6f17ea30 at20:48UTC. Its new selected-import source is preserved in any evidence-custody parent but is not part of the older226 candidate ZIP. Later actual source adoption must separately compose/receive the current controller and both proposal-retirement paths; this handoff does not qualify that newer product composition.
