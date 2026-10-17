# Expand or collapse the shown saved-record events

The isolated [issue 82 source offer](https://github.com/Jacob-Met/scopesignal/blob/dcad391d11a66a43df32ae1051a48c5ebd22ff34/src/record-event-filter.mjs) adds **Expand shown events** and **Collapse shown events** to ScopeSignal's existing saved-record filter. A reviewer can open every matching event together while keeping hidden events' earlier open or closed state.

[Download the review kit](https://drive.google.com/file/d/1SYgZt9kTD9Jp2vTvv54Pts3k6WTxd69o/view), extract it, and follow its `OPEN_FIRST.md`. Its maintained local entrypoint is `record.html`, served with Node 24 or newer from the extracted folder. The [maintained guide](https://github.com/Jacob-Met/scopesignal/blob/dcad391d11a66a43df32ae1051a48c5ebd22ff34/docs/record-event-search.md) explains matching and opening. This source checkpoint establishes the implementation and focused checks; real browser receiving is a separate pending course.

## What changes

The two ordinary buttons update the existing disclosures for the last successfully applied visible list. They preserve hidden open states, event order, raw saved fields, search and select values, record totals, and the complete-record download. They are disabled when no events are shown. An overlength programmatic query retains its existing error and last applied list; the buttons operate on that list. A polite status reports the affected count, and a successful filter change clears that action message.

**Show all events** keeps its existing filter reset and focus behavior. Opening or clearing a record still uses the unchanged viewer lifecycle. The new handlers retain their own rows, so detached controls cannot change a later view.

Exactly three product paths changed from the accepted literal-search offer `10f6233dcc5157afdf0e31371e59eb4fccda0d35`:

| Path | Purpose |
| --- | --- |
| [src/record-event-filter.mjs](https://github.com/Jacob-Met/scopesignal/blob/dcad391d11a66a43df32ae1051a48c5ebd22ff34/src/record-event-filter.mjs) | Two buttons, visible-row disclosure actions, and status/disabled state. |
| [tests/record-event-disclosure-controls.test.mjs](https://github.com/Jacob-Met/scopesignal/blob/dcad391d11a66a43df32ae1051a48c5ebd22ff34/tests/record-event-disclosure-controls.test.mjs) | Four focused groups and the complete literal fictional example. |
| [docs/record-event-search.md](https://github.com/Jacob-Met/scopesignal/blob/dcad391d11a66a43df32ae1051a48c5ebd22ff34/docs/record-event-search.md) | Usage and a clear distinction between new issue 82 checks and prior issue 80 receiving. |

## Original focused result

One captured Node invocation ran the new four groups and the unchanged four literal-search groups. It exited normally with **8 passed, 0 failed, 0 skipped**, empty stderr, and no capture observer errors. The direct child elapsed time was about 0.215 seconds within a 30-second capture limit. The complete [REQUEST](focused/REQUEST.json), [PROCESS](focused/PROCESS.json), [stdout](focused/stdout), [stderr](focused/stderr), and [original outer response](focused/start.json) are retained once.

The new groups check visible/hidden mixed states; reference identity and complete JSON/export conservation; invalid-query last-view behavior; no matches and empty histories; reset and repeated actions; independent old/new panels; and all 512 admitted events with duplicate receipts. The full manually stated eight-event record is admitted by the maintained reader, including its redundant totals and checkpoint facts. [The independent source review](reviews/machine-source-review.json) and [original result acceptance](reviews/root-focused-result-review.json) distinguish these checks from a browser run.

The declared small DOM harness observes properties, listeners, node identity, visibility and focus ownership. It does not establish browser layout, native keyboard or file-chooser behavior, or an accessibility audit. No broad unrelated test suite was replayed.

## Try the fictional example

Use [shown-events.fixture.json](examples/shown-events.fixture.json), which is exactly the literal complete record admitted in the new tests. It contains eight events and no payment evidence.

1. Open event 1 manually.
2. Search for `CAP-SHOWN-001`; events 5, 6 and 7 remain shown.
3. Expand those shown events, then collapse them.
4. Choose **Show all events**. Event 1 retains its earlier open state.

Intersect the query with **Webhook received** to show events 5 and 6. Searching `true` with that type shows event 6, whose saved duplicate marker is true. The complete record still counts the capture once: 40,000 integer cents captured and 80,000 remaining out of 120,000. These figures are fictional fixture facts, not transactions.

## Complete expected download

After the focused capture, one separately authorized invocation of the unchanged maintained reader/exporter created [the complete expected HTML](reference/scopesignal-record-review.html) from that exact example with file label `shown-events.fixture.json`. Its original [request](reference/REQUEST.json), [process](reference/PROCESS.json), [stdout](reference/stdout), [stderr](reference/stderr), [outer response](reference/start.json) and [small generator](reference/generate-review-reference.mjs) are retained.

The expected HTML is **13,519 bytes**, SHA-256 `414e1212721e42d8cd827167090cf446ed5dd2f039f1538d636392bf4c7e52f4`. It contains all eight original events. It is a reference for the separate actual browser download comparison, not a claimed browser download. The source publication/reference [root review](reviews/root-publication-review.json) accepted this distinction.

## Source provenance and publication boundary

The source offer is commit `dcad391d11a66a43df32ae1051a48c5ebd22ff34`, tree `bf8910efa55be40da9a872823f02be5195b2a6f6`, on `estate/e1438-shown-event-fields-82`. Fresh readback compared all three whole remote bodies and the complete 835-leaf tree, preserving all 832 unselected predecessor leaves. [The publication receipt](source/source-publication.json) and [genuine verification process](source/source-publication-process.json) record that join. Product bodies remain at the immutable source links above and are not duplicated in this evidence directory.

The default branch remained `paypal-ai@a8e7ab95e5b9dd4c93fd06a776391d57d81a9515`. No pull request, default merge, Pages change or Actions dispatch was created. The existing default/Pages/Actions hold remains. Earlier issue 80 native and browser results stay historical; they do not validate the new buttons.

A publication wrapper initially expected a tree object in the commit-creation response, although that connector returns only a SHA. It stopped before any branch creation. [The preserved note](source/commit-response-note.json) records the unavailable first unreferenced response and the same-request successor. The final commit's complete fetched parent and tree were checked before creating the one isolated branch. No source or product run changed because of that reader error.

The guide's one-paragraph [result projection](source/guide-result.patch) followed the accepted focused capture; code, tests and executable dependencies stayed unchanged. [SOURCE.json](SOURCE.json) maps the whole evidence bodies and their original inputs. Kit delivery and actual browser receiving have their own accounts; this checkpoint makes no installed-runtime or real-browser claim.
