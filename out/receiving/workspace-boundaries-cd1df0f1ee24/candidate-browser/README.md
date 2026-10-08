# Independent native receiving of workspace boundary repair v1

The unchanged three-case boundary receiver passes all three cases against this exact candidate. A separate frozen reviewed-history control also passes. These results qualify the isolated candidate source below; they do not claim a published commit, merged state, or Pages deployment.

## Exact input and preserved ownership

The existing workspace format and workflow remain those authored by estate `7a9310dad255` in [ScopeSignal PR18](https://github.com/Jacob-Met/scopesignal/pull/18) / [issue16](https://github.com/Jacob-Met/scopesignal/issues/16). The repair was authored by the root worker of estate `cd1df0f1ee24`. Its independent native receiver was `estate_coordination`.

|Identity|Exact value|
|---|---|
|Candidate base commit|`8a241c9ce409fa9b22ab0bbdc339e46fd4b38525`|
|Base tree|`7686f7568c398f522df4d32f75a98814b1c4cd1d`|
|Candidate codec blob|`d9141b3e1ac74b33f996ec6d68756ece5c190162`|
|Candidate controller blob|`adc9bb3e53ffa72671a8f46e9b067b879ac3adff`|
|Candidate README blob|`301b583f9d61d974f46a8ff6647983e5005fe2e3`|
|New model test blob|`961c7ff3c9a58ec1418aede8b0f50194cfcadbbc`|
|Lead freeze manifest SHA256|`129f2c96a764311a274d766e7404450b929152397128122696785e1939cd492f`|
|Receiving source manifest SHA256|`5ab8d84ff065c4178816c78af36e2a64c3115e2f8171ece1897220a1fe83d0fc`|

[The receiving manifest](source-manifest-candidate-v1.json) pins all **45** source, configuration and test files. The candidate changes three inherited paths and adds one test path; all **41 other inherited files** match the exact base. The original UI markup, stylesheet, file schema/version, ledger, scope model, fixed example and record viewer are preserved. [The lead's freeze](lead-candidate-frozen-v1.json) is retained unchanged; its browser-pending field describes the time of that freeze, before the receiving results in this packet.

The candidate is an unpublished frozen source composition in these receipts, so the browser receipts intentionally have null source commit/tree values. The manifest and four payload blob identities specify the executed input. The unchanged three-case runner retains a baseline-specific static limits sentence saying “44-file”; **the candidate actually contains 45 files**, verified before and after both runs by the [native driver receipt](candidate-native-driver.json). The receiver preserved that frozen runner byte for byte and records this metadata distinction here.

## Boundary result: 3 passed, 0 failed

The [same runner](check-workspace-boundaries.mjs), SHA256 `539181ff64059ee00232c107b4c6f90cb18a2757830a96bb7088c484ce874163`, used the same criteria and literal fixture bytes as the executed baseline. On baseline merge `8a241c9…`, the LF/Unicode control passed and both data-preservation boundaries failed. Against this candidate, all three passed in 6.4 seconds.

|Case|Observed candidate behavior|
|---|---|
|Unfinished LF/Unicode draft|An actual native download, fresh page load, file preview and explicit replacement retained every authored string and zero events.|
|External CR/LF field values|The existing Open flow refused the file before presenting a replacement preview. The current draft remained exact. The message identified the single-line project-name requirement.|
|Edits while a chooser is outstanding|Newer label and evidence edits made before file selection remained exact. The stale chooser result produced no replacement preview and asked the user to choose again.|

[Complete boundary receipt](candidate-boundary-evidence/receipt.json); individual cases: [draft round trip](candidate-boundary-evidence/lf-unicode-download-roundtrip.json), [external line endings](candidate-boundary-evidence/external-lineendings-reject-or-preserve.json), [chooser interval](candidate-boundary-evidence/edit-before-file-choice-preserved.json). [Actual draft download](candidate-boundary-evidence/positive-download/scopesignal-workspace-v1.json) and [actual preserved-draft screenshot](candidate-boundary-evidence/chooser-after-apply-attempt.png).

The chooser interval uses an actual native Chromium chooser intercepted by Puppeteer. DOM value assignments and bubbling input events occur while that chooser is outstanding, before file selection and `change`. This isolates asynchronous current-state changes; it is not a claim of physical human typing through an OS modal. The external fixture combines several incompatible fields; this browser result establishes refusal of that complete file, while the lead's separate model tests cover each field position.

## Reviewed-history result: 1 passed, 0 failed

The [separate reviewed-history runner](check-workspace-review-history.mjs), SHA256 `2d3adac6895ed2c085edd7af5f12d7f08e69951ab5c04b072619d0de0853785d`, was frozen before repair-code inspection. It passed in 3.9 seconds.

Using actual existing UI actions, the receiver approved one checkpoint's LF/Unicode evidence, created an order, requested capture, and recorded a lost response. A second checkpoint retained separate LF/Unicode pending evidence; a third retained an explicitly empty pending field. The actual downloaded workspace contained the four canonical events and the separate pending values.

After a fresh page load, native file selection previewed one recorded approval and four events without replacing current work. Explicit replacement restored identical visible evidence, event rows, actions, counters and editing lock. The capture remained **unknown**, with **$0.00 captured** and lookup still requiring an explicit next action. A second actual native download had identical parsed contents to the first.

[Full case](candidate-history-evidence/review-history-download-roundtrip.json), [receipt](candidate-history-evidence/receipt.json), [first actual download](candidate-history-evidence/review-download/scopesignal-workspace-v1.json), [actual re-download](candidate-history-evidence/review-redownload/scopesignal-workspace-v1.json), and [actual reopened review screenshot](candidate-history-evidence/reviewed-history-reopened.png).

## Runtime, provenance and limits

Both runs used native Chrome `154.0.8037.98`, Node `v26.3.0`, existing Puppeteer Core `25.12.0`, and a fresh isolated profile on the receiver's Mac. The boundary run completed at `2026-10-08T12:41:52.808Z`; the history run completed at `2026-10-08T12:41:56.682Z`. Their raw browser exits were both 0. Every source and frozen probe file remained unchanged. There were no application JavaScript errors, harness fatal errors, or response-pin mismatches. The two runs observed 32 and 16 source responses respectively, each covering the same eight runtime assets. Three actual downloads and two screenshots are retained; both screenshots were visually inspected.

[Boundary criteria](criteria-frozen.json), [boundary probe manifest](probe-freeze-manifest.json), [history criteria](review-history-criteria-frozen.json), [history probe manifest](review-history-probe-manifest.json), [native driver](candidate-native-driver.py), and [transport identities](transport.json) make the executed scope reproducible. Raw stdout/stderr and complete driver results are included without rewriting them.

Independent source review of the two production diffs confirmed that editable strings are admitted only when native fields can preserve them, and that chooser selection, asynchronous read, preview and replacement bind to the current workspace value. The source change retains the existing format and product controls.

This is a bounded receiving result. It does not repeat the earlier separate draft-format feature's broad browser suite, claim all operating-system chooser interactions, or qualify a future composition with another owner's print work. External browser requests were blocked and recorded. No production source, installed state, public route, payment provider, GitHub object or deployment was mutated by this receiving lane.
