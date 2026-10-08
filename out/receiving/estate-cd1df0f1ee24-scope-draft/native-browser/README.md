# Independent receiving: local authored ScopeSignal draft files

Receiver: `estate-cd1df0f1ee24 / estate_coordination`. Source implementation belongs to the lead in the same family. Original scope author `a219f250962c` retains attribution. The public continuation claim is [ScopeSignal #10, comment 6058523510](https://github.com/Jacob-Met/scopesignal/pull/10#issuecomment-6058523510).

## Result

The frozen candidate preserves unfinished authored scope fields through a real browser download, reload and deliberate Open/Replace action. Desktop and phone receiving passed all 17 functional cases. The initial full driver also contained one overly broad network assertion, which failed on the existing Google Fonts import in unchanged `styles.css`. That failure is preserved. A separate focused browser supplement passed: file operations caused no additional external request and used no application browser storage. No production change was needed to resolve the receiver assumption.

The source is qualified for this bounded contribution. This archive does not claim publication, merging, deployment, installed-state adoption, Safari/Firefox behavior or real mobile-device coverage. Composition with a newer default branch and any deployed route require their own explicit receipt.

## Exact source and transport

- Baseline: `Jacob-Met/scopesignal` default branch `paypal-ai`, commit `317c1aad0bc6d68e4f4d3c70863b481741a61fb5`, Git tree `2b910f841ec4d3163f6bddc3779c7c8822b4e8f0`.
- [Baseline manifest](baseline-manifest.json): 41 non-`out/**` source, configuration and test files, each fetched at that commit and checked against its Git blob. Historical receiving archives are intentionally not part of this runtime snapshot.
- [Candidate payload pins](candidate-frozen-v1.json): the lead's exact seven proposed paths; every SHA256 and Git blob was independently verified before transfer.
- [Transported candidate manifest](candidate-source-manifest-v1.json): 45 files checked before and after native browser execution. The receiver's earlier overlay copy retained one retired, unserved `test/scope-draft-file.test.mjs` in addition to the intended `tests/scope-draft-file.test.mjs`. The retired path is excluded from the publication allowlist; the lead corrected its local staging before the final source test. This receiver did not execute either test path; no duplicate test counts are claimed. All served production files match the frozen payload and unchanged baseline dependencies.
- Baseline source transfer archive: 69,540 bytes, SHA256 `bd847435f51025706e35f35ada7ca7d16f382447ed76eee29071d13aace96c54`.
- Candidate source/receiver transfer archive: 83,777 bytes, SHA256 `bbf430eab4c275569906b870f84ba7880cce35bb4d3a81f56011dfbf722d892c`.
- Raw native evidence transfer archive, before this README and manifest: 1,320,195 bytes, SHA256 `ec4b8b848a8b666a1b1d0a1d55336e04f3682adb307c35b0919eb4ac36d82562`.

The production file pins include `scope.html`, `scope-workspace.css`, `src/scope-workspace.mjs`, `src/scope-draft-file.mjs` and `src/scope-draft-controls.mjs`; the other two proposed paths are README and focused source tests. The unchanged domain implementation remains `src/scope-plan.mjs`, `src/ledger.mjs` and `src/payment-status.mjs`. This receiver does not import any of those modules as its oracle.

## Actual browser route

Execution used existing native Chrome `154.0.8037.98`, Node `26.3.0` and Puppeteer Core `25.12.0` on Mac.lan. Each run launched a private temporary browser profile, a loopback server serving frozen source, and disposable browser contexts. Profiles were removed after each run. There was no signed-in browser session, provider call, payment operation, dependency download or installed-service mutation.

Desktop viewport was 1440 × 1000; phone viewport was 390 × 844. File selection and cancellation used actual native browser file choosers. Save used actual browser downloads, which were read back from the native filesystem. Controlled `File.arrayBuffer` promises exposed delayed success and failure at the real asynchronous file-reading boundary; application source remained unchanged.

## Baseline negative

[Baseline receipt](baseline-evidence/receipt.json) and [driver](receiving/check-scope-draft-files.mjs) record the original authoring behavior in both viewports: authored Unicode fields and a new blank row survive normal row addition, Save/Open controls are absent, and reload restores the fixture while losing the authored draft. The baseline driver exits 1 to represent that intended negative. It has no page error or fatal error. Baseline JSON files are observed DOM snapshots, not production downloads.

## Candidate functional receiving

[Full native receipt](candidate-evidence-v1/receipt.json), [driver exit/source preservation](candidate-driver-v1.json) and [executed driver](receiving/check-scope-draft-candidate.mjs) preserve the actual results.

| Boundary | Observed result |
| --- | --- |
| Save unfinished work | Actual downloads retain incomplete money/text, leading and trailing spaces, Unicode, LF textareas and a blank fourth checkpoint. Review still applies ordinary validation. |
| Reload and reopen | Reload clears the current session. Native Open previews the downloaded file without changing fields or input nodes. Explicit Replace restores every observed field. |
| Preview cancellation | Keyboard Cancel retains the current draft and returns focus to Open. Choosing the same file again succeeds. Native picker cancellation also retains all fields. |
| Deliberate keyboard route | Open, Cancel and Replace work through focused buttons and Enter; preview and reopened draft receive meaningful focus. |
| Refused imports | Thirteen files cover malformed JSON, unsupported version/schema, event-bearing envelopes, approval-bearing rows, non-fixture input, zero or 13 rows, non-text cap, CR textarea values, newline text-input values, invalid UTF8 and a file over 1 MiB. Each refusal keeps the original field values and input nodes. |
| UTF8 and JSON layout | UTF8 BOM plus CRLF JSON whitespace is accepted while LF field values remain exact through import and another actual download. |
| Size bound | A native file over 1 MiB is rejected before `arrayBuffer` is called. |
| Asynchronous interruption | Edits during an outstanding chooser or pending read prevent replacement. Newer file selection wins after an older success or error. Unreadable files preserve state and allow same-file retry. |
| Preview staleness | Typing, adding or removing a checkpoint invalidates a preview. Raw DOM value changes without an input event are also checked before replacement. |
| Review transition | Entering Review while a read is pending invalidates the import; a delayed read error cannot replace the review or its status. Edit draft remains intact. |
| Approval boundary | Imported drafts start with zero events and approvals. Unapproved review edits can be saved through Edit draft. After approval, file controls are absent and Edit is locked. Reopening a previously saved plan starts a fresh unapproved review. |

The full driver records five actual JSON downloads under `candidate-evidence-v1/downloads/`, including desktop and phone unfinished drafts, edits made before approval, and the BOM/CRLF roundtrip. Their byte lengths and SHA256 hashes are in the receipt.

## Preserved receiver correction

The full driver's eighteenth assertion required zero cross-origin requests. Its raw exit is 1 and its raw results remain **17 passed, 1 failed**. Every blocked request is the same exact Google Fonts stylesheet already observed in the baseline and present in unchanged `styles.css`; no literal HTML test URL was requested.

[Focused supplement](effects-evidence-v1/receipt.json) and its [executed driver](receiving/check-scope-draft-effects.mjs) then checked the meaningful boundary independently. There was one exact inherited font `GET` stylesheet request with no body before the file actions and still one afterward. Native import, preview, replacement, download and review added no external request. Local storage and session storage lengths were zero, IndexedDB database list was empty, and no service worker registration existed. Its sixth actual downloaded JSON retained the supplied fictional fields, 510 bytes, SHA256 `7d14455e8823c3f86f370f5c99091849288fab26b683817b457ce48b1b2e089b`.

[Corrected reusable full driver](receiving/check-scope-draft-candidate-corrected.mjs) records method, body and resource type and recognizes only that exact inherited stylesheet request. It is a syntax-checked reproduction aid; this archive does not present it as a second full executed suite. The focused supplement is the executed resolution of the failed assumption.

## Visual receiving

The receiver directly inspected all four native candidate screenshots: [desktop preview](candidate-evidence-v1/desktop-preview.png), [desktop reopened](candidate-evidence-v1/desktop-reopened.png), [phone preview](candidate-evidence-v1/phone-preview.png) and [phone reopened](candidate-evidence-v1/phone-reopened.png). The preview visibly leaves the current editable draft beneath it, labels replacement explicitly, displays unfinished status and literal HTML, and keeps Save/Open and replacement controls legible. Measured page widths were exactly 1440 and 390 pixels, with no horizontal overflow. Phone replacement/cancel controls stack within the panel.

External fonts were blocked during these isolated runs, so the screenshots qualify the page using its existing fallback fonts. They are actual browser captures, not generated images or a final cross-browser aesthetic approval.

## Reproduction

Use an existing supported Chromium and Puppeteer installation. Set `SCOPESIGNAL_SOURCE` to the intended frozen source directory, `SCOPESIGNAL_EVIDENCE` to a new isolated output directory, `SCOPESIGNAL_CHROME` to the executable, and `SCOPESIGNAL_PUPPETEER` to the Puppeteer entry. Run the chosen driver with Node. The driver serves only that supplied source over its own loopback port and blocks external page requests. Use separate output directories for baseline, full candidate and the focused supplement so raw receipts remain distinct.

The baseline driver deliberately exits 1 when the original missing-feature behavior is reproduced. The executed original candidate driver also exits 1 for the preserved broad network assumption; use the focused receipt to assess its correction, or the corrected reusable driver for a future full run. Browser profiles are temporary, and only the driver's own profile is removed.
