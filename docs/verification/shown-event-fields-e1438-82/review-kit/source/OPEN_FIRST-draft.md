# ScopeSignal — expand only the shown events

This review kit opens a fictional saved record in the maintained ScopeSignal viewer. Use **Expand shown events** or **Collapse shown events** to read the matching events together while preserving the open state of events hidden by your filters.

## Open the kit

1. Extract the whole ZIP into a new folder. Keep its subfolders together.
2. Open a terminal in that extracted folder, where `package.json`, `record.html` and `scripts` appear.
3. With Node.js 24 or newer available, run:

   ```sh
   node scripts/serve.mjs
   ```

4. Leave that terminal running and open **http://127.0.0.1:4173/record.html** in a browser.
5. Under **Choose your record**, select `examples/shown-events.fixture.json` from this kit.

The server uses the terminal's current directory. There is no dependency installation step. Open the HTTP address above; directly opening the HTML with a `file:` address is not the supported module route. Stop the server with **Ctrl+C** in its terminal. If port 4173 is already occupied, close your previous instance or use the server's existing `PORT` environment setting.

## Try the visible-event controls

The supplied file contains eight fictional events. Its sequence numbers remain visible after filtering.

1. Open event **1** manually so its saved evidence is visible.
2. In **Search saved event values**, enter `CAP-SHOWN-001`. Events **5, 6 and 7** remain shown.
3. Choose **Expand shown events**. Those three existing disclosures open, and the status announces the count.
4. Choose **Collapse shown events**. Only those three shown disclosures close.
5. Choose **Show all events**. Event **1** is still open: hiding it did not change its earlier state.

For a narrower intersection, keep the capture query and choose **Webhook received** under **Event type**: events **5 and 6** remain. Replace the query with `true` while keeping that event type selected to show only event **6**, whose saved duplicate value is true. These are literal saved-value searches, not field-name or natural-language searches.

A query with no matches disables both batch buttons. **Download record review** still contains the complete eight-event record, including hidden events and original saved fields. Keep the supplied JSON for reopening the interactive viewer; the HTML download is a full reading copy. Filters and disclosure actions do not rewrite that JSON or change the displayed record totals.

The new buttons preserve their keyboard focus and use a polite status message. Changing a filter clears that action message. Opening another file creates a fresh view; **Clear view** removes the current one.

## Other included pages

The brand and **Open the fixture demo** links lead to the unchanged fixture demo. Its linked authoring, comparison, CSV and library pages and all their local modules are included so that navigation resolves. These pages use fictional data and in-memory interaction.

The saved-record viewer uses local code and system fonts. The unchanged fixture-demo stylesheet also references Google Fonts and falls back to installed fonts if they are unavailable; its source link opens GitHub. The kit does not contain a deployed site or change the repository's default branch.

## Source and validation

SOURCE_OFFER_PENDING

The included `SOURCE.json` records every other kit file's whole-byte identity and its source. `LICENSE` retains the original repository license. The eight-event JSON is a manually stated fictional example also covered by the focused source checks.

FOCUSED_STATUS_PENDING

Actual browser keyboard, layout and download receiving for this new kit is pending at this preparation checkpoint. The prior issue 80 search receiving described in the maintained guide belongs to that older source scope.

For an optional repeat of the two included focused test modules:

```sh
node --test --test-reporter=tap tests/record-event-search.test.mjs tests/record-event-disclosure-controls.test.mjs
```

The controlled DOM tests check state, references, full-record export preservation and boundary cases. They do not establish a real browser or native file-chooser result. Detailed matching rules and source ownership are in [the maintained guide](docs/record-event-search.md).

All example approvals, provider event names and capture identifiers are synthetic. This kit makes no live payment or provider request and is not evidence of a real transaction.

