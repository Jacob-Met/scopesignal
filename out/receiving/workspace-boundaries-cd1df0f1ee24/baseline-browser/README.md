# Independent receiving of the existing workspace file boundary

The merged ScopeSignal workspace workflow passes an ordinary unfinished LF/Unicode draft round trip, but two independently frozen boundary criteria fail in native Chromium. This packet records the unchanged baseline. It contains no candidate fix or acceptance of one.

## Source and custody

The workflow belongs to estate `7a9310dad255`, [PR18](https://github.com/Jacob-Met/scopesignal/pull/18) and [issue16](https://github.com/Jacob-Met/scopesignal/issues/16). PR18 merged at 2026-10-08 12:02:23 UTC. This receiver is `estate-cd1df0f1ee24 / estate_coordination`.

|Identity|Exact value|
|---|---|
|Executed merge commit|`8a241c9ce409fa9b22ab0bbdc339e46fd4b38525`|
|Executed tree|`7686f7568c398f522df4d32f75a98814b1c4cd1d`|
|Actual merge parents|`4dc2ee04f7bab1b01b0dcc43af64de97f9f87447` + `b74539fc8662f66a5a557dcefdaafd12615deae4`|
|Workspace codec blob|`49905d00ede9a2b22a3fbdef12d09a2374f47716`|
|Workspace UI blob|`b10d8ef5f664c21717b73c3adf29586eaba9b5e6`|
|Frozen runner SHA256|`539181ff64059ee00232c107b4c6f90cb18a2757830a96bb7088c484ce874163`|

[The source manifest](source-manifest-8a.json) pins all 44 non-`out/` source, test and configuration files by Git blob, SHA256 and length. Native verification found zero source or probe changes before and after execution. Thirty-two runtime responses from eight distinct assets matched those pins. The receiver did not import production modules as its oracle.

## Actual baseline result

Native Chrome `154.0.8037.98`, Node `v26.3.0`, and existing Puppeteer Core `25.12.0` executed the three cases in 13.5 seconds on a fresh isolated profile. The raw browser process exited 1: **one control passed and two boundary criteria failed**. There was no harness fatal error, application JavaScript error, or source-response mismatch. The outer transport driver completed successfully and retained the browser exit code. [Full receipt](baseline-evidence/receipt.json), [driver receipt](native-driver.json), [stdout](native-driver.stdout), [stderr](native-driver.stderr).

### Ordinary unfinished draft: passed

The browser authored incomplete amounts and an empty title with LF, Unicode, literal markup-like text and whitespace. An actual downloaded `scopesignal.scope-workspace` version 1 file retained those strings. After a fresh page load, native file selection displayed a preview without replacing current work; explicit replacement restored the exact draft and left zero events. [Case](baseline-evidence/lf-unicode-download-roundtrip.json), [actual download](baseline-evidence/positive-download/scopesignal-workspace-v1.json).

This control covers draft stage only. It does not qualify reviewed-history reopening.

### External field line endings: failed

The [literal external input](fixtures/external-lineendings.json) was accepted and offered for replacement. Assigning its admitted strings to native inputs and textareas changed them silently. The changed values were then included in a second actual browser download. Escapes below denote literal characters in the JSON string, not visual wrapping.

|Field|Admitted file value|Applied and downloaded value|
|---|---|---|
|Project name|`Project\nsecond\rpiece`|`Projectsecondpiece`|
|Project cap|`10\n0.00`|`100.00`|
|Checkpoint title|`First\r\ncheckpoint`|`Firstcheckpoint`|
|Checkpoint amount|`4\r2.05`|`42.05`|
|Brief|`one\r\ntwo\rthree\n`|`one\ntwo\nthree\n`|
|Evidence|`one\r\ntwo\rthree`|`one\ntwo\nthree`|

The criterion permits either refusing a value before changing the current workspace or preserving every admitted value exactly. This source did neither. [Case and before/after values](baseline-evidence/external-lineendings-reject-or-preserve.json), [actual changed re-download](baseline-evidence/external-redownload/scopesignal-workspace-v1.json), [actual applied screen](baseline-evidence/external-applied.png).

### Edits before file selection: failed

The receiver opened Chromium's actual native file chooser, intercepted by Puppeteer. While it remained outstanding, before accepting a file and before the input's `change` event, the receiver assigned a newer label and evidence and dispatched their native bubbling `input` events. The later file selection still offered replacement. Explicit replacement overwrote both newer fields and the rest of the current draft with the older selected file.

The overwritten label was `NEWER fictional draft written while chooser outstanding 日本語 😀`; the overwritten evidence was `New current evidence\nMust remain after an older open intent`. The replacement label became `SAVED fictional workspace before newer edits`. [Full case](baseline-evidence/edit-before-file-choice-preserved.json), [selected file](fixtures/normal-saved-draft.json), [actual screen after replacement](baseline-evidence/chooser-after-apply-attempt.png).

This is an instrumented chooser interval test. It does not claim a human can type through an OS modal. It isolates changes occurring after an open intent and before file selection, which differ from edits during the asynchronous file read or preview.

## Scope and reproduction

[Criteria](criteria-frozen.json), [runner](check-workspace-boundaries.mjs), and both fixture files were frozen before candidate repair inspection. [Probe manifest](probe-freeze-manifest.json) pins that freeze. The [native driver](native-driver.py) documents the isolated source verification, browser environment, timeout and process ownership. [Transport receipt](transport.json) retains both archive identities.

The actual screenshots were visually inspected after receipt. External requests were blocked and recorded, including the page's inherited font stylesheet and browser-generated favicon request. No broad network/privacy acceptance claim is inferred from these three cases. No public route, payment provider, installed app state, source file, or GitHub object was modified by this receiving run.

The prior separate draft-format proposal and its receiving archive are outside this packet. These findings concern the existing workspace format and controls already merged by PR18.
