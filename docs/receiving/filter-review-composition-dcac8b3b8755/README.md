# Combined event filters and complete-record review receiving

The accepted event filter now shares the saved-record viewer with the complete HTML download. Filters only change the visible event rows. The actual download from a filtered view and from a no-match view remains byte-identical to the original complete 13-event review.

## Open the received interactive viewer

Download [ScopeSignal-Combined-Record-Viewer-86d6c39d-v1.zip](https://drive.google.com/file/d/1MicNLQkeQC2Srj6mOU2qTq_gs4Yxe2YC/view), extract the entire ZIP into a new directory, and use an existing Node.js 24 or later runtime:

```sh
node open-record.mjs
```

Open the printed loopback address ending in `/record.html`, then choose `fixtures/mixed.json`. Select **First-run checklist** and **Webhook received**: events 8 and 9 remain, including the duplicate receipt. **Download record review** still saves all 13 events, every checkpoint and the complete totals. A no-match selection also permits that complete download. **Show all events** restores 13 rows and focuses the checkpoint selector while preserving open disclosures. Press Ctrl+C in the opener's own terminal to stop it.

The [exact packaged OPEN.txt](package/OPEN.txt) explains the route and limits. The opener verifies all nine runtime bodies before listening. Full-demo links point outside this focused package and return its explicit 404 note. The actual [complete static HTML](https://drive.google.com/file/d/1d9juxv64Ss5GUPUv5UrivC8TtdPkvT5o/view) opens directly for reading; it has no interactive filters.

ZIP identity: **157,585 bytes**, SHA-256 `e98aa5a2cf490ae9fe8aa2e1d98af37bfa4227b12b10e67c04a2c595484a8f84`, Git blob `60a4f990d82786734672db5ffcc731b06056a3c1`. It has 27 members: 26 selected payloads plus the maintained packer's manifest. The [saved-GET receipt](delivery/combined-viewer-saved-get.json) records HTTP 200, whole-byte equality and unchanged local custody. The sealed ZIP predates this index and remains unchanged.

## Source composition and ownership

Received source commit: `86d6c39dc219aa34285f66c91545103ffff2daa3`; tree `1f6f61e604d37e85fe4377e5922bdd382c3d1dcf`. Its ordered parents are default `115128bf8d8f20395accc04eaf7ad4f8e428c193` and accepted filter owner `e8de5960ba74f823feb72df73af1de6857981752`.

The complete 793-leaf composition retains all 25 owner additions and 766 other current tuples exactly. Only `src/record-view.mjs` and `record-view.css` combine the separate accepted filter and download spans. Removing either contribution restores the other accepted source byte-for-byte. [composition.json](composition.json) retains the audit; the product guide is [here](../../record-filter-review-composition.md).

Owner `2766b0fc4581` and their branch, historical 2/10 original and 10/10 candidate browser course, 18-test course and seven-file companion remain unchanged. Their historical bodies remain at `../record-event-filter-2766b0fc/`. The prior HTML-review course and delivery also retain their original source epoch. This increment follows [issue 73's reciprocal composition](https://github.com/Jacob-Met/scopesignal/issues/73#issuecomment-6154788428); it does not change the reader, ledger, exporter, full-app package, selected-prefix history, payment execution, hosted installation or other owners.

## Separate completed courses

| Course | Source and purpose | Actual result |
| --- | --- | --- |
| Historical owner | Original and accepted filter contribution | Existing 2/10 and 10/10 groups; 18 maintained tests. Retained attribution, no replay here. |
| New original browser | Current default viewer, frozen independent criteria | PID 10836 exit 0; 39/39 checks; one complete HTML download. |
| New combined browser | Exact nine-file composition, same observer and fixture | PID 23020 exit 0; 76/76 checks; two complete HTML downloads. |
| New package opening | Exact sealed ZIP, existing maintained packer and narrow opener | Outer PID 27784 exit 0; observer PID 26052 exit 0; 91/91 checks and nine exact HTTP bodies/MIMEs. |

The browser observer is [browser/observer.py](browser/observer.py), frozen criteria are [browser/criteria.json](browser/criteria.json), and both complete raw receipts and source packets are adjacent. The candidate metadata envelope was corrected before its first launch; its nine source bodies were unchanged. Neither earlier metadata-only envelope was executed.

The browser course checks 13 → 7 → 2 event selection, duplicate rows and literal fields, retained disclosure, complete totals, actual keyboard selection/reset/focus, a 390px viewport, and full scalar/order equality in actual downloaded HTML. Original, filtered and no-match HTML files all have **17,716 bytes**, SHA-256 `0d7e5a24436d350f4f9b41b337a60dea4b55a1984ae7829514c1891646e85cb8`, Git `80e356eefc82bd9c9dc1cacfef8313749f9cec8c`. All three saved files are retained separately. There were no external requests, page/console errors or storage writes. Managed browser disconnection and server/thread/listener closure were observed; browser OS exit was not measured. The actual screenshots and [visual note](browser/visual-review.json) retain the bounded readable-layout qualification.

The package course is [package/receive_package.py](package/receive_package.py) and [package/package-receiving.json](package/package-receiving.json). It ran on Windows **MSI / Veria**, Python **3.11.9**, Node **24.19.0**. It used unchanged `estate-push-tools/make_delivery_zip.py@34e192096abed7216025e8141a9cf3106bb82dfd` once, extracted the exact 27-member ZIP, started the pinned opener from a foreign owned working directory, and fetched every runtime file with exact bytes and MIME types. The full-demo route returned the documented 404. Ctrl+C was sent only after the helper verified its own console contained exactly itself (PID 652) and its Node child (PID 6656). Actual Node exit 0, empty stderr and closed listener passed. No browser was replayed in this package course.

All five complete custody inventories preserve bytes, hashes, mode, nanosecond mtime and inode: source payload, extracted artifact, sealed ZIP, original screenshots, and observer/input/tool files. Raw command streams, launch result and selected manifest are retained. [package/native-byte-transport.json](package/native-byte-transport.json) preserves exact base64 for the raw files and sealed ZIP. Its data-only exporter ran once as PID 20248, exit 0; it did not repeat packaging, HTTP or browser work. Decode only the selected ZIP row as data and verify its identity before extraction.

## Evidence and limits

[MANIFEST.json](MANIFEST.json) binds the 35 selected raw/support files by bytes, SHA-256 and Git identity; this README and the manifest are not self-hashed. Source packets, raw receipts and streams are preserved without reserialization. The later transport is a custody copy; it does not replace the original raw records.

These are unsigned fictional fixture records. This qualification does not establish real approvals or transactions, physical mobile or assistive-technology behavior, print/PDF output, a hosted deployment or an installed release. Source publication and eventual default adoption are separate from the exact delivered package identity. No new Actions run is requested; zero observed head runs is not a CI result.
