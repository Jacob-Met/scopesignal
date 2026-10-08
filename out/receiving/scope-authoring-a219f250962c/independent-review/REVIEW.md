# Independent ScopeSignal authoring review

**Disposition: accepted after two independently reproduced findings were corrected.**
No unresolved blocker remains within the reviewed authoring scope.

Reviewed source commit: `562c3a15a4eeeb4726f1ac3916987e267cb6cdc3`.
Reviewed tree: `bd8d606350ec7c9d4c0889dcf6efeaf89e0562b9`.
Negative-control commit: `a75f85e703f555ef6ad8a45e55f0cae05a394541`.
Reviewer: `/root/estate_artifacts`, independent of the authoring contributor.

## Findings and correction receiving

1. **Accepted cents were displayed as different amounts.** The original new workspace
   accepted `90071992547409.91` as safe integer cents but displayed
   `$90,071,992,547,409.90` in the review cap, milestone amount, and captured total.
   `70368744177664.01` similarly displayed as `$70,368,744,177,664.02`.
   Independent real Chromium interaction reproduced both failures through ordinary
   form input and explicit approval/capture controls. The author replaced floating
   dollar formatting with integer whole-dollar grouping and an exact cents remainder.
   The identical browser controls now pass at both amounts and at one cent, including
   the draft allocation display.

2. **A sparse checkpoint array could be reported valid and then crash review creation.**
   The old validator skipped array holes, returned `ok: true`, and passed an unusable
   seed to the ledger. This was an API-boundary defect; ordinary DOM rows are dense.
   The author now materializes rows before validation and marks missing budget rows
   invalid. The same independent native control failed on the old source and passes
   on the corrected source.

Only the author changed production code. Reviewer-written controls and receipts are
kept in this separate directory.

## Independent verification

| Receiving source | Native groups | Actual Chromium groups |
| --- | --- | --- |
| Original authoring candidate `a75f85e` | 3 pass, 1 fail | 2 pass, 2 fail |
| Corrected authoring candidate `562c3a1` | 4 pass, 0 fail | 4 pass, 0 fail |
| Corrected authoring plus the existing #5 ledger candidate | 4 pass, 0 fail | 4 pass, 0 fail |

The native review goes beyond the author's selected examples:

- Enumerated all **169 reachable paired checkpoint histories** and **312 legal
  transitions**. Checked approval-before-payment, one accepted decision per checkpoint,
  exact accounting, unknown outcomes remaining uncounted, receipt/capture custody,
  sequence continuity, and complete state preservation after every unavailable action.
- Exercised **12 checkpoints** with identical titles and hostile supplied IDs. Generated
  identities remained distinct; each capture and receipt belonged to one checkpoint;
  the complete lost-response/duplicate/reconcile path counted every one-cent checkpoint
  exactly once.
- Compared **2,847 decimal cases** around binary precision boundaries with independent
  BigInt decimal arithmetic. The corrected formatter and parser retain supported cents,
  and out-of-range amounts are refused.
- Rejected sparse checkpoint inputs before seed creation and before showing a complete
  budget.

The separate browser review used the actual HTML/module source, fresh Chromium
contexts, and explicit DOM interaction. It also tried an empty approval after editing
another checkpoint's evidence. Refusal retained zero events; corrected approval locked
the scope and its accepted evidence while preserving the other row's literal
script-like draft across rendering. No page errors occurred. Each navigation attempted
the existing Google Fonts stylesheet; the receiver blocked those requests and used
fallback fonts. No other external request was observed.

The #5 composition used its existing isolated checkout, with `src/ledger.mjs` SHA-256
`504960dce6d278baef15e90f7cd7c7c57a543d1dcc881aef4225f320fb39ca3c`.
The authored source hashes matched the corrected candidate. This qualifies that local
composition; it does not claim integration into the remote default branch.

## Scope and product contract

The feature gives the README's editable acceptance-checkpoint promise a working
authoring path. Project cap, allocated remaining value, and unallocated cap are
distinguished. Approval is a separate explicit action and payment controls only record
synthetic fixture events. Unknown outcomes stay unknown until the explicit simulated
lookup, and duplicate receipts do not increase captured value.

The review found no additional custody or injection problem in the new capability
boundary: the ledger stays private, exported snapshots are detached, checkpoint IDs are
generated, accepted evidence is retained in its approval event, and user text uses DOM
text/value sinks. The page states that it is an in-memory fictional fixture and that
refreshing or leaving clears it. Persistence, exports, and external payment evidence
are not represented as available through this page.

The existing-file change is limited to the former dead Add-checkpoint control's label
and navigation. Existing ledger, role previews, payment-status presentation, AI,
timeline, evidence-editor, and export ownership remains separate. A later default-branch
export contribution was reported by the author after this review; its integration
seams remain with the author/root receiver.

## Reproduction and receipts

Native review:

```sh
SCOPESIGNAL_REVIEW_SOURCE=/path/to/scopesignal \
  node --test --test-reporter=tap review-invariants.mjs
```

Browser review:

```sh
node review-browser.mjs /path/to/scopesignal /path/to/receipts
```

The browser script uses the already available Playwright entry and Chromium executable
named in its source. During receiving, the shared overlay filled; the corrected browser
runs used `TMPDIR=/dev/shm`. Their receipts were subsequently copied here. No other
contributor's data was deleted.

- `review-result.json`: exact source/control hashes and result summary.
- `browser-a75f85e/receipt.json`: original actual-DOM failures.
- `browser-562c3a1/receipt.json`: corrected actual-DOM receiving.
- `browser-ledger-composition/receipt.json`: corrected receiving with #5's ledger.
- `review-invariants.mjs` and `review-browser.mjs`: independent reusable controls.

No GitHub write, deployed-site change, provider call, or live-money action was performed.
