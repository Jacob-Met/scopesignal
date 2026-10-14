# Find an event in a saved fixture record

Open `record.html`, choose an existing ScopeSignal fixture-record JSON file, then use **Search saved event values** above its event list. Search for an acceptance-evidence phrase, a capture ID such as `CAP-JOURNEY-001`, or another literal saved value. Combine the search with **Checkpoint** and **Event type** to narrow the same list.

The result count always shows matching events out of the complete recorded history. Original sequence numbers stay in order. If an open disclosure is hidden by a filter, it is still open when shown again. **Show all events** clears the search and both selects, then focuses the checkpoint control.

The summary, checkpoint outcomes and **Download record review** always describe the complete admitted record. A no-match list does not mean an empty record or an absence of recorded approval. Downloading while no rows match still includes every original event and saved field. Keep the original JSON to reopen the interactive viewer; the HTML download is the unchanged complete reading copy.

## Literal matching

Search is case-insensitive in the precise JavaScript lowercase-substring sense. It examines each saved scalar value separately: string contents, number spelling, or `true` / `false`. It does not search field names, derived labels or checkpoint display titles. Select a checkpoint by its existing control when that is the intended restriction.

| Query | Meaning |
| --- | --- |
| `cap-journey-001` | Matches that substring in a saved capture identifier, regardless of letter case. |
| `true` | Can match a saved duplicate marker; it is not a special Boolean query operator. |
| `40000` | Matches saved integer-cent values or any other value containing those digits. It is not a numeric range. |
| `a.*b` | Matches the literal four-character text. No regular expression is evaluated. |
| `acceptedEvidence` | Does not match merely because that is a field name. It must occur in a saved value. |

Spaces and accents are preserved. There is no trimming, word splitting, Unicode normalization, accent removal, cross-field joining, or linguistic full case folding. Composed `é` and `e` followed by a combining accent are different. A leading space is part of the query. An actual saved newline is different from the two characters backslash and `n`. The pure matcher can receive an actual newline query, but the browser's native search input sanitizes line breaks. That newline case is an API control, not a typed browser-search claim. Text is rendered through `textContent`; markup-like evidence is not interpreted as HTML.

The limit is 256 UTF-16 code units, matching the native input's `maxlength`. Most ordinary characters use one unit; a supplementary character such as an emoji usually uses two. A programmatically assigned longer query shows an error and retains the last applied visibility/count. Repair it or choose **Show all events**. Empty histories keep the search and both selects disabled.

## File lifecycle and scope

The existing saved-record reader continues to admit the entire file before display. Its version, size, event count, redundant facts and fictional ledger rules are unchanged. An invalid or stale replacement leaves the current view and filters intact. A successfully opened new record begins with all events visible; **Clear view** removes the current record and controls.

This is a read-only filter of a synthetic fixture record. It does not alter files, persistent storage, approvals, captures, payment state, source records or the existing HTML exporter. It does not call PayPal or another external provider and does not establish evidence of a real transaction.

## Maintained source and opening

From a complete checkout with Node 24 or newer:

```sh
npm run serve
```

Open `http://127.0.0.1:4173/record.html`. The existing server uses the current working directory, so run it from the repository root. This contribution changes no package script or server behavior. Opening the module page directly with a `file:` URL is not the supported local route.

The pure `createSavedEventTextMatcher(query)` export in `src/record-event-search.mjs` returns a predicate for an already admitted flat event. `MAX_EVENT_QUERY_LENGTH` is 256. It rejects a non-string query with `TypeError` and an overlength string with `RangeError`; it is not another saved-file validator. The current filter imports this helper and combines it with the original checkpoint/type predicates without rebuilding event rows.

Focused maintained controls:

```sh
node --test --test-reporter=tap tests/record-event-search.test.mjs
```

Four groups cover literal scalar/query boundaries, admitted-record intersection and complete export preservation, the current 512-event boundary with duplicates, and filter identity/reset/error behavior under an explicitly declared small DOM harness. The harness checks state and references; it does not claim browser layout, keyboard interaction, accessibility tooling or file-chooser behavior.

## Receiving status and ownership

The finite native course passed the four focused groups and separately recorded all 21 query cases against the frozen fictional 12-event record. An independent reviewer accepted all complete sequence sets, selected event objects, the pristine source record, six query-boundary outcomes and the complete HTML reference. Native controller checks (14) and independent saved-result checks (27) are separate scopes. The pre-execution guide and source inputs remain retained unchanged.

One actual Chrome 154 course then passed 189 checks at 1360 × 1000 and 390 × 1000 viewports. It attached the authored JSON to the native file input; typed queries and used select keys; checked the three-filter intersection, open-disclosure identities, malformed replacement, no matches, repair, reset, accepted replacement and Clear. The 257-unit refusal used an explicitly programmatic input assignment. It does not claim ordinary typing bypassed `maxlength`, an operating-system file-chooser interaction, physical mobile hardware or a complete accessibility audit.

While no events matched, the real **Download record review** action produced the complete 17,405-byte HTML file, byte-for-byte equal to the unchanged exporter reference (SHA-256 `eb579e0a4c9eb9a3a334c0289adc7b5c265aa29187c1811b19156e48d8ed0684`). Both original viewport captures are retained. The desktop image shows the native Event type popup open over some help text; the narrow image shows wrapped controls and the literal event-01 evidence. No additional run was performed to replace the desktop image.

The browser used a loopback server and fresh task-owned profile. Its owning parent reaped the receiver; the final observation recorded eleven owned Chrome identities as ten signaled exits with code 0 and one absent, with no owned listener or active/unknown process. Image-query error 31 on the exited identities remains in the raw observations; it was not converted into a false absence claim. These results qualify the named current workflow, not an unrelated historical suite or direct `file:` opening.

Receiving base is `paypal-ai@a8e7ab95e5b9dd4c93fd06a776391d57d81a9515`, including PR 79's completed composition of checkpoint/type filtering and complete-record review download. Issue 80 owns this five-path increment. Owner 73's existing controls, owner 74's download, owner 62's different workspace-library search, owner 56's history proposal, owner 70's admission proposal and owner 68's packaging remain separate.

Reviewed source is intended for an isolated nondefault branch. The standing default/Pages/Actions hold remains; this guide does not claim a default merge, live deployment or installed application adoption.
