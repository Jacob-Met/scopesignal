# Saved fixture record viewer — native receiving

Owner: estate-39c2b591d7e5 / runtime_review. ScopeSignal issue #11.
This packet accompanies a new user-facing saved-record inspection workflow.

## Accepted product behavior

The existing fixture can download the reviewed approval but the original page has no way to inspect that file. The new navigation opens a separate local viewer, preserving the active fixture tab and its unapproved draft. A chosen file is admitted as the existing fixed-fixture version 1 format and rendered as recorded totals, checkpoint approvals, exact accepted evidence, recorded capture states and complete event fields.

The reader uses the existing fixture exporter and the independently reviewed shared ledger. It does not implement a second payment state machine. It checks file size, event count, exact object fields, scalar payload types, ordered sequence markers and all saved facts against the derived record. It preserves the previous accepted display on malformed, inconsistent, unsupported or unreadable files. Later selections supersede earlier reads; Clear view also cancels a pending read. All rendered file values use textContent.

The supported limits are 1 MiB of UTF-8 JSON and 512 events. Unknown and pending capture outcomes remain distinct from recorded capture. The viewer is read-only, has no external assets or storage writes, and does not restore an active ledger. Its unsigned synthetic records do not prove identity, approval or payment.

## Exact source and ownership

- Original default: 31d683e35e4a70065a514cc459eb83d8ffc573ca.
- Required ledger owner contribution: PR #8, head d5e47b431288c4f9642ecadc1b33d4a94498e153.
- Required ledger blob: beb94176ae3b1a2f29890c5752e47c25694f01f0.
- Own clean composition of those public sources: d5f50bb37711b043214da832f880abafe00af8e6.
- New product source commit: d9ed1762bf1b90e848e745bd8edcfd792b543823.
- Product source: /Users/me/hamon-scopesignal-records-39c2b591d7e5.
- No ledger, exporter, active authoring page or author-owned checkout was changed by this lane.
- PR #8 ownership remains estate-06e2ad0ce13f. The editable scope page in #9/#10 remains separately owned.

The browser ran immediately before the product source commit. Its receipt records the then-current composition HEAD and every actual served file's SHA-256. source-receipt.json verifies that all served bytes are identical to the committed product source. The sourceCommit field in the raw browser receipt is therefore its checkout base, not a claim that uncommitted viewer files existed in that older commit.

## Native observations

Host: Mac.lan, arm64. Node v26.3.0. Chrome 154.0.8037.98.
Puppeteer Core 25.12.0 was read from an existing native installation. The browser used a fresh disposable profile and fresh desktop/phone contexts; no signed-in session or service was used.

| Gate | Observed result |
| --- | --- |
| Original full Node suite | 26 passed |
| New reader model tests | 11 passed |
| Composed full Node suite | 59 passed; zero failures/skips/cancellations |
| Original source with the same browser receiver | Actual edited approval download succeeded; navigation assertion failed because the viewer is absent |
| Candidate actual Chrome receiving | All 21 desktop/phone checks passed |
| Old-ledger dependency negative control | The unchanged reader/test fails with “Missing expected exception” after only the shared ledger is replaced by the original source |
| External requests from the viewer | Zero |
| Browser script errors | Zero |

The dependency control is substantive: the old reducer admits a self-consistent saved file assigning an approval to bot. The exact #8 ledger rejects it through the same reader before display. No ledger guard is duplicated in the new reader.

Both desktop and phone downloaded the same 3,912-byte file from the production Download fixture record button. Its SHA-256 is 0e1528a6dea485c467fba8a522f54603ab298f3fa872c1dd70ffda24276e4c70. The original default produced those identical bytes too. The actual artifact is retained as actual-fixture-record.json.

The browser then selected that real file with the native file picker and verified the edited multiline Unicode evidence, literal HTML-looking text, eight exact event objects, two recorded approvals, $400 recorded captures and $800 remaining. The malicious-looking evidence remained text; no injected node, script or external image request appeared.

The receiver also exercised incomplete JSON, altered totals, unsupported versions, contradictory approval history, invalid UTF-8, a file over the byte limit and an injected file-read rejection. Every refusal kept the same previous title node and record. The oversized file was refused before its arrayBuffer method ran. Re-selecting the same file, canceling the picker and clearing the view remained usable.

Controlled delayed file reads established that an older read cannot replace a later valid record, supersede a later refused selection or reopen a cleared display. Keyboard checks cover opening the picker, tab order, jumping to the record, opening an event and clearing. A six-event record remains unknown and counts zero; the real saved download can be reopened after reloading the viewer. The original fixture tab retains its eight events and unapproved draft throughout.

Native screenshots at 1440×1000 and 390×844 were visually inspected. Text wraps without horizontal overflow, the exact evidence remains readable, totals are grouped coherently and native event disclosure controls have visible focus.

## Files and reproduction

- source-receipt.json binds source pins, product files and served bytes.
- baseline.json and baseline-node.stdout retain the original source run.
- candidate-node.stdout, node-gates.json and old-ledger-negative.stdout retain the full candidate and exact dependency control.
- baseline-browser/receipt.json retains the expected original feature failure.
- candidate-browser-r1/receipt.json retains all 21 actual browser checks.
- candidate-browser-r1/desktop-record.png and phone-record.png retain the inspected renders.
- actual-fixture-record.json is the actual browser download, not a hand-authored substitute.

Run the repository's existing npm test for all Node tests. The portable browser receiver is scripts/check-record-view.mjs; set SCOPESIGNAL_PUPPETEER and SCOPESIGNAL_CHROME to an existing Puppeteer Core module and Chromium executable. SCOPESIGNAL_SOURCE and SCOPESIGNAL_EVIDENCE choose source/output directories. It installs nothing and uses an ephemeral loopback server.

No hosted PR test run or deployment is inferred from these native results. The current repository workflow tests and deploys Pages on a default-branch push; merge/deployment disposition remains with the existing receiving owner. The new viewer is tested in Chromium on native macOS, not as a Safari, Firefox or screen-reader certification.

## Current default composition

Before publication, the default advanced to 5d8b9ae344c96db3a357da87472c553485daaaf3 through merged scope-authoring #10. A separate own publication worktree composes it with the accepted reader and exact #8 ledger at 29c65040103a2fe9d1abd730838dc94c18df2837. Both additive README sections were retained verbatim. The current app.mjs is unchanged; index.html is exactly the current default plus the one saved-record navigation link. All six new viewer feature/test/receiver files are unchanged from d9ed1762bf1b90e848e745bd8edcfd792b543823.

The current composition passes all **73 Node tests** and all **21 actual Chrome desktop/phone checks**. This additional bounded run qualifies the changed entry page and the newly merged authoring tests. It does not repeat the independently completed ledger behavior review. The current actual download is byte-identical to the earlier saved artifact. current-default/source-receipt.json binds every served byte to the committed current source; its screenshots identify whether they match the earlier visually inspected images. Current receipts are retained under current-default/.

## Final upstream movement

Default 1e09495df6b79f96e1c32694969edd3ef2f45308 subsequently merged PR12: the disconnected Workers AI adapter, 15 tests, receiving evidence and a new pull_request-only Node24 test workflow. Every one of the 14 actual viewer-served source leaves remains byte-identical to the current Chrome receiving source. A clean native source composition passes **88/88 Node tests**; the prior21 browser checks remain applicable to these exact unchanged served bytes. final-upstream.json and final-node.stdout retain that comparison and run. The older no-PR-test statement above describes the earlier workflow; the preserved new workflow now runs npm test for pull requests and does not deploy Pages.
