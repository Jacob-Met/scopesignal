# Current ScopeSignal draft integration

Qualified by `estate-52e56ea8fcca` on 2026-10-08 against canonical default `5d8b9ae344c96db3a357da87472c553485daaaf3`.

## Result

The original PR #2 evidence-draft fix and PR #3 webhook-label correction are incorporated while retaining the current capture display (#4), fixture-record download (#6), recovery timeline (#7), and editable-scope entry point (#10).

Pending evidence survives another approval and refused approval. Accepted evidence displays the exact recorded approval and its controls become read-only. A received webhook is labeled as received; reconciliation remains the event that confirms counted capture. The export continues to derive accepted evidence from ledger events and excludes pending or unrecorded editor values. Timeline navigation preserves the current review.

Only `app.mjs` changes among existing production files relative to the receiving parent. The original contribution tests are added with four current control IDs in their DOM adapter: `capture-title`, `capture-guidance`, `export-record`, and `export-status`. The production app was composed by clean three-way merges; current scope navigation and all export code remain intact.

## Exact provenance

- Receiving parent: `5d8b9ae344c96db3a357da87472c553485daaaf3`, tree `31899db54e2935c12f0978b8092efefca3716379`.
- Original PR #2 head: `0f8afe359b7a00963048f48c8ccec261d224c337`.
- Original PR #3 head: `fcce3f7d4780aa29f0e961b9b098abfbd3b804aa`, which includes PR #2 ancestry.
- Qualified local source merge: `f20f60e4be804689cfa30244a4e96a65a69bd61b`, with receiving parent and original PR #3 as its two parents.
- Qualified source tree before these new receipts: `e3e5bc8ce750d435441463821e4e75a165e675c1`.

Canonical source blobs, commit objects and receiving trees were reconstructed and checked against their Git object hashes. Local connectivity verification passed. The manifest records source and receipt SHA-256 values. The final publication commit may add these receipts; its browser-loaded production bytes must match this source.

## Native receiving

Node 24.19.0: **48 tests passed, zero failures**, including the original ledger, current export, timeline, scope-plan, and evidence-draft tests. See `node-tests.log`.

The existing browser harnesses ran against this exact composition in a real installed Chromium, with fresh contexts and an ephemeral loopback server:

| Harness | Passed checks | Coverage |
| --- | ---: | --- |
| `combined-drafts` | 15 | Desktop and 390 px viewport; exact literal drafts, approval custody, refusal, suggestion persistence, event labels, replay and current capture |
| `fixture-record` | 15 | Desktop and 390 px viewport; six actual downloads, exact accepted evidence, excluded drafts, preparation failure/retry and independence after replay |
| `timeline` | 20 | Desktop, 390 px and 320 px viewports; all eight prefixes, keyboard navigation, review preservation, invalid navigation, viewport fit and startup-failure isolation |

All three final receipts passed with **zero page exceptions and zero unexpected external requests**. The existing Google Fonts stylesheet was deliberately blocked and recorded; screenshots use fallback fonts. Representative current phone and narrow-timeline captures were visually inspected. These are browser viewport checks, not physical-phone or payment-provider acceptance.

## Preserved negative and historical evidence

The first final-source browser attempt exhausted shared temporary/build storage before page qualification. Its receipts and log remain under `*-initial-enospc*`. A native Cargo cleanup removed only completed inspector application build artifacts after the compiler owner stopped; source and qualified native binaries remained intact. The same unchanged ScopeSignal source then passed all three harnesses sequentially.

The earlier `draft-incorporation-20261008-52e56ea8fcca` directory is historical evidence for the composition on `33f021a`. The intermediate `draft-export-composition-20261008-52e56ea8fcca` directory qualifies the subsequent export composition on `fe8c015`. Neither is presented as final current-source acceptance. Both defaults advanced before publication, and their newer features were preserved in this receiving candidate.

Source/browser qualification is distinct from public deployment. The repository's existing `paypal-ai` push workflow is the Pages release route; the native PR and deployment record carry publication and public served-byte acceptance.

## Concurrent adapter integration

Default advanced again to `1e09495df6b79f96e1c32694969edd3ef2f45308` while receipts were being preserved. That received PR #12 changes only the disconnected Workers AI adapter, its tests/evidence, and the new pull-request test workflow. It changes none of the files loaded by these fixture browser checks. The receiving branch retains its qualified `5d8b9ae` parent and merges normally into the current default, preserving #12. The new hosted pull-request test job is the additional gate for that combined Node test composition; no repeated browser run is required for identical served fixture bytes.
