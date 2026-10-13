# Filter a saved fixture record's events

Open `record.html` through the existing local ScopeSignal server and choose a version 1 fixed-fixture record JSON file. The raw recorded-event history now has **Checkpoint** and **Event type** selectors. Combine them to show only that checkpoint's matching recorded events; **Show all events** restores the complete list and focuses the checkpoint selector.

The count says how many of the record's events are visible. The original sequence numbers, order, exact saved JSON and open event disclosures are preserved, including duplicate webhook receipts. The event-type selector groups ordinary and duplicate webhook receipts under their shared recorded type. Their distinct existing row labels and exact fields remain visible.

Filtering changes only the raw event list. The summary and checkpoint outcomes above it still describe the full admitted history. A combination with no matching events does not mean the file has no approvals or captures. Printing retains the selected list and its descriptive count; keep the original JSON to retain every event.

A refused file selection or a canceled picker keeps the current record, filters and disclosures. A valid replacement starts with all of its own events visible. Clear removes the display and retires pending file reads. Loading a file does not restore an active workspace, run payment actions or save browser state.

## Source and receiving boundary

This addition preserves the existing strict record reader, fixture exporter, ledger and file-selection generation fence. It is separate from the selected-prefix history proposal in issue #56 and the repeated-JSON-field admission proposal in issue #70. No provider service or payment operation is involved.

The scoped native browser receiver and exact original/candidate receipts are preserved under `docs/receiving/record-event-filter-2766b0fc/`. Native receiving uses authored fictional records. Its opening notes identify the tested source and runtime; source publication alone is not a deployment or installed-version claim.
