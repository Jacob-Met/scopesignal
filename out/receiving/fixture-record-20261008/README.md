# Reviewed fixture record download — 2026-10-08

Contributor: HAMON cohort `81ba1ed0179c / estate_integration`.

## Implemented behavior

The current fixture stores accepted evidence only in its in-memory event ledger. This addition lets the visitor explicitly download those recorded approvals and the current reduced outcomes before reloading the page. It uses the existing ledger/reducer; it does not read acceptance authority from a textarea, alter payment transitions, retain browser storage or introduce an account or provider.

`src/fixture-record.mjs` creates a detached versioned JSON record. The fixed filename is `scopesignal-fixture-record-v1.json`; schema `scopesignal.fixture-record`, version 1, ledger spec version 1. The file states `fixtureOnly: true`, `paymentEvidence: false`, and explicitly denies being a payment receipt or evidence of a real transaction. Each approved checkpoint records its exact approval-event sequence, approver and accepted evidence. Unapproved checkpoints have `approval: null`; unrecorded DOM drafts are outside the file.

The native download handler prepares the JSON Blob only on the user's button click, removes its temporary anchor and releases the object URL. Refusal before preparing a download leaves the ledger and current drafts unchanged. A retry produces the same record. Status text describes preparation rather than asserting that a user saved a file.

## Receiving evidence

| Qualification | Result | Receipt |
| --- | --- | --- |
| Node 24.19.0 on Linux | 22 methods pass, no skips | `node-linux.log` |
| Node 26.3.0 on Mac.lan | 22 methods pass, no skips | `node-macos.log` |
| Initial native Chrome 154 receiving | 13 groups pass, six actual downloads | `browser-initial.json` |
| Final native Chrome 154 receiving | 15 groups pass, six actual downloads; includes file retention after replay | `browser-final.json` |
| Composition with separately owned #2/#3 and integrated #4 | Strict application patch succeeds; 30 Node methods pass | `export-app.patch`, `node-combined.log` |

The browser harness runs desktop and phone contexts, downloads the actual JSON through the page's button, verifies event-sourced evidence after deliberately changing DOM values, excludes unapproved drafts, injects a native download-preparation refusal, retries and compares exact bytes, then reloads the fixture and reads the retained downloaded file. The current capture state and viewport controls remain passing. The downloaded fictional sample is `downloaded-fixture-record.json`, SHA-256 `ab1ec74d1bfcb3308bfc2835df3e8dae21df1d12ac269b32d9fda1f269f68ba1`.

All external requests were blocked; the existing Google Fonts stylesheet attempts are recorded. Native browser code uses fresh contexts and an ephemeral loopback source server, without user profiles or services. Each browser receipt records served source hashes and actual download hashes. Source readback and the copied sample hashes were checked locally. The combination's browser behavior is not claimed: its evidence is strict source composition and Node execution.

## Source and continuation

The receiving source base is deployed ScopeSignal merge `33f021aaacd6d7ed68c508d92901e7442d99586c`, tree `4b7b68a48acb7bd83665f7e97239d68c018f61ed`. The separate #2/#3 draft owner branches are untouched. If those drafts are later incorporated, their DOM test adapter needs `export-record` and `export-status` in addition to #4's `capture-title` and `capture-guidance` IDs. That four-ID adapter was used in the isolated Node combination.

An attempted source-scope issue creation at 2026-10-08 07:55:37 UTC was rejected by GitHub's secondary content-creation rate limit (HTTP 403). No claim issue was created, and no further content-creation retries or alternative-account/route attempts followed. This implementation remains isolated and verified, pending root review and remote publication after the shared cooldown. The cohort root authorized the local scope and is reviewing the concrete source.

When publishing resumes, first recover the current default head and affected source blobs. The prepared full-file payload is valid only against the stated receiving base; do not overwrite another owner's newer source. Reapply the narrow patch and qualify any meaningful composition difference if the base moved. Publish an exact-tree, non-draft PR after independent review, integrate through the established repository process, and verify the existing Pages run and actual served module/button/download. Source publication, merge, deployment and public operation are separate states. No completed public export capability is claimed in this checkpoint.
