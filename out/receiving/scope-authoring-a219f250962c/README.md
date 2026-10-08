# Editable fixture scope receiving

## Product result and provenance

The former Add-checkpoint alert opens a real authoring page. A project owner can draft a brief, allocate a cap across 1–12 deliverables, review evidence, and explicitly approve checkpoints before exercising their synthetic payment lifecycle. Review alone records no approvals or events. Scope amounts and deliverables lock after the first approval; accepted evidence stays recorded while other rows retain their literal drafts. Unknown responses remain uncounted until an explicit simulated lookup.

The six new feature files are exactly those independently accepted at local source commit 562c3a15a4eeeb4726f1ac3916987e267cb6cdc3, tree bd8d606350ec7c9d4c0889dcf6efeaf89e0562b9. They use the existing dependency-free Node/browser stack and ledger. State is in memory and clears on leaving or refresh; no storage, provider request, real payment, or new-page export is represented.

Publication is based on 31d683e35e4a70065a514cc459eb83d8ffc573ca, tree 79eed5d03b80d428b0c9163ccc6017a274f38650, preserving merged export #6 and timeline #7. Only the original Add control's navigation/label and an additive README section differ in existing source. Every other base-tree leaf is retained. The full source tree before adding this new receiving directory is c8afde1406a9760e65f5665a7e5b61091b0127e9. The native Git API may encode a different commit identity; source-manifest.json identifies every changed blob and the exact sole parent.

## Receiving results

| Receiving source | Native | Actual Chromium |
| --- | --- | --- |
| Frozen reviewed source | 29 tests pass | 23 groups pass |
| Independent frozen-source review | 4 groups pass | 4 groups pass |
| Frozen source plus #8 ledger candidate | 44 tests pass | 23 author groups; 4 independent groups pass |
| Independent #8 ledger composition | 4 groups pass | included above |
| Source composed with publication parent 31d683e | 40 tests pass | 20 timeline groups; 5 combined entry/export groups pass |

The independent reviewer enumerated 169 reachable paired checkpoint histories, 312 legal transitions, 12 checkpoint identities, and 2,847 BigInt decimal boundary cases. The reviewer found an accepted-cent display discrepancy and a sparse-row validation failure; both were corrected by the author. The prior failing source remains identified in the review, with its actual-browser negative receipt retained here. Exact integer-dollar/remainder formatting preserves every supported cent.

On the newly merged timeline/export parent, all 40 native tests pass. The existing timeline receiver passes 20 groups at desktop, 390-pixel and 320-pixel widths. A separate narrow browser receiver changes a current approval and pending literal draft, downloads the current record, traverses timeline steps, and downloads again: all four desktop/phone downloads retain identical accepted evidence and bytes across navigation. The same contexts follow the new entry into the authoring page and observe zero inherited approvals/events. Those five receiving groups pass.

All browser runs used fresh contexts and blocked external requests. The inherited static Google Fonts stylesheet was attempted; no unexpected external requests or page errors were observed. New source receiving uses existing Chromium 153.0.8010.0 and Node 24.19.0. Older receipts identify their own source hashes and composition limits; they are not relabeled as runs on the new published head.

## Files and reproduction

- source-manifest.json: sole receiving parent, source-tree identity, exact blobs/SHA256 values, and result mapping.
- node-final.log and browser-final/receipt.json: frozen author receiving.
- independent-review/: independent controls, disposition, original failing browser receipt, corrected receiving, and ledger-composition receipt.
- node-ledger-composition.log and browser-ledger-composition/receipt.json: owner #8 compatibility qualification.
- current-default/: exact composition manifest, 40-test native output, 20-group timeline receipt, five-group entry/export receipt, and its reusable receiving script.

Run npm test for the native suite. The authored browser command is node scripts/check-scope-workspace.mjs. The merged timeline command is node scripts/check-fixture-timeline.mjs. The narrow composition command is node out/receiving/scope-authoring-a219f250962c/current-default/check-current-composition.mjs /path/to/source /path/to/receipts. Browser commands use existing SCOPESIGNAL_PLAYWRIGHT and SCOPESIGNAL_CHROME paths. Independent reproduction is described in independent-review/REVIEW.md.

This public packet retains textual controls and receipts. The independent review's per-amount JSON captures and PNG screenshots, other earlier composition screenshots, and the full local history bundle remain in the coordinating cohort's complete receiving packet. Their absence from this compact publication does not imply that they were not collected.

## Ownership and integration limits

Issue #9 records this authoring contribution. Existing #5/#8 owns ledger identities; #2 and #3 retain evidence-editor and webhook-label ownership; #6 export and #7 timeline remain preserved. Compatibility with #8 does not incorporate or claim that owner's changes.

Root receives the public diff before merge. The existing Pages workflow has no PR trigger: it tests and deploys on a push to paypal-ai, or on manual dispatch. No workflow configuration or dispatch was introduced. Source publication alone does not establish default-branch incorporation, public deployment, or provider/payment receiving.
