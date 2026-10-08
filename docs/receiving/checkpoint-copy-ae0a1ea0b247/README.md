# Draft checkpoint duplication — source and receiving evidence

ScopeSignal issue [#27](https://github.com/Jacob-Met/scopesignal/issues/27). Authored by estate-ae0a1ea0b247/coordination_review against native `paypal-ai` commit `bab391c7c6fec1193e221997e4d66d89bd914cfd` (complete tree `328092ddb109dd75ecf750f2cdf4fd564143d3ed`).

## User behavior

Each editable checkpoint has **Duplicate checkpoint**. It copies the current raw deliverable, amount and evidence into an independent next row, focuses the new deliverable, and announces the new position. Empty or unfinished text remains editable. Copying counts toward the existing twelve-checkpoint limit and the existing budget validation. Final review still assigns ordered distinct checkpoint identities. Copying is a workspace edit, so an earlier prepared file preview or pending read cannot replace that newer draft. Review/approval locking and the existing event rules are unchanged.

The production delta is 23 added lines in `src/scope-workspace.mjs`, draft help in `scope.html`, and README usage. The model, ledger, workspace format, provider paths, package files and workflows are untouched. The neighboring revision-export work in issue #26 and comparison work in issue #21 retain their own scopes.

## Qualification and honest run history

- The unchanged baseline ran first with one existing-behavior control passing and four feature cases failing because the Duplicate checkpoint action did not exist.
- The initial candidate ran the same receiver: four cases passed. The final case stopped on a receiver fixture-path error (`ENOENT: downloads/01-original-workspace.json`). The receiver had replaced its absolute saved-file path with a relative report path; this was not a product exception.
- Only that receiver helper was corrected, and an optional validated case selector was added. The previously unqualified fifth case then passed against the exact same three production blobs. This is four original candidate passes plus one focused follow-up pass, not a claimed fresh five-case rerun.
- The native `node --test` suite passed **124/124**, with no failures or skips. Whitespace checking passed. All 43 pinned execution inputs were unchanged during each browser run.
- Chromium was **153.0.8010.0**. These are real local-page, keyboard, narrow-viewport and native file/download observations using authored fictional data. Existing Google Fonts requests were blocked and recorded; the installed fallback font was exercised. No provider, payment, account or live-service operation was performed.

`author-original/` preserves all 26 original packet files exactly, including the native source before-images, original receiver, baseline and candidate receipts, first fixture error, logs, downloads, and source manifests. The original 63,365-byte tar.gz had SHA256 `d90f7c36f65a400e9272e09a43924f0c8657125bbc1b8f18de862d9134d4e068`; raw file hashes are preserved by its own `MANIFEST.json`. Its local Git pins describe a partial executable source snapshot, not a complete upstream commit.

`author-followup/` preserves the corrected receiver and its focused passing receipt, real file bytes, execution rationale and exact source pins. The maintained script is byte-identical to `author-followup/author-receiver-corrected.mjs`.

The earlier `ENOSPC` reservation failure and ephemeral per-command `/dev` lifetime failure occurred before browser execution. They are retained in `author-original/environment-attempts.json` and are not represented as product failures. The original evidence was hash-verified in a preallocated shared buffer before the ephemeral execution directory ended; the follow-up was retained as exact UTF-8 members with byte and Git-blob hashes.

## Reproduction

Run the ordinary repository suite with `npm test`. With an existing Playwright installation and Chromium, run:

```sh
SCOPESIGNAL_PLAYWRIGHT=/absolute/path/to/playwright \
SCOPESIGNAL_CHROME=/absolute/path/to/chromium \
node scripts/check-scope-checkpoint-copy.mjs
```

The receiver serves the repository locally. `SCOPESIGNAL_SOURCE` selects a different source directory, `SCOPESIGNAL_EVIDENCE` selects its output directory, and `SCOPESIGNAL_PINS` accepts the preserved `source-pins.json` map. The default runs all five groups; `SCOPESIGNAL_COPY_CASE=5` selects the focused follow-up. The native baseline can be reconstructed from its exact upstream commit, or by restoring the three preserved before-images into the otherwise unchanged execution closure. The raw original failure is reproduced with `author-original/author-receiver.mjs`.

The browser receiver delays only delivery of already-completed native `File.arrayBuffer()` reads for its own named fixture files; it does not synthesize their bytes. Narrow Chromium viewports do not establish physical-device or screen-reader behavior. A direct disabled-control dispatch is explicitly labeled in the author receipt.

## Independent source and consumer receiving

The root reviewer independently accepted the exact three product blobs and unchanged eight other runtime inputs. Four candidate browser groups passed with seven actual downloads, no page errors and all ten input pins unchanged. The independently captured 390-pixel layout was visually accepted, including the focused copied deliverable and readable row controls. The original native raw-draft/download/no-copy control passed with one actual download.

The original reviewer run then stopped on an overly broad zero-external-request assertion because the unchanged page requested its existing Google Fonts CSS. That original receiver and receipt are retained. The corrected receiver allows and records only that exact blocked native URL; candidate assertions stayed unchanged and the fallback-font layout was tested. The independent contract was frozen before candidate source inspection.

`independent-copy/` preserves all 32 original peer members; `independent-copy-final/` preserves all 18 final peer members, including the actual JPEG screenshot and downloads. `independent-review.json` is the reviewer's exact native source-bound ACCEPT receipt. `archives/` additionally retains the original author and both independent tar.gz byte streams with their original hashes.

Normal native PR checks and the actual-parent merge readback bind source integration separately. `verification.json` records all contribution bytes except itself. This is the bounded product implementation and receiving scope claimed in issue #27; no estate lease or native runtime placement changes are included.
