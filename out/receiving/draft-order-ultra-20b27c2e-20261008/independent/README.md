# Independent receiving — draft checkpoint movement

Contributor: `ultra-20b27c2e-20261008 / root`. Received 2026-10-08.

## Decision and source

The draft movement contribution is accepted for the normal source integration gate. A checkpoint's current title, amount and evidence remain together through reordering, renewed validation and review. Review identities continue to be assigned by the existing final-draft validator. The feature does not create approvals or payment events.

The lead read the original controller, HTML, CSS, workspace codec and scope model directly from the pinned repository before reading the candidate implementation or author tests. The independent contract and first native probe were then frozen. The candidate diff was inspected only after the corrected before/after receiver had been fixed.

Original baseline: `8a241c9ce409fa9b22ab0bbdc339e46fd4b38525`, tree `7686f7568c398f522df4d32f75a98814b1c4cd1d`.

Current receiving base: `7cde8b30595fe5fecc97a923e0dad443e951ef47`, tree `e755e7276ad38aff9502e5f57fbe96cbd3898868`, 318 leaves. This includes the actual merges of PR22's saved-field/open-intent correction and PR23's portable review export. Their source, tests and ownership remain intact.

| Current contributed file | Git blob | SHA256 |
| --- | --- | --- |
| src/scope-workspace.mjs | f57d31cf8a4e6a9a7ddc140c5c06935fe3ef5004 | 1d3145f2b6c5052927f1050189432cfa55035a863fda20ae64e7347dc965afd3 |
| scope.html | ad9e52d2061d4e5ea8e5535fd8b949e2b48ae1f7 | f7333f942369ff2f2f77a96796489291146cf62fe08d886fda1d35d0f4f99da6 |
| scope-workspace.css | be05fd582636ad9a4fbd5227fc00d8f37d3b5ded | c36abd494fc61e638182517036f424ffb69c32608fece56334777c67a8df6a20 |
| README.md | 70a7d296e9ecb0d6392a12a8979615578fcb3236 | a3f3f55df6f81bc1034adb5ce92cc84c2105cab951d195879aa3cdcc23682d94 |

## Independent native results

The unchanged corrected probe is `receive-v2.mjs`, SHA256 `82234bba0d7cf084c61dde0c5c4633656c1e110addb0edcd94cfb25955686973`.

| Source and probe | Result |
| --- | --- |
| Original baseline, first probe | 1 passing control, 5 absent-movement failures, 1 receiver assertion error about inherited font requests |
| Original baseline, corrected probe | 2 passing controls, 5 absent-movement failures |
| Original candidate, same corrected probe | 7 of 7 groups passed |
| Current 7c composition, identical corrected probe bytes | 7 of 7 groups passed |

The seven groups inspect actual native controls and browser downloads, without importing production model functions as the expected-result oracle:

1. An ordinary unfinished draft downloads, reloads and reopens with its raw strings intact.
2. Twelve distinct tuples, including duplicate visible titles and invalid amount strings, survive 22 keyboard movements from last to first and back. Every intermediate order and focused row is checked. The budget stays identical, no review or event is created, and disabled endpoints do nothing.
3. The invalid amount moves with its tuple. Renewed validation points its error link and `aria-invalid` to the new position; activating the link focuses that exact input.
4. Movement invalidates an already checked older-file preview. A later activation of the old Apply element cannot restore that older draft.
5. Pending evidence edited during review survives Edit, movement and renewed Review with its original tuple. Final IDs follow the new order. One explicit local fixture approval binds the moved tuple and its exact evidence, then locks editing while captured remains $0.00.
6. A single checkpoint disables both movement directions. At a 320 CSS pixel viewport, all three row controls are inside the viewport and 44 pixels high.
7. Actual served response bodies match their source pins; source and probe bytes remain unchanged; there are no page errors or permitted nonlocal page requests.

The original candidate produced 56 verified response bodies and four actual JSON downloads. The current composition produced 63 verified response bodies and four downloads. Every corresponding download is byte-identical across those compositions:

| Download | Bytes | SHA256 |
| --- | --- | --- |
| ordinary-unfinished.json | 703 | 2968ce41fcd020926a7c6b7572392c9139714ffd598e144368ee5567c8f5267f |
| twelve-cycle.json | 2045 | 01bb1f8821561e4b2b938ac775ee2876230989f59e74f7cde0bcb3af8c58c92b |
| after-preview-invalidation.json | 703 | 27200bb7d6b4237f09e7db6179e89542b1949f2573a17997996aed880f82c08c |
| moved-reviewed-approval.json | 917 | 39450d837bf47245a930b85b2abcf54e1c6a94645a041e68d1f16be65b64db7b |

The lead directly inspected both narrow screenshots. The final screenshot is `current-7c/candidate-native-v2/narrow-single-row.png`; labels, inputs and controls remain visible without overlap. This is desktop Chrome at a narrow viewport, not an actual mobile operating system or assistive-technology test.

## Retained receiver correction

The first probe incorrectly required zero attempted nonlocal requests. Primary `styles.css` blob `31353c93740241c42551710bd12599338c017e45` already imports a Google font stylesheet. The fixture blocked all seven attempted font requests.

The correction records abort completion and requires every nonlocal attempt to be that exact inherited GET with a successful abort. A different URL or failed abort still fails. It changes no production source, semantic case or expected input/output. The original executable, complete failed receipt and positive-control download remain unchanged. See `receiver-correction.txt`.

Font loading remained blocked in the visual fixtures. No provider, real payment or user browser profile was used.

## Source review and composition

The controller reads every live draft field before swapping adjacent tuple positions. It validates direction, integer index and both bounds, refuses movement while review is active or the form is hidden, and calls the current workspace invalidation boundary before replacing the rows. It clears stale validation locations, keeps focus with the moved tuple, and announces the new position through the existing page's new polite atomic status.

The added controls are native buttons with explicit type, positional accessible labels and disabled endpoint states. Current scope-plan, workspace codec, ledger, approval logic, export handler, file-opening controls, dependencies and workflows receive no movement edits.

The author's exact frozen patch applies to the current source and reverses to every current native file. The two movement behavior spans match the original freeze byte-for-byte. That patch is retained at `../receiving-7cde8b30/frozen-movement.patch`, so the earlier source and the current composition can be reconstructed without relabeling their evidence.

Current native Node baseline and candidate each passed all 124 tests, including both adjacent owners' added tests. Those logs are in the current author supplement. The author's broader 13 browser groups remain explicitly bound to the original 8a candidate; the current independent seven-group pass supplies the native composition gate.

## Evidence custody and limits

Native environment: macOS, Node 26.3.0, Chrome 154.0.8037.98, existing installed Puppeteer. The server bound an ephemeral 127.0.0.1 port. Each run used a fresh owned headless profile, removed after the browser closed. Only synthetic fixture drafts and the product's local fictional approval control were exercised.

The 26 native artifacts were transferred without text normalization and verified by native byte count, SHA256 and Git blob. Both original scripts retain their exact final line feed, PNGs remain binary, and no source clones or profiles are included. The current receipt is `current-7c/candidate-native-v2/receipt.json`, SHA256 `b6c77eecd6100c6c0fe0514ac6a272a1a85e2d100dda66bc7b5629656b5a9441`.

The frozen witness names the recorded Mac's installed tool paths. Reproduction should use a fresh output directory with a copy of the unchanged probe and corresponding pins file; retained result directories are deliberately not overwritten. The maintained optional `scripts/check-scope-draft-order.mjs` accepts installed-browser/module paths through its documented environment variables.

This review qualifies the source and native fixture behavior. Hosted PR checks, expected-head merge, actual-parent preservation, automatic Pages deployment and served-source receiving remain separate integration records. No hosted result, installed app or live operation is inferred here.

