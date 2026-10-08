# ScopeSignal PR15 — production receiving

The deployed repair passed direct public-browser receiving on **2026-10-08 at 11:16:38–11:16:41 UTC**.

- Product: https://jacobmetoyer.com/scopesignal/
- Source PR: https://github.com/Jacob-Met/scopesignal/pull/15
- Actual merge: `8e50105fdc1645720e64ca83738727473c9f6acf`
- Tree: `fe302d490b55f9eb4f5cbd7f4d7e9fca7e134820`
- Qualified contribution head: `87c8bc083dc8e0e40887fe80eda7b13a58649cbd` (the same tree).
- Existing automatic Pages run: https://github.com/Jacob-Met/scopesignal/actions/runs/37766220718. Its test and deploy jobs succeeded at 10:51:33 and 10:51:49 UTC.

No hosting or workflow setting was changed for this receiving work.

## Evidence

| Stage | Source and execution | Result |
| --- | --- | --- |
| Before | Public responses from `844f32d1a6d9798bc658fd77af79877bd41e5f86`, executed unchanged through an owned loopback origin in Chromium 153 | Ten source hashes matched. Actual input and approval reproduced the loss of the pending handoff draft and reversion of the displayed accepted evidence. |
| Current composition | Exact `87c8bc0` source, transferred and rehashed on Mac; unchanged upstream Puppeteer record-viewer suite | 21/21 checks passed on Chrome 154, with desktop and 390px phone-width layouts. Fourteen served browser assets matched the transfer manifest. |
| Published files | Actual public HTTP responses at 11:06:41–11:06:43 UTC | All 19 application files returned HTTP 200 and matched the merged Git blobs and SHA256s. This includes the editor, viewer and adapter source. |
| After | Actual public URLs in a fresh native Chrome 154 context at 11:16:38–11:16:41 UTC | Four narrow receiving groups passed. All 14 browser-observed response bodies matched the release. |

The final public workflow entered a draft containing leading newlines, literal markup and Unicode, approved another checkpoint, and verified that the draft survived exactly. Accepted evidence remained correct and read-only. Receipt, duplicate and reconciliation labels remained distinct.

The production download was then opened using the native file chooser in the separate public record viewer. It showed **2/3 approvals, 8 events, $400 captured once and $800 remaining**, while preserving the original tab's pending draft. The file contained recorded approvals and excluded the pending draft.

The actual public download is in `live/downloads/`: 3,630 bytes, SHA256 `a3775b68037148b39f90222e1bf3469f4aa28b6cfbed80b3404f1be7f72eb189`. The native composition suite used different synthetic evidence and produced identical desktop/phone downloads of 3,912 bytes, SHA256 `0e1528a6dea485c467fba8a522f54603ab298f3fa872c1dd70ffda24276e4c70`.

## Receiver boundaries

The negative observations are retained separately so setup failures cannot be mistaken for product failures.

- The earlier custom CDP harness timed out before rendering HTTP pages. Its public attempt is retained under `receiver-boundaries/`; the loopback attempt and successful HTTP hashes are in `baseline/public-fetch-receipt.json`. The installed Puppeteer driver subsequently performed both native composition and direct public receiving successfully.
- The first direct Puppeteer attempt stopped before approval because its Meta+A helper did not select the existing textarea contents. The final helper selected the existing range through the DOM, then used trusted native typing and a real approval click. It did not set the input value or mutate the ledger through test code.
- The second attempt passed all three functional groups. Its final response-body gate stopped on the viewer document's normal HTTP 304 cache revalidation. The final attempt disabled cache in its owned pages and verified all fourteen HTTP 200 browser response bodies.
- The final public run had no page exceptions or unexpected requests. Existing fixture font requests were blocked. The viewer made no external requests.
- The baseline uses a verified public-byte mirror, while the final run uses the actual public URLs. Phone-width composition checks do not establish physical-phone or Safari acceptance. Every record is synthetic fixture data; no payment, provider, credential or customer-data operation occurred.

## Packet contents

`baseline/` contains the before observation and screenshots. `record-composition/` contains the native 21-check receipt, transfer manifest, screenshots and an actual example download. `live/` contains the final public receipts, release pins, screenshots and actual download. The complete exact draft values and input traces are in the JSON receipts; a short textarea screenshot does not display every line of a long draft.

`harnesses/` contains the receiving helpers. The two native final helpers are byte-identical to the executed Mac files, with hashes recorded beside them. The full record-viewer harness is the unchanged source file pinned in the composition manifest.

`MANIFEST.json` records the packet files and their SHA256s, excluding the manifest itself to avoid self-reference. This packet adds receiving evidence; it does not change production code, task ownership or human acceptance status.

