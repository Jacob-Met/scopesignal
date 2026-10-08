# Public receiving of the existing workspace repair

The live [ScopeSignal workspace](https://jacobmetoyer.com/scopesignal/scope.html) passed both bounded save/open flows against the exact runtime source of repair merge **`65d47f90e609c36f51648c303e06f74a1d95f856`**. Normal HTTPS verification remained enabled in both the source preflight and native Chromium. This packet records actual public-route execution at **2026-10-08 13:12:57 UTC**.

## Release identity and custody

[Repair PR22](https://github.com/Jacob-Met/scopesignal/pull/22) published head `c436b9ff023d9d0c79af3e5e134131fd37f5883f`. Independent receiving reconstructed its tree from all 250 base leaves and the 65 payload files, then compared all 312 public leaves and modes and all four raw product bodies. The complete 21-file baseline and 30-file candidate browser packets were retained byte for byte; 247 unrelated parent leaves remained exact. [Publication audit](independent-source-receiving/publication-audit-v2.json), [published-head acceptance](independent-source-receiving/published-head-acceptance.json).

The actual merge `65d47f90e609c36f51648c303e06f74a1d95f856` has parents `8a241c9ce409fa9b22ab0bbdc339e46fd4b38525` and `c436b9ff023d9d0c79af3e5e134131fd37f5883f`, and retains the exact qualified tree `88073a0984b05b629d85563ae2e113e6c932e8ec`. The existing automatic [Pages run 37781938930](https://github.com/Jacob-Met/scopesignal/actions/runs/37781938930) is a successful completed push run for that exact merge. [Direct merge/release API readback](merged-release-readback.json).

Estate `7a9310dad255` retains authorship of the workspace/history workflow from PR18 and its earlier release-receiving lane. Estate `cd1df0f1ee24` authored this compatible repair; `estate_coordination` received the repair's source and this public release. This result does not claim to perform or accept the original author's previous baseline site receiving. The portable-report work in issue20 remains a separate owner's contribution.

## Served source matched before browser actions

The native driver fetched all eight required runtime files from the public HTTPS route with standard curl certificate verification. Every request returned HTTP200 at the expected HTTPS URL, and every byte length, SHA256 and Git blob matched the merged source manifest. Only after that gate passed did the browser run. The raw fetched bodies are retained under `preflight-served/`.

|Changed runtime file|Exact public Git blob|
|---|---|
|`src/scope-workspace-record.mjs`|`d9141b3e1ac74b33f996ec6d68756ece5c190162`|
|`src/scope-workspace.mjs`|`adc9bb3e53ffa72671a8f46e9b067b879ac3adff`|

The other six served runtime files also matched their expected inherited blobs. During actual browser navigation, all **32 responses across the same eight assets** were independently hashed again before app actions. There were no response mismatches or application JavaScript errors. [Source manifest](source-manifest.json), [preflight receipt](preflight-receipt.json), [verified release input](release-verified.json), [complete browser receipt](browser-evidence/receipt.json).

These checks establish the served runtime bytes observed at the stated time. They do not infer the contents of unrequested files from a deployment label.

## Actual public flows: 2 passed, 0 failed

### Unfinished LF/Unicode draft

The receiver authored an unfinished draft using the public page, including an invalid amount string, an empty title, LF line breaks, Unicode, whitespace and literal markup-like evidence. It downloaded the actual workspace file, loaded a fresh page, selected that file through Chromium's native chooser, observed a non-mutating preview, and explicitly replaced the current workspace. Every draft value returned exactly, with draft stage and zero events.

[Case](browser-evidence/lf-unicode-download-roundtrip.json), [actual 843-byte download](browser-evidence/positive-download/scopesignal-workspace-v1.json), [actual reopened draft screenshot](browser-evidence/public-draft-reopened.png).

### Reviewed history and evidence

Actual existing UI actions produced one approval followed by order creation, capture request and a lost response. Accepted LF/Unicode evidence, separate pending LF/Unicode evidence, and an explicitly empty pending field were saved. After a fresh page load and native selection, the preview correctly identified one approval and four events without changing current work. Explicit replacement restored the same accepted/pending evidence, complete event rows, actions, counters and editing lock.

The capture remained **unknown with $0.00 captured**; lookup remained an explicit next action. The actual downloaded and re-downloaded files are byte-identical: **2,063 bytes**, SHA256 `c5fe18e23240633979aee0b7250722b45d16446000e810778fff629639113dba`.

[Case](browser-evidence/review-history-download-roundtrip.json), [first actual download](browser-evidence/review-download/scopesignal-workspace-v1.json), [actual re-download](browser-evidence/review-redownload/scopesignal-workspace-v1.json), [actual reopened review screenshot](browser-evidence/reviewed-history-reopened.png).

Both public screenshots were visually inspected. The public draft and reviewed downloads also match the corresponding previously qualified native candidate downloads byte for byte.

## Execution and preserved corrections

Native Chrome `154.0.8037.98`, Node `v26.3.0`, and existing Puppeteer Core `25.12.0` ran in a fresh isolated profile at 1440×1000. Browser execution completed in 5.7 seconds with exit 0, two passing cases, no fatal error, and no application error. All five frozen native inputs remained unchanged. The profile was removed after the run. [Driver and complete results](public-native-driver.json), [executed driver source](public-native-driver.py), [browser stdout](browser.stdout), [browser stderr](browser.stderr), [transport identities](transport.json).

The [public runner](check-workspace-public-positive.mjs) reuses the two independently frozen positive criteria. It adapts URL paths, source/release gates and response verification, and adds one draft screenshot. [Criteria provenance](public-positive-criteria.json) and [input freeze](input-freeze.json) preserve that preparation; their prepared/pending labels describe the pre-execution freeze, not the completed result.

The initial public-adapter syntax check caught an apostrophe in a newly written metadata string before any browser execution. Its [original prepared script](public-preparation-failures/initial-public-positive-syntax.mjs) and [correction record](public-preparation-failures/syntax-correction.json) are retained. Two earlier publication-audit helper schema guards also stopped before acceptance or mutation; their [correction record](independent-source-receiving/publication-audit-helper-corrections.json) is preserved. No baseline or candidate runner, fixture, receipt or frozen packet was rewritten by these corrections.

The two source-boundary negative cases were already executed against the identical repaired runtime modules and were not repeated on the public route. No old PR19 runner or alternate file format was used. External browser requests were blocked and recorded; no payment provider, deployment, GitHub object, production source or installed app state was mutated by this receiving lane.
