# Current capture state receiving — 2026-10-08

Contributor: HAMON cohort `81ba1ed0179c / estate_integration`.

The complete fixture has already reconciled its lost capture response and counts $400 once. The shipped callout still said `Capture state: unknown`, while the recovery role said to keep the capture unknown. Both statements described an earlier event instead of the current ledger.

## Contribution and ownership

This contribution targets default branch `paypal-ai` at `f62e44a323318cb3acd0188faa89ca3b9a9f6025`. It adds `src/payment-status.mjs` and uses the existing reducer to describe current checkpoint and aggregate recovery states. The callout is populated through text properties; the recovery reviewer continues to be a local advisory role. All payment methods, events, counting, fixture data, connector code, dependencies and workflows retain their original bytes.

The original discovery used the separately owned draft stack #2 (`0f8afe359b7a00963048f48c8ccec261d224c337`) and #3 (`fcce3f7d4780aa29f0e961b9b098abfbd3b804aa`). Those changes are not included in this default-branch contribution. Their draft status and branches are untouched. Coordination is recorded in #2 comment 6054728592 and #3 comment 6054780598. A new cohort contribution is independently reviewable and can be incorporated without deciding those drafts.

The draft-preservation DOM test adapter needs the two new callout element IDs when that separate work is received. The adaptation was used only in the isolated combination tested here.

## Verification

| Receiving target | Result | Evidence |
| --- | --- | --- |
| Original recovery role | 1 passing method, 3 failures | `baseline-current-state.log`; unchanged `tests/recovery-current-state.test.mjs` |
| Implemented current default source, Linux Node 24.19.0 | 15 methods pass, no skips | `implemented-main-node.log` |
| Implemented current default source, macOS Node 26.3.0 | 15 methods pass, no skips | `native-main-node.log` |
| Original current default, Chrome 154 desktop and phone | 3 groups pass, 4 current-state failures | `browser-baseline-main.json` |
| Implemented current default, Chrome 154 desktop and phone | 7 groups pass | `browser-candidate-main.json`; `desktop.png`, `phone.png` |
| Original #3 stack, corrected browser harness | 11 groups pass, 4 current-state failures | `browser-baseline-r2.json` |
| #3 stack composed with this change | 23 Node methods and 15 browser groups pass | `native-combined-node.log`, `browser-candidate-combined.json` |
| Source composition | Strict Git check/application produces the exact browser-tested combined application | `composition.json`, `owner-app.patch`, `current-capture.patch` |

The seven new Node methods cover every shipped replay prefix, lost-response plus duplicate-webhook holds, reconciliation, ordinary captured outcomes without invented reconciliation, a second unresolved checkpoint, pending/not-started distinctions and unavailable presentation. Browser checks execute real page modules with native Chromium DOM and actual button input. The composed receiving run additionally qualifies draft retention, accepted text, inert textarea-like text, refusal, sequential approval, explicit replay and both viewport layouts.

## Harness correction and limits

The first browser harness incorrectly expected no external request attempts. The existing stylesheet imports Google Fonts; all four attempts were intercepted and blocked. `browser-harness-r1.mjs` and `browser-baseline-r1.json` retain the original five-failure result. The corrected harness allows only the exact already-shipped font URL in its attempted-request record while still blocking every external request. It retains the same four product failures, with no page script errors. `browser-baseline-r2-harness.mjs` preserves that correction. Screenshots use fallback fonts and show the current-default source, including the separate unincorporated draft issues.

Native tests used installed Playwright 1.62.0 and Google Chrome 154.0.8037.98 on Mac.lan through an owned `/tmp/scopesignal-receiving-81ba1ed0179c` source copy, fresh browser contexts and an ephemeral loopback server. No user browser profile, active worktree, service, credential, provider, PayPal API or live payment was used. Both servers and browsers close at harness completion. The served-file SHA-256 values are included in each browser receipt. All source blobs were verified against GitHub before materialization; `provenance.json` records the exact source/artifact identities.

This packet qualifies source and native browser behavior. Public serving is established only by a later successful default-branch Pages run and readback, recorded in the integration PR/coordination receipt. The existing Pages workflow runs automatically on a default-branch push; no separate workflow dispatch or deployment configuration change is part of this patch.
