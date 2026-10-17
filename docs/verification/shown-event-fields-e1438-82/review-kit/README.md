# ScopeSignal shown-event review kit

The [review kit on Google Drive](https://drive.google.com/file/d/1SYgZt9kTD9Jp2vTvv54Pts3k6WTxd69o/view) contains the reviewed **Expand shown events** and **Collapse shown events** controls, a complete fictional eight-event record, and the maintained local server. One fresh download matched the entire original ZIP and all 54 files.

Start with [OPEN_FIRST.md](package/OPEN_FIRST.md). The kit is pinned to the isolated [source offer dcad391d](https://github.com/Jacob-Met/scopesignal/tree/dcad391d11a66a43df32ae1051a48c5ebd22ff34). The repository default, Pages deployment and workflow configuration were not changed.

## Open and use it

Extract the whole ZIP into a new folder. With Node.js 24 or newer available, open a terminal in that folder and run:

```sh
node scripts/serve.mjs
```

Open **http://127.0.0.1:4173/record.html**, then choose `examples/shown-events.fixture.json`. Keep the terminal running while using the viewer and stop it with **Ctrl+C** afterward. The server uses its current working directory; there are no external package dependencies to install. Direct `file:` opening is not the supported module route.

Open event 1, then search for `CAP-SHOWN-001`. Events 5, 6 and 7 remain shown. The new buttons expand or collapse only those three existing disclosures. **Show all events** reveals event 1 still open. Selecting **Webhook received** narrows the capture query to events 5 and 6; replacing the query with `true` leaves event 6. A no-match query disables both batch buttons while **Download record review** continues to describe the complete eight-event record.

All approvals, captures, provider event names and amounts in the example are fictional. Filtering and disclosure actions do not change the source JSON, full-record totals or complete reading-copy download.

## What the package contains

| Scope | Count |
| --- | ---: |
| Complete files in the ZIP | 54 |
| Maintained source files joined to the source-offer Git tree | 51 |
| Manually stated fictional example | 1 |
| Opening guide and source manifest | 2 |
| Total uncompressed payload | 331,731 bytes |
| ZIP size | 338,191 bytes |

The 51 maintained files include the record viewer, fixture-demo index, its linked scope authoring/comparison/CSV/library pages, their finite local module and style dependencies, the server, package metadata, license, final usage guide and both focused test modules. Among the 48 recovered runtime/server/license files, only the event-filter module changes. The other 47 retain their complete immutable predecessor bytes.

Including the linked pages preserves the existing brand/footer navigation. Their broader workflows are retained source, not newly tested feature claims. The saved-record viewer uses local code and system fonts. The unchanged demo stylesheet also references Google Fonts with installed-font fallbacks; the source-navigation link opens GitHub.

[The package source manifest](package/SOURCE.json) records every other member's byte length, SHA-256 and Git blob identity, including the 51 exact source-tree joins. The fictional JSON equals the complete literal used by the new focused test.

## Source and verification

Source offer **dcad391d11a66a43df32ae1051a48c5ebd22ff34**, tree **bf8910efa55be40da9a872823f02be5195b2a6f6**, succeeds the immutable issue 80 offer **10f6233dcc5157afdf0e31371e59eb4fccda0d35**. Its only three product paths are the filter module, new disclosure test and narrow maintained-guide change. The held default remains **a8e7ab95e5b9dd4c93fd06a776391d57d81a9515**.

One original focused Node capture passed eight groups: four new disclosure controls and four maintained literal-search controls. These checks cover complete record admission, existing node and saved-field preservation, visible/hidden open states, invalid-query last-view behavior, reset and replacement isolation, complete exports and the 512-event boundary. The [source validation account](https://github.com/Jacob-Met/scopesignal/blob/5dc4529d853946f4ad7489ac4bdbd2732afd2bbd/docs/verification/shown-event-fields-e1438-82/source/README.md) retains the original captures and independent reviews of that controlled-DOM/model scope. The [maintained guide](package/docs/record-event-search.md) separates the earlier issue 80 browser receiving from these new controls.

The [kit preparation](source/kit-preparation.json) joins the fixed 54-file selection to that verified tree. An [independent package review](reviews/source-package-review.json) read the complete opening guide, manifest, wrapper and unbound receiver, and checked their whole donor inverses. One ZIP_STORED wrapping then produced the archive below. No source build, module, server, test or browser was invoked by the packaging or delivery work.

## Exact delivery

- File: `ScopeSignal-Shown-Events-dcad391d.zip`
- SHA-256: `5b86a8b3e222d4fe0588eb94ac0d779e2a78ebbdd801a9e083f940d374ed2d7b`
- Git blob identity of the ZIP bytes: `a36f8a2e9d272e1c55cb0254868eb8b3e6b7c9f0`
- [Package manifest](package/package.json)
- [Original ordinary receiving proof](delivery/package-delivery.json)

The receiver made one bounded HTTPS request for the newly uploaded file and compared the complete fresh bytes to the original archive. It then checked sorted root-relative names, all CRCs and fixed ZIP metadata, every complete member, all 53 nonself source-manifest rows and the 51 source Git identities. The completed process exited 0. An [independent review of that same fresh archive](reviews/root-delivery-review.json) accepted all 54 complete members and their original payload equality without another fetch. No extraction, alternate transfer route, repeated fetch or product invocation was needed.

The packaged opening guide and source manifest remain the exact preparation snapshots, where transfer and new browser receiving were pending. This account and the original delivery proof close the transfer portion. Actual browser keyboard, layout and download receiving for issue 82 remains a separate pending scope at this checkpoint; it is not inferred from the earlier issue 80 course or the controlled-DOM tests.

