# Preserve authored workspace fields and newer edits

This is a compatible repair of the existing authored-workspace workflow from PR18, owned by `7a9310dad255`. It keeps that workflow's version-1 schema, file controls, history replay and review behavior. The separately developed draft-only PR19 is closed unmerged; its qualification is not used to accept this source.

Source base: `8a241c9ce409fa9b22ab0bbdc339e46fd4b38525`, tree `7686f7568c398f522df4d32f75a98814b1c4cd1d`. [Coordination and reproduced findings](https://github.com/Jacob-Met/scopesignal/pull/18#issuecomment-6059898755) identify this family's narrow follow-on. The adjacent printable-review owner in issue20 retains its separate exporter and download handler.

## Actual original failures

The independent receiver froze three cases before inspecting a repair. Against all 44 original source files, the ordinary LF/Unicode draft roundtrip passed and two file-preservation boundaries failed:

- An external workspace file was admitted and previewed, then native form assignment silently stripped or normalized embedded line breaks. The project cap `10\n0.00` became `100.00`, and checkpoint amount `4\r2.05` became `42.05`. An actual subsequent download captured those changed values. Project/checkpoint text and textarea line breaks also changed.
- An actual intercepted Chromium chooser remained outstanding while newer label and evidence edits were dispatched through DOM input events. Selecting the older file still offered replacement and overwrote the newer values. This qualifies an instrumented asynchronous chooser interval; it does not claim a person typed through an operating-system modal.

The [complete baseline packet](baseline-browser/README.md) retains the original runner, criteria, fixtures, before/after fields, actual downloads, screenshots, process exit and source pins. There was no application exception, fatal harness error, source mutation or response mismatch. Its result is **one positive control pass and two boundary failures**.

## Repair

The existing codec now refuses editable field values that native controls cannot retain. Single-line project/checkpoint names and amounts reject CR and LF. Draft and pending-evidence textareas accept LF and reject CR. JSON layout may still use CRLF outside string values. Existing string/byte/row bounds and ordinary unfinished draft handling remain.

The existing controller records the workspace before the native chooser opens. Selection generation and the complete current draft/review/pending-evidence values are checked after reading and again before explicit replacement. Newer selections, edits, review transitions and cancellation retire older work. Direct file-change/drop events still receive a fresh read boundary, and stale read errors cannot replace newer state. File reading and private history replay remain separate from the current workspace until deliberate Apply.

The product payload is four files: the codec, controller, nine focused model tests and the existing README section. No second format, file-controls surface, domain model, ledger, dependency or workflow is introduced.

## Independent receiving

| Gate | Result |
| --- | --- |
| Same three frozen browser cases, original source | 1 pass / 2 failures |
| Same three frozen cases, repaired source | **3 passed** |
| Separate reviewed-history browser roundtrip | **1 passed** |
| Same nine new model tests, original source | 1 pass / 8 expected refusal failures |
| Full candidate source tests | **116 passed / 0 failed / 0 skipped**, including all 107 inherited tests |
| Independent source review | No blocking finding |

The [candidate browser packet](candidate-browser/README.md) preserves both executed receivers and their independent freeze records. The repair refuses the incompatible file before preview, preserves the newer edits after the stale chooser completes, and keeps the ordinary actual draft download/reopen intact.

The separate history control uses actual UI actions to approve, create an order, request capture and lose its response. Actual save, reload, preview and replacement preserve the accepted LF/Unicode evidence, distinct pending LF/Unicode and empty evidence, four canonical events, the editing lock, and unknown capture with $0 captured. The reviewed download and re-download are byte-identical: 2,063 bytes, SHA256 `c5fe18e23240633979aee0b7250722b45d16446000e810778fff629639113dba`.

All 45 candidate source files and both receiver inputs remained unchanged. All 48 observed runtime response bodies matched their pins. Both native browser processes exited 0, with no application errors or fatal receiver error. The two candidate captures were visually inspected. Native execution used the existing Chrome 154 and Node 26.3 on the authorized Mac, isolated profiles and loopback source. No signed-in browser, provider call or live payment was used.

## Exact source and documentation refinement

[Frozen v1](candidate-frozen-v1.json) pins the source used for native tests and browser receiving. [Frozen v2](candidate-frozen-v2.json) changes only README wording to specify that CR restrictions apply to editable field values and that CRLF JSON layout remains accepted. Both production modules and the nine-test file remain byte-identical.

[Independent v1 source review](source-review-v1.json) covers source admission, asynchronous state guards, stale errors, direct selections and reviewed-workspace reconstruction. [Final v2 acceptance](source-review-v2.json) verifies the documentation-only delta and all 45 source hashes without repeating runtime tests. [Source test receipt](source-tests/receipt.json) pins the original failing test log and complete candidate passing log.

[Current-parent source composition](current-parent-source-composition.json) binds inherited source. [Publication manifest](publication-manifest.json) pins every selected product/evidence file, excluding itself. The complete Git tree is independently reconstructed and read back before integration. Both complete browser packets are copied intact; the baseline-specific 44-file note in the frozen original runner is retained, while the candidate manifest accurately counts 45.

## Reproduction and integration boundary

Run `npm test` using Node 24 or newer for the maintained source tests. The browser packet READMEs describe the existing native browser/Puppeteer paths and isolated output variables; baseline and candidate use the same frozen boundary runner. The history receiver remains a separate positive control.

These receipts qualify the stated native source. The PR records the submitted head, hosted test checkout, actual merge, automatic Pages release and eventual served-source receiving separately. No source merge or deployment is inferred from local tests, and no qualification from the superseded PR19 is carried into this repair.
