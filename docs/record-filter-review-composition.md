# Filter saved events and download the complete record

With a complete ScopeSignal checkout and the existing Node.js 24 or later runtime, run:

```sh
npm run serve
```

Open the printed local address followed by `/record.html`, then choose the original version 1 fixed-fixture JSON file.

Use **Checkpoint** and **Event type** to narrow the event list. Both selections must match. Original sequence numbers, saved order, duplicate webhook rows and open event disclosures remain intact. The totals and checkpoint outcomes above the list always describe the complete admitted record.

Choose **Download record review** to save `scopesignal-record-review.html`. This downloads the complete admitted record, including events hidden by filters. A selection with no matching events still permits the same complete download. The literal file label, evidence, every event field and source event order are retained. Open the downloaded HTML directly in a browser for offline reading. Keep the original JSON to reopen the interactive viewer.

**Show all events** resets both selections, restores every event and focuses the checkpoint selector. Existing open disclosures remain open. A refused replacement retains the displayed record and its filters; a valid replacement starts unfiltered. **Clear view** removes the displayed record and its download control.

Printing the interactive viewer follows the existing filter guide: it retains the selected list and descriptive count. The downloaded standalone review contains the complete record. This composition does not repeat print qualification.

## Focused combined package

For the received nine-file viewer without a complete checkout, use the [combined package and opening instructions](receiving/filter-review-composition-dcac8b3b8755/README.md#open-the-received-interactive-viewer). Extract the entire ZIP, run `node open-record.mjs` with an existing Node.js 24 or later runtime, open its printed address, and choose `fixtures/mixed.json`. Stop it with Ctrl+C in its own terminal. The package retains the full-record download; its full-demo links intentionally lead outside the focused viewer and return a 404 note.

## Source and receiving

This joins the accepted event-filter contribution in [issue 73](https://github.com/Jacob-Met/scopesignal/issues/73) with the complete-record HTML download adopted through [PR 76](https://github.com/Jacob-Met/scopesignal/pull/76).

The received composition is `86d6c39dc219aa34285f66c91545103ffff2daa3`, tree `1f6f61e604d37e85fe4377e5922bdd382c3d1dcf`. Its parents are current default `115128bf8d8f20395accc04eaf7ad4f8e428c193` and filter owner `e8de5960ba74f823feb72df73af1de6857981752`. The original owner `2766b0fc4581` and all historical evidence retain their attribution.

Only `src/record-view.mjs` and `record-view.css` need composition. The viewer keeps both imports and their separate heading and event-list mounts. The CSS keeps both exact namespaced suffixes after the unchanged shared prefix. Removing either contribution reproduces the other accepted source byte-for-byte. All 25 owner-added paths and 766 other current tuples remain exact. The strict reader, ledger, fixture exporter, HTML exporter and download controller are unchanged.

The [composition receiving index](receiving/filter-review-composition-dcac8b3b8755/README.md) separates the new combined browser result from the earlier filter and HTML-review courses. It records actual downloads, source identities, custody and the scope of the review.

See the unchanged [event filter guide](record-event-filter.md) and [HTML review guide](record-review.md) for each behavior contract. The historical focused filter package under `docs/receiving/record-event-filter-2766b0fc/package/` remains pinned to its original seven-file viewer; it is not the opening route for this combined source.

These are unsigned synthetic fixture records. The viewer does not restore a payment workspace or execute payment actions. Source receiving is not a deployed website, installed release, complete offline package, physical mobile, assistive technology, live payment or provenance qualification.
