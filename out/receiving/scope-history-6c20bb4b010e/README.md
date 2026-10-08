# Authored scope history — receiving for issue #29

## Contribution and source

The authored workspace at [bab391c7c6fec1193e221997e4d66d89bd914cfd](https://github.com/Jacob-Met/scopesignal/tree/bab391c7c6fec1193e221997e4d66d89bd914cfd)
has current totals and a flat event ledger. Its separate timeline uses the
fixed Northstar fixture. [Issue #29](https://github.com/Jacob-Met/scopesignal/issues/29)
reserves a history panel for the author's own admitted scope.

The new model admits the complete ordinary workspace, captures its private
plan and events, and reduces the requested prefix with the existing native
ledger. The view displays all checkpoints, approval evidence present at that
point, native capture states, exact USD amounts and the selected event fields.
Its controls move only the historical cursor.

Qualified source parent: `bab391c7c6fec1193e221997e4d66d89bd914cfd`.
Parent tree: `328092ddb109dd75ecf750f2cdf4fd564143d3ed`.
The self-contained qualification closure is named by
[`source-freeze-r1.json`](source-freeze-r1.json), SHA-256
`3543e463d7a51da98b0b474fa85f05be773487f11dacce8528ae4aa44e5449da`.
It lists 39 exact source/test files, including unchanged parent dependencies.
The parent repository supplies those unchanged files; they are not copied
again into this evidence directory.

Only the new model, view and stylesheet plus an additive section in
`scope.html` and four controller lines implement the capability. Those lines
import and mount the view, clear it at the beginning of `renderDraftRows`,
and supply one read-only snapshot callback at the end of `renderReview`.
Ledger, workspace codec/schema, approval rules, provider paths, dependencies,
storage, workflows, original fixture timeline and existing file-open handlers
are unchanged by this contribution.

## Results and retained limits

| Retained run | Outcome | Meaning |
| --- | --- | --- |
| `baseline-missing` | 1 group passed; 1 failed | The actual authored two-checkpoint flow works, but there is no authored-history panel. |
| `original-selector-run` | 9 model tests passed; browser positive group passed, history group stopped | The original probe selected both legitimate nested summaries. This is a probe specificity assumption, not a product defect. |
| `author-core` | 2 browser groups passed | Exact native event prefixes, amounts, approvals, unchanged workspace/preview, keyboard and narrow layout. |
| `author-lifecycle` | 4 browser groups passed | Zero-event review, pending text, native replacement, optional-panel refusal/recovery and exact large-cent presentation. |
| `native-suite*` | 133 tests passed, 0 failed or skipped | The complete 124-test parent suite plus 9 new model tests, through the normal `npm test` command. |

The core browser probe's only correction from the original is to click the
specific outer summary and then the nested recorded-fields summary. No
behavior assertion was removed. The original probe, original results and
unchanged native positive controls are retained.

Browser receiving used Node 24.19.0, Chromium 153.0.8010.0 and the actual
served page/modules in a fresh isolated context. It used fictional input and
local file downloads only. Each final browser run recorded and blocked the
inherited Google Fonts request; no page errors or provider/account requests
were observed. Captures use fallback fonts. The native suite's existing npm
environment warning is retained in stderr; its exit status is zero.

These are authored implementation and receiving results. They do not claim an
independent reviewer executed them, production deployment, live PayPal/AI
integration, real approval, or payment evidence. Hosted integration gates and
the latest repository tree are separate receiving steps.

## Consequential behavior

| Boundary | Actual check and result |
| --- | --- |
| Complete admission | A later corrupted receipt refuses history construction before an early prefix can be exposed. Draft-stage or malformed inputs are refused. |
| Private captured identity | Mutating returned plan, event, state or checkpoint data cannot rewrite another read or the active review. |
| Approval timing | Each accepted text first appears at its own native approval event. Pending editor notes remain outside historical approvals. |
| Capture counting | Unknown capture stays at zero through original and duplicate receipts; reconciliation counts it once. An ordinary pending receipt counts its separate checkpoint once. |
| Current workspace preservation | The actual 3,149-byte downloads before and after navigation are identical: SHA-256 `d6d0db6f7e11b0d83f774951ab3d8ec015bcbfc52179e6639eafd3a79dcece5c`. |
| Pending editor and file preview | An actual LF-leading pending note and another checkpoint's pending text survive navigation. A prepared native Open preview remains available. The 1,422-byte pending-workspace downloads are also identical. |
| New explicit decision | Approval through the ordinary review advances the history to the latest event and invalidates the older Open preview through the existing controller. |
| Source retirement | Native draft replacement clears the old source, cards and cursor. The replacement's reused positional ID starts with only its own zero-event state. No cross-file identity is inferred from names or checkpoint numbers. |
| Refusal isolation | A positive cap containing over 64 entered characters is accepted by existing draft review but refused by the unchanged workspace serializer. The panel clears and disables itself; current approval still succeeds. A valid native replacement restores the panel. |
| Bounds and presentation | Zero events, 12 checkpoints with 84 canonical events, repeated titles, invalid index categories, literal text and exact maximum-safe integer cents are covered. Native controls work by keyboard; the 390 px page does not overflow horizontally. |

Accepted evidence is the existing approval event's text. The native approval
operation already trims surrounding whitespace; this contribution does not
claim to preserve whitespace discarded by that operation. Planned evidence
and pending editor notes remain separate.

The optional-panel refusal test concerns an actual serializer/admission
error. It does not claim resilience to absent module files, arbitrary DOM
damage, host failure or unrelated changes to the active application.

## Reproduce

Start from the qualified parent and apply this contribution's native source
files, or use the integrated commit while respecting the source pins above.
No dependency installation is needed for the model/native suite:

```sh
npm test
```

The optional browser scripts need an existing Playwright module and Chromium.
Provide both paths explicitly and choose a new output directory each time:

```sh
SCOPESIGNAL_PLAYWRIGHT=/absolute/path/to/playwright \
SCOPESIGNAL_CHROME=/absolute/path/to/chromium \
node scripts/check-scope-history.cjs "$PWD" /absolute/path/to/new-core-receipt

SCOPESIGNAL_PLAYWRIGHT=/absolute/path/to/playwright \
SCOPESIGNAL_CHROME=/absolute/path/to/chromium \
node scripts/check-scope-history-lifecycle.cjs "$PWD" /absolute/path/to/new-lifecycle-receipt
```

The retained original probe can be run against a separate checkout of the
parent. Its expected result there is one native positive group followed by the
absent-panel failure:

```sh
SCOPESIGNAL_PLAYWRIGHT=/absolute/path/to/playwright \
SCOPESIGNAL_CHROME=/absolute/path/to/chromium \
node /absolute/path/to/this/evidence/probes/original-authored-history.cjs \
  /absolute/path/to/parent-checkout /absolute/path/to/new-baseline-receipt
```

Each run directory retains the actual browser observations and downloads.
`packet.json` retains its source pins, process result and full text evidence
as originally exported. Original archive identities are listed in
`archive-identities.json`.

## Composition and preparation history

A later read of `paypal-ai` found parent
`549f6d551d1ad92ee97198b1799c7bcb40aa5e01` with 403 leaves. Of the 39 qualified
paths, only `scope.html` had changed: its separate-tab comparison link was
added. The current-page composition retains that link and adds the same
history section and stylesheet. The controller and every other pre-existing
qualified dependency retain their parent bytes.

`additive-edits.json` specifies each unique insertion and
`composition-549.json` pins that static composition. The additive operations
exactly reproduce the qualified R1 page/controller when applied to the
original parent. No additional browser execution is claimed for the
comparison-link-only composition. A publisher must preserve any newer
unowned source instead of replacing whole current files with older ones.

`preparation-errors.json` separates three non-product failures: an oversized
process argument refused before execution, a lifecycle screenshot payload
that could not be retained through one output return, and a later full-RAM
error while duplicating an already retained screenshot. No result is claimed
from the unretained lifecycle attempt. The subsequent unchanged-probe
lifecycle run retained its passing results and complete screenshots. The
truncated duplicate is excluded; the publication uses the original
97,088-byte phone image with SHA-256
`6fed022954460a90514c42ac14e78b4fa7aab6ecdaadbfe8f157055047a2e356`.

No implementation or test bytes changed to work around these transport
limits. All 39 frozen source files were reverified after the RAM write error.
