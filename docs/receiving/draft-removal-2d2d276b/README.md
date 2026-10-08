# Draft checkpoint removal recovery — native receiving

## Contributed behavior

Source contribution `b2dccc7e6c47b3f6b5d6f49e1858725eb3a099ea` builds on
`847505d2fe9f8295110fc13a3fb9e05ec71f6644` (`paypal-ai`).

The unapproved draft has a single-use **Undo removal** control. It restores the
most recently removed checkpoint at its original position, retaining all three
raw strings and later edits to the remaining draft fields. Successful add,
duplicate, move, review and workspace replacement retire recovery; a newer
removal replaces the previous recovery. Ordinary text edits, downloads,
inspecting/canceling an open preview and failed validation preserve it. Undo and
removal use the existing replacement invalidation. Nothing is added to the saved
workspace format or payment ledger.

The product change is the new `src/scope-draft-removal.mjs`, bounded controller
hooks in `src/scope-workspace.mjs`, and one control/help block in `scope.html`.
The existing validation, codec, ledger, provider, comparison and export modules
are unchanged. Reviewed-event history is separately owned.

## Executed qualification

| Receiving | Result | Exact retained record |
| --- | --- | --- |
| Original Node 24.21.0 suite | 155 pass, 0 fail/skip | `baseline-node24.log` |
| Candidate Node 24.21.0 suite | 163 pass, 0 fail/skip | `candidate-node24.log` |
| Original native Chrome 154.0.8037.98 | Exact filled middle-row removal preserved survivors; no Undo control existed | `baseline-browser.json`, `baseline-receiver.mjs` |
| Candidate native Chrome 154.0.8037.98 | All 9 receiving groups passed | `candidate-browser.json` |
| Phone view | 390 × 844; Space activates Undo, focus returns to restored row, no horizontal overflow | `phone.png` (visually inspected) |

The candidate browser groups cover exact raw restoration and later survivor/
project edits, one-use recovery, add/copy/move retirement, newer removal,
last-row protection, failed validation and successful review, two actual JSON
downloads admitted by the unchanged decoder, preview/cancel preservation,
explicit replacement, undo during a delayed file read, the 12-checkpoint limit,
and keyboard/phone behavior. No page exceptions were recorded. The inherited
Google Fonts request was blocked; page traffic stayed on the ephemeral
loopback receiving origin.

The Node logs are retained in their original PowerShell UTF-16LE encoding.
The browser receipts carry the original source SHA-256 pins and runtime version.
The source-correspondence record binds the unchanged executed product modules
to the contribution commit. README command guidance was added after the native
runs; this is not a claim that every documentation byte was executed.

The maintained receiver is `scripts/check-scope-draft-removal.mjs`. It uses
Node's built-in WebSocket and an installed Chrome/Chromium. It starts a fresh
headless profile and a temporary loopback server; no dependency was installed
and no browser protection was disabled. Example:

```sh
SCOPESIGNAL_CHROME=/path/to/chrome node scripts/check-scope-draft-removal.mjs . /path/to/new-output candidate
```

Choose a new output directory for each run. The original source can be received
with `baseline` instead. The two downloaded files below are fictional
workspaces; they record no real approval or payment.

## Earlier receiver failures are preserved

1. The initial pointer receiver read coordinates during smooth scrolling and
   missed Remove. `baseline-initial-scroll-failure.json` and
   `initial-scroll-receiver.mjs` retain that failure. Instant scrolling plus
   two animation frames produced the original-source witness, without an app edit.
2. The first candidate receiver omitted the text portion of the native Enter
   event, so it did not activate the focused button. Its source and failure are
   `candidate-key-receiver.mjs` and `candidate-key-event-failure.json`.
   Adding the normal Enter/Space text fixed the input sequence; product bytes
   were unchanged.
3. The next receiver expected duplicate filenames to increase the number of
   saved files, but CDP's download behavior reused the pathname.
   `candidate-download-receiver.mjs` and
   `candidate-download-name-failure.json` retain the failed count expectation.
   The final receiver directs the two real downloads to distinct directories
   and verifies both byte sequences through the unchanged workspace decoder.

These are receiver corrections, not hidden product failures. Their original
files have not been rewritten. The final 9-group browser result is a distinct
run, not an aggregation of earlier partial passes.

## Custody and limits

`manifest.json` records all fourteen original transferred evidence files,
their sizes and SHA-256 values (177,565 bytes total). Native transfer checked
each decoded byte sequence before writing it to this repository.

This packet establishes the isolated product behavior. Independent review,
current-parent integration, hosted CI and public delivery have their own
receipts; none is inferred from this local run.
