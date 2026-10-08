# Authored ScopeSignal draft files: receiving and source composition

This contribution lets an author keep unfinished work in a versioned JSON download and deliberately reopen it in `scope.html`. The original authored-scope implementation remains credited to `a219f250962c`. Scope and custody are recorded in [the public continuation claim](https://github.com/Jacob-Met/scopesignal/pull/10#issuecomment-6058523510).

## Product contract

Save preserves the raw label, brief, cap and ordered checkpoint title, amount and planned-evidence fields. Blank or unfinished fields remain editable; Save does not turn them into a valid review. Existing Review validation still decides readiness.

Open first validates and previews a file. The current draft stays in place until the author presses **Replace this draft**. Cancel, refusal, newer edits, a newer selection or entering Review invalidate the pending replacement. Rendering uses text and form values, including for supplied filenames and literal HTML.

The file envelope is exactly `schema: "scopesignal.scope-draft"`, `version: 1`, `fixtureOnly: true`, and `draft`. Only the authored fields are permitted. Files are bounded to 1 MiB and 1–12 checkpoints. Every field is a string; money spelling and unfinished values are retained. Textareas use LF, and single-line form fields cannot contain CR or LF. Incompatible external values are refused rather than silently normalized by the form. UTF8 decoding is strict; a UTF8 BOM and CRLF JSON layout are accepted.

No approval, event, ID, payment result or receipt can enter this format. A reopened valid plan starts a fresh review with no approvals, captured amount or events. File actions use a native file chooser and Blob download. The download status reports preparation rather than claiming that the browser wrote a file to disk.

## Exact source and composition

- Original source base: `317c1aad0bc6d68e4f4d3c70863b481741a61fb5`.
- Publication parent: `8e50105fdc1645720e64ca83738727473c9f6acf`, tree `fe302d490b55f9eb4f5cbd7f4d7e9fca7e134820`.
- The seven frozen contribution paths are README, `scope.html`, `scope-workspace.css`, `src/scope-workspace.mjs`, the new `src/scope-draft-file.mjs` and `src/scope-draft-controls.mjs`, and `tests/scope-draft-file.test.mjs`.
- [Publication manifest](publication-manifest.json) pins every source and evidence file, excluding itself. The complete submitted tree is separately reconstructed and read back through Git.
- [Current-parent source composition](current-parent-source-composition.json) checks all 45 source/configuration/test files. The latest `app.mjs` and PR15 evidence-draft tests are preserved exactly; all historical `out/` files are inherited from the complete parent tree.

## Independent source review

[The source review](independent-source-review.json) accepts all seven frozen payload hashes. It examines lossless authored values, bounds, plain-data admission, exclusion of approval history, asynchronous selection/revision/value checks, explicit atomic replacement, literal DOM use, and preservation of existing domain and review behavior. It requested no production change.

## Native browser receiving

The [complete browser packet](native-browser/README.md) contains baseline and candidate receipts, executed drivers, actual downloaded files, screenshots, refusal inputs and a file manifest. Native Chrome ran at desktop 1440 × 1000 and phone viewport 390 × 844.

Baseline receiving demonstrates the actual gap: there are no Save/Open controls, and reload loses unfinished authored work. The candidate passes all **17 functional browser cases**, including actual downloads and reopens, keyboard preview/cancel/replacement, refusal without field mutation, chooser/read/preview races, newer-selection precedence and fresh-review approval boundaries. Six actual JSON downloads are preserved across the full run and focused supplement.

The original full driver also had an overly broad assertion requiring zero cross-origin requests. Its raw result remains **17 pass, 1 failure** because unchanged baseline styling imports one Google Fonts stylesheet. A separate executed supplement on unchanged product bytes passes the meaningful check: file actions add no request, with exactly the same inherited font GET before and after, no request body, and no local/session/IndexedDB/service-worker storage. The corrected full driver is a syntax-checked reproduction aid, not a claimed rerun. All negative evidence remains intact.

All four actual candidate screenshots were independently inspected, with no horizontal overflow at either viewport. They use existing fallback fonts because external requests were blocked during isolated receiving. Desktop/phone viewport qualification is not a physical-phone or cross-browser claim.

## Current-parent browser composition

The separate [current-parent packet](current-parent-browser/README.md) receives the clean 45-file composition at `8e50105fdc1645720e64ca83738727473c9f6acf`. A bounded native phone-viewport check passes an actual unfinished draft download, reload, nonmutating preview and explicit replacement, followed by a fresh valid review with zero events, zero approvals and zero captured amount. The observed runtime source bodies match the pinned files, including PR15's current `app.mjs`; all 45 files remain unchanged.

Its first bounded attempt passed the product actions but rejected a browser-generated same-origin `/favicon.ico` request under the receiver's broad request classification. That raw failure is retained. The corrected executed driver recognizes the exact body-free same-origin favicon as browser-generated while keeping it blocked, and passes on unchanged product source. This receipt is distinct from the earlier 17-case suite and from later public deployment receiving.

## Source tests and retained staging correction

[Source test receipt](source-tests/receipt.json) and raw logs record native Node execution:

| Source composition | Actual result |
| --- | --- |
| Initial base `317c1aa` plus the feature | 102 passed, 0 failed |
| Current parent `8e50105` plus the feature, canonical source tree | **110 passed, 0 failed, 0 skipped** |

The first current-parent staging run reported 124 passes. Publication inventory found a retired `test/scope-draft-file.test.mjs` copy alongside the intended `tests/` file, causing Node's automatic discovery to execute the same 14 cases twice. That run and [correction record](source-tests/staging-correction.json) are preserved. Only the owned retired staging copy was removed; the final 110-test run uses the canonical 45-file source tree. None of the seven frozen product files changed. The retired path is excluded from publication.

## Reproduction and scope

Run `npm test` on the submitted repository with Node 24 or newer. Browser driver setup and exact environment variables are documented in the [native packet](native-browser/README.md#reproduction); use an existing supported Chromium/Puppeteer installation and isolated output directories.

These receipts qualify the stated source and native compositions. Hosted PR testing, actual merge preservation and Pages deployment are recorded separately on the contribution's PR with their actual commit/run pins. This packet does not imply a provider call, payment operation, saved approval session or installed runtime change.
