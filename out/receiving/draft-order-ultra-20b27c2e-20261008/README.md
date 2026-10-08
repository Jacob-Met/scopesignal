# Reorder an authored ScopeSignal draft

This contribution lets an author move a checkpoint up or down before approval. The checkpoint's current deliverable, amount and planned evidence move together. The existing draft validation still creates the reviewed plan and assigns its positional identifiers.

## Frozen source and ownership

The baseline is `Jacob-Met/scopesignal`, `paypal-ai@8a241c9ce409fa9b22ab0bbdc339e46fd4b38525`, complete Git tree `7686f7568c398f522df4d32f75a98814b1c4cd1d`. All 44 application, test, documentation and workflow files in the native source closure were fetched from that exact commit and verified against their primary Git blobs. The complete 250-leaf tree contained no AGENTS.md or WORKSTREAMS instruction file.

Four original files change:

- `src/scope-workspace.mjs`: draft-row movement controls and one new branch at the start of the existing delegated row click handler.
- `scope.html`: local draft instructions and an accessible position announcement.
- `scope-workspace.css`: a wrapping action group with 44-pixel minimum control height.
- `README.md`: usage and the optional native receiving command.

The only added executable is `scripts/check-scope-draft-order.mjs`, a receiver using an already installed Puppeteer and Chrome. Package metadata, dependencies and workflows are unchanged.

The controller's frozen SHA256 is `890a18dfa3ec01e6a69ee1affd77f6650286fcbcd700f32621645a2188d2bab7`. The corresponding HTML is `c7d3a6659f6084d338fef0ab2d663814afcdea81eb01f7f53941a2871f876ebc`; CSS is `c36abd494fc61e638182517036f424ffb69c32608fece56334777c67a8df6a20`. All five publication source pins are in source-pins-after.json.

The [coordination claim](https://github.com/Jacob-Met/hamon/issues/140#issuecomment-6060526984) and [adjacent owner notice](https://github.com/Jacob-Met/scopesignal/issues/18#issuecomment-6060540246) keep #18's native-field/open-intent repair and #20's printable review export separate. The owner’s PR #22 was still open when this baseline contribution was frozen. Its accepted source must be preserved when composing the receiving branch. The evidence here remains bound to the original 8a baseline and these exact candidate bytes.

## Product behavior

Each draft row has Move up and Move down buttons. The first row cannot move up, the last cannot move down, and both directions are disabled for a single checkpoint. Add and remove continue through their existing handlers.

Movement reads the current native form values before changing order. It neither validates nor reformats unfinished fields. Duplicate titles, leading zeros and spaces in amounts, empty values, Unicode and multiline evidence retain their current values. The next review applies the existing validation and normalization rules.

Keyboard operation uses ordinary Tab, Enter and Space. Focus follows the same action on the moved row while that action remains available. At a boundary it moves to that row's deliverable field. A polite status identifies the new position. The action group wraps within the phone-width layout.

The new branch refuses movement while a review is active or the form is hidden. Before approval, Edit draft still brings pending review evidence back into the draft; a subsequent move carries that evidence with its checkpoint. After approval, the existing lock and recorded identifiers remain intact.

A successful move invokes the existing workspaceChanged boundary before updating the draft. That cancels an older pending file read or preview. Save, decode, replay, open, replace, cancellation and export behavior are not reimplemented here.

## Native before and after

The original before probe was written before production edits and retained unchanged.

| Receiving gate | Exact baseline | Frozen candidate |
| --- | --- | --- |
| Existing Node 24.19 test suite | 107 passed; zero failed, skipped or canceled | 107 passed; zero failed, skipped or canceled |
| Unchanged native Chrome probe | Four positive controls passed; two capability assertions failed because no movement controls/action existed | All six checks passed |
| Broader native Chrome receiving | Not represented as a baseline run | All 13 groups passed; eight actual workspace downloads |

The original native positive controls establish that form entry and existing add/remove preserve all supplied values, the original review follows displayed order with zero approvals/events, and the page has no JavaScript error or fixture-origin escape. The two preserved failures identify the absent movement UI and absent first-row movement action.

The broader receiver uses six independent scenarios at each of 1280×960 and 390×844, plus a shared page-error/network gate:

1. Pointer and native keyboard movement preserve all raw fields, budget, labels, focus and layout.
2. Invalid and unfinished values move unchanged; the existing validation points to their new row.
3. Single-row and twelve-row boundaries preserve add/remove and whole-row order.
4. Pending review evidence moves before approval; final IDs and the existing approval lock stay attached to the new reviewed order. A synthetic hidden-control click cannot alter the locked workspace. The existing fictional unknown-capture state remains uncounted.
5. An actual downloaded draft reopens through native file selection and explicit Replace. A later move invalidates an older preview.
6. A move during an instrumented, in-flight File.arrayBuffer read invalidates that read through the existing boundary; releasing the read cannot replace newer work.

All eight downloads were read back, copied with their exact bytes and SHA256-verified against the native receipt. The accepted-order and locked-order downloads are identical. Desktop and phone results retain the expected independent checkpoint values.

Both actual screenshots were inspected. The draft fields and row controls stay within the viewport; native geometry checks establish minimum control heights and no horizontal document overflow. The phone result is a 390-pixel browser viewport, not a physical-device test.

## Source and evidence integrity

source-preservation.json records exact reconstruction of the original controller after removing only the two owned spans: renderDraftRows and the inserted movement branch. All imports, all other helpers, the entire existing add/remove branch, every review/action handler and every file/open/replace handler then match the original whole file exactly. Forty of the 44 existing closure files remain byte-identical.

native-file-pins.json independently binds the original native receipts, all four screenshots, both executed receiver scripts and all eight downloads. Seventeen artifact files were transferred back and matched their native size and SHA256. The local patch writer initially appended one extra final line feed to each receiver copy; those two local-only transport differences were removed to match the exact native-tested scripts. script-custody-alignment.json records both prior and final hashes. No production code or executed native receiver changed.

The native tests used Node 26.3.0 and the already installed Chrome 154.0.8037.98 on the approved Mac connector, in an isolated temporary source directory and a newly created headless profile. A local server exposed the pinned fixture source. Every browser request outside that ephemeral loopback origin was aborted; the only attempted external resources were the existing Google Fonts stylesheet. Each owned profile was removed after its browser closed. No dependency was installed and no user browser profile was reused.

The README received its optional-receiver invocation after the native run. This documentation-only addition does not change any served application or executed receiver byte. Native-file-pins.json therefore retains the historical README hash; source-pins-after.json records the final publication README. The source preservation proof and the publication manifest make the distinction explicit.

## Receiving limits and integration

This is source qualification of a fictional local workspace. No real customer, provider account, approval, payment or contract was used. The test’s existing approval/capture buttons record fictional local fixture events only.

The original native-field normalization and file-picker intent findings from #18 are not claimed fixed by movement. The movement tests use values already representable in the page's native controls and test the existing in-flight read/preview invalidation. The separate owner repair must remain intact in any later composition.

The default `paypal-ai` push workflow runs tests and deploys GitHub Pages. Source integration and that existing release receiver remain the lead/root owner’s responsibility. This worker made no GitHub mutation and claims neither a merge nor served-site adoption.

Run `node --test --test-reporter=tap` for the existing native suite. Run the documented optional browser receiver against a selected source directory using an installed Puppeteer and Chrome. The receiver creates a fresh local profile and bounded fixture downloads; it performs no provider operation.

