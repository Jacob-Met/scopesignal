# Independent receiving of checkpoint CSV drafts

The exact candidate tree `3146dd1d196d0d0545bcdd2d3db3244c0b0bf7d5` passes five independent native groups and three independent Chromium groups. No product change was requested by this review. These are supplemental ThinkPad Node 22.22.1 / Chromium 153.0.8010.47 results; the repository declares Node >=24, and the required-engine qualification is a separate root-owned gate.

The review was scoped before candidate implementation or author tests were read. `scope-v1.json` was frozen at SHA256 `e07e42641cf16fadea93460fe4ae6d4fe527393031e96207d5d90e2a10c987ae`. The independently copied native baseline is canonical `Jacob-Met/scopesignal`, branch `paypal-ai`, commit `847505d2fe9f8295110fc13a3fb9e05ec71f6644`, tree `cac1d2bbdd38e2e4c2aed7249c2593ec174c0eaa`. An earlier lookup of a repository named paypal-ai returned 404; paypal-ai is the branch name. That lookup error is not product evidence.

## Observed behavior

- Fourteen baseline-accepted drafts retain every literal title, amount, evidence, label, brief and cap value through the converter and exact unchanged native encoder. Controls include quoted commas and quotes, LF evidence, CRLF record separators, one leading BOM, embedded BOM, Unicode, whitespace, leading zeroes, all-empty unfinished fields, twelve rows, exact native limits, genuine U+FFFD, and unfinished amounts.
- Fourteen native refusal boundaries remain authoritative. The additional parser controls reject ambiguous headers, malformed/ragged/blank records, invalid UTF-8, two leading BOMs, invalid input types and inputs beyond the byte limit. No trimming, numeric coercion or rounding is substituted for native draft/review validation.
- Actual Chromium file input, preview and five completed downloads preserve the native draft/review record. A pending import and current workspace remain unchanged while the converter operates in a separate tab. Import preview and Cancel preserve current work; explicit Replace workspace adopts the exact fields; Download workspace returns exact native draft bytes. Explicit Review creates zero approvals and zero events.
- A literal amount of `1e3` remains an editable draft and fails the existing review validation. Editing it to `1.00` allows native Review with zero events. Malformed UTF-8 and double-BOM files are refused through the actual browser input.
- Delayed actual `File.arrayBuffer()` completions cannot revive a preview after metadata edits, Cancel or a newer file selection. A rejected older read cannot overwrite a valid newer preview. A different file with identical bytes still invalidates the old reviewed download. Forced stale control dispatch does not start a download.
- There are no page errors or observed Web Storage writes in the qualified flows. The converter makes no external request. The unchanged authoring page's exact Google Fonts CSS request is intercepted and recorded separately; no provider/payment request is allowed or observed. This is not a claim that the baseline authoring page has no external asset references.

## Retained receiver failures and correction

Both `browser-v1/result.json` and `browser-v1-diagnostic/result.json` are retained. Each original replay passed the delayed-read group but failed two later native authoring interactions. A broad global zero-external-request assertion also rejected the baseline font CSS request. These were receiving errors, not repaired product behavior.

The diagnostic replay records the actual native click targets. After Review moved focus, the requested Save click landed on the surrounding SECTION. After a validation error, the requested corrected Review click also landed on a SECTION. The unchanged baseline styles use smooth scrolling. Both corresponding reviewed records validate and encode successfully through the native codec in `native-browser-diagnostic-v1.stdout.json`.

The v2 receiver changes only transport/classification: it brings the target tab forward, positions the existing control, waits for a stable rectangle, verifies its center hit target, and sends a real mouse click. It separately records and blocks the exact baseline font URL. It does not change production CSS, replace native event handlers, call private product state, add a dependency, grant sandbox exceptions, or relax application assertions.

All three application group blocks are byte-identical across original, diagnostic and v2 receivers: 7,243 characters, with all 53 assert-call expressions identical. `final-custody-and-receiver-proof.json` pins that comparison, the two observed SECTION misclicks and the unchanged baseline/candidate styles. The original outputs remain unchanged; v2 passes 3/3 with five actual downloads.

## Reproduction

The scripts in this packet use ordinary Node built-ins. The browser receiver additionally uses the already installed ThinkPad Puppeteer at its explicit absolute import, the installed `/snap/bin/chromium`, a new isolated profile and download directory. Adapt only those runtime locations when replaying on another authorized host and record the adapter separately. All fixtures are fictional. No user profile, provider, payment service or dependency installation is used.

This packet uses two JSON archives to retain repetitive source/manifests and raw receipts exactly without dozens of separate publication leaves. `unpack-review.py` checks every archived byte count, SHA256 and Git blob and refuses existing destinations. Restore a new private replay directory:

```sh
python3 unpack-review.py /absolute/new-peer-replay
```

Supply a checkout matching the restored `candidate-source-manifest.json`. From that new replay directory:

```sh
node make-baseline-fixtures-v1.mjs
node native-independent-v1.mjs /absolute/candidate/src/scope-checkpoint-csv.mjs /absolute/new-native-result.json
node browser-independent-v2.mjs /absolute/candidate /absolute/new-browser-output
```

Use fresh output paths. The first command regenerates the baseline fixture file. On the captured Node22 runtime its SHA256 should match the retained fixture; a different runtime changes the recorded runtime field, so separately compare the accepted/rejected fixture payloads and retain the new runtime identity. The browser receiver serves exact candidate bytes from a private loopback HTTP server. Delayed reads call the real File implementation before retaining its result behind a test-only completion gate. Native file input and actual Chromium downloads are used for the roundtrip.

The browser UI input helper sets the native input value and dispatches its ordinary input event; it does not replace application validation. The literal table remains textContent, and HTML-looking fields do not create elements. These controls do not claim comprehensive browser compatibility, accessibility or live-payment validation.

## Custody and publication boundary

Final readback verifies all 527 owner files and all 527 private copied files by length, SHA256, Git blob and executable mode. All 519 unowned baseline files are unchanged. Candidate manifest SHA256 is `5b05b3931937b41f2170609f13a351d116ccb868559cddae3c6a1e784b6ee9c4`. No product files were edited by this reviewer.

This compact packet preserves exact source/contract pins, fixture and receiver versions, raw result/log/process receipts, and actual downloaded JSON. Browser profiles and dependencies are excluded. The native screenshot remains in the original isolated run and is pinned in the custody inventory; it is not needed to execute the assertions. All original owner evidence remains separately attributed.
