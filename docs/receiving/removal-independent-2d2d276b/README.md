# Independent receiving: ScopeSignal checkpoint removal

## Verdict

**ACCEPT** for the bounded draft removal feature in product commit
`b2dccc7e6c47b3f6b5d6f49e1858725eb3a099ea`, tree
`ec3853dcbe4ebe681d28068de36b0d9ea74d22d5`.

The independent receiver found no substantive product defect. Its nine actual
Windows browser scenarios passed. A controlled source mutation that restores
the removed checkpoint at the end, rather than its original position, failed
the unchanged restoration assertion. Both runs had zero page errors and no
harness error.

The product author is
`hamon-ultra-20261008-1657-2d2d276b/production_lane`.
This receiver was authored separately by
`hamon-ultra-20261008-1657-2d2d276b/compatibility_lane` after a direct freeze
handoff. It does not reuse the author's unit tests or browser driver.

## Actual boundary

Browser: Windows Chrome 154.0.8037.98.
Interpreter: Windows Node v24.21.0.
Each scenario used a new browser context. The run used a fresh native profile
and one loopback HTTP server. No sandbox-disabling flag was used.
Nine external page requests were blocked in the candidate run and one in the
negative control. These are page-request observations, not a whole-browser or
whole-host network-isolation claim.

The receiver entered authored fictional strings into the actual form and
dispatched input events. Buttons were operated using CDP pointer events;
restoration in the first scenario used an actual Enter key event. Native
file-input selection and browser downloads exercised the existing file flow.

| Scenario | Observed result |
| --- | --- |
| Remove the middle row, edit surviving rows and scope fields, then undo | Exact removed title, raw amount and multiline evidence restored in position 2; surviving edits preserved; focus returned to its title |
| Remove a second row before undo | Only the most recent removal restored; the earlier removed row stayed absent |
| Add a checkpoint after removal | Old recovery retired |
| Copy a checkpoint after removal | Old recovery retired |
| Move a checkpoint after removal | Old recovery retired |
| Successfully review, then return to editing | Old recovery remained retired |
| Fail review validation and attempt a disabled boundary move | Recovery remained available; undo retained the invalid current cap for correction |
| Download workspace and review, preview the workspace, then undo | Downloads and preview preserved recovery; undo restored the row and invalidated the pending preview |
| Confirm workspace replacement | Saved data loaded and old recovery retired |

The authored data deliberately includes duplicate titles, leading zeroes and
spaces in an amount, angle brackets, multiline evidence, a Greek character and
an emoji. The first scenario compares the complete current draft to an
independently constructed expected object after restoration. It checks
single-use recovery and focus separately.

Three actual native downloads are retained:

- Removed-row workspace JSON: 585 bytes.
- Removed-row HTML review: 4,945 bytes.
- Replacement workspace JSON: 726 bytes.

The removed checkpoint's unique evidence marker is absent from the two
post-removal downloads. The replacement file is reopened through the real
preview/confirmation flow. Exact download names, hashes and raw files are in
the candidate packet.

## Negative control

Only the HTTP-served removal helper is altered for the control:

```diff
- checkpoints.splice(index, 0, { ...checkpoint });
+ checkpoints.push({ ...checkpoint });
```

The source file on disk remains unchanged. The mutated served helper is
retained in `negative/mutated-scope-draft-removal.mjs`, SHA-256
`57fc2265791963577fa1c04894717f74bcd69da4052b810aba6913911a75ac90`.
The first scenario uses the same driver and assertions as the candidate.
It reports one failed group and exit 1, with `harnessError=null` and zero page
errors. This is a product-behavior counterexample, not a browser startup failure.

## Provenance and preservation

The source pin was derived from the frozen native Git commit. Twenty-six
potential runtime files were copied to a separate Windows source directory
with hash checks. All eleven files actually served in the candidate run match
the frozen Git pins. The negative run differs only at the declared helper.

The receiver's SHA-256 is
`dabf88028ca9ba50b1dc9ea171607e766603d1719f47e68df2ee567712e6985a`.
The same bytes ran in both modes and are retained as
`scripts/check-removal-independent-2d2d276b.mjs`.

Windows receiving root:
`C:\Users\minec\hamon-ultra-2d2d276b-scope-independent`.

Native receiving worktree:
`/home/jacob/hamon-ultra-20261008-1657-2d2d276b/scopesignal-independent`.

The thirteen transferred files were byte-count and SHA-256 verified on
ThinkPad after writing. Candidate source files were never edited. The browser
processes had exited before the receiver's two temporary profiles were removed.
This Git checkpoint adds only the independent receiver and receiving evidence.

`source-pin.json` binds source inputs. `packet-verification.json` records
receipt consistency and product preservation. `manifest.json` hashes the
complete packet, including downloads. Original platform paths and raw receipts
are retained without rewriting.

## Platform limitation and visual check

An initial attempt to launch the existing ThinkPad Chrome 154.0.8037.57 with
`chromiumSandbox:true` failed at Chromium sandbox startup. Its original failure
and Node v22.22.1 receipt are preserved under `linux-preflight/`. No browser
protection was changed. Actual functional receiving proceeded on the existing
Windows browser route supplied by the author.

The independent reviewer inspected `candidate/restored-phone.png`, captured
at a 390 by 844 viewport. It shows the restored second checkpoint's literal
title, amount and evidence, with focus on its title. The capture has no visible
overlap within that region; it is a cropped viewport, not a whole-site layout
qualification.

This receiving concerns the fictional editable draft. It does not establish
real approvals, payment effects, provider operation, deployed-site adoption,
or the full inherited application's acceptance.

## Reproduce

Use an existing Chrome and Node with built-in WebSocket support. The output
directory must not exist. Set `SCOPESIGNAL_CHROME` when the default Windows
Chrome path does not apply.

```sh
node scripts/check-removal-independent-2d2d276b.mjs SOURCE NEW_OUTPUT docs/receiving/removal-independent-2d2d276b/source-pin.json candidate
node scripts/check-removal-independent-2d2d276b.mjs SOURCE NEW_NEGATIVE_OUTPUT docs/receiving/removal-independent-2d2d276b/source-pin.json append-negative
```

The candidate is expected to exit 0. The declared negative control is expected
to exit 1 for the restoration assertion.
