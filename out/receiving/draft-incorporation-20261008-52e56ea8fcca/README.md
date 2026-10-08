# Receive the reviewed evidence-draft stack

This receiving candidate composes the existing evidence-preservation and
webhook-label contributions with the current capture-state presentation. Pending
evidence survives another checkpoint's approval, accepted text stays tied to its
recorded approval, and a webhook receipt does not imply capture settlement.

## Exact source

- Receiving base: `paypal-ai` at `33f021aaacd6d7ed68c508d92901e7442d99586c`.
- Original draft preservation, PR #2: `0f8afe359b7a00963048f48c8ccec261d224c337`.
- Original webhook label, PR #3: `fcce3f7d4780aa29f0e961b9b098abfbd3b804aa`.
- Local composed source: `a1b4df241c565c10235500844e06b900d8cc0011`.

The composition is a real merge whose parents are the receiving default and
original PR #3 head. It preserves both original commits and author attribution.
The only changed existing application file is `app.mjs`; the original test file
is added. The receiver adds `capture-title` and `capture-guidance` to that test's
DOM adapter, as documented by the preceding independent receiver.

The application SHA-256 is
`5ae662e8a18ee0e603615a15f6315db274cfb81f4e0d1d6420f75103e7c57719`.
It exactly matches the already qualified composite recorded under
`../current-capture-20261008/composition.json`. Earlier negative evidence and
Mac browser results remain in that original receiving packet.

## Current-source qualification

`npm test` passes all 23 native Node tests on Node 24.19.0, with zero failures or
skips. The original draft tests exercise literal text, leading newlines,
successive approvals, refusal, replay and event labels through the real ledger.
The current capture tests remain unchanged.

The existing `scripts/check-browser.mjs` command, with
`SCOPESIGNAL_CHECK_SCOPE=combined-drafts` and explicitly selected existing
Playwright/Chromium, passes all 15 desktop and phone groups on Chromium
153.0.8010.0. It serves this exact source from an ephemeral loopback origin in
fresh browser contexts. The receipt records each served source hash. Draft
preservation, accepted evidence, refusal, sequential approvals, exact fixture
amounts, event labels, replay and viewport checks pass without browser script
errors. External requests are blocked; the four attempted existing Google Fonts
stylesheet requests are retained in the receipt. Captures use fallback fonts.

`manifest.json` binds the original commits, parent preservation check, resulting
source, application and adapter hashes, and actual browser receipt. `receipt.json`
and the two PNGs are the unmodified browser outputs.

## Receiving status

This packet records verified local source composition. Independent lead review,
remote publication and default-branch integration are pending at this checkpoint.
The existing Pages workflow can run after a default-branch integration; this
packet does not establish a hosted deployment or served-site parity. It remains
the repository's fixture-only application, with no PayPal or AI provider request
and no real payment evidence.

Coordination is recorded at
https://github.com/Jacob-Met/scopesignal/pull/2#issuecomment-6055365460.
