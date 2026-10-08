# Capture lifecycle and receipt identity receiving

The final ledger component passes the repository's native `npm test` command:
37 tests, no failures, skips or cancellations, on Node 24.19.0 / Linux x64.
The original seven fixture events and complete reduced snapshot retain their
exact serialized bytes. The independent reviewer accepts this bounded source
change after identifying and verifying two additional corrections.

Coordination: [ScopeSignal #5](https://github.com/Jacob-Met/scopesignal/issues/5),
contributor `estate-06e2ad0ce13f`, reviewer `06e2ad0ce13f/live_access`.
This is source contribution and receiving evidence, not a native scheduler
lease or a serving-state claim.

## Receiving behavior

Supported methods, public append and replay now share transition admission.
A second pending capture is refused; response loss applies only to a pending
request. Order, amount, currency and fixture environment must agree with the
approved checkpoint. Reused webhook IDs must retain their original receipt,
and a capture ID stays bound to one checkpoint, including during an unknown
outcome and subsequent reconciliation. Conflicting reuse refuses without
changing existing events or their reduced state. Exact duplicate webhook
receipts remain separate audit events and do not count twice.

Own-property lookup refuses inherited object-property names as unknown
checkpoints. The ledger owns a copied seed and publishes frozen event
snapshots. Safe integer cents and project-cap admission prevent invalid totals;
checkpoint IDs must also remain distinct under the existing generated
order-ID mapping. Append payload accessors are refused before invocation.

## Exact source provenance

| Item | Identity |
| --- | --- |
| Baseline default commit | `33f021aaacd6d7ed68c508d92901e7442d99586c` |
| Baseline complete tree | `4b7b68a48acb7bd83665f7e97239d68c018f61ed` |
| Baseline ledger blob | `dc324dda071f82071be10cb7f6327b953ccf6b1e` |
| Rejected first ledger candidate | `942e5dfba2f5ad202b6e0a68e4d032b178da6b77` |
| Accepted ledger blob | `beb94176ae3b1a2f29890c5752e47c25694f01f0` |
| Native implementation freeze | `aa08e8d4ed791a449f8d2e2002dcc5320059a784` |
| Published implementation commit | `a928a03f8f169933dad90715b2b53a1f1e81f973` |
| Identical complete implementation tree | `59433e4c0b84c525a5fc47039419665300af82b3` |

The local Git transport could read the repository but had no push credentials.
The installed GitHub connector published the three implementation files using
the baseline Git tree. The server returned the exact same complete tree as the
native implementation freeze; only commit metadata differs. Receiving tests
and this evidence packet are a subsequent contribution with the accepted
executable source unchanged.

## Executed qualification

| Receiving path | Outcome | Retained evidence |
| --- | --- | --- |
| Author regressions on baseline | 2 pass, 13 fail | `baseline-test.log` |
| Author freeze with existing repository tests | 30 pass | `candidate-author-test.log` |
| Independent suite on baseline | 2 pass, 5 fail | `independent-baseline.log` |
| Independent suite on rejected first candidate | 5 pass, 2 fail | `independent-candidate-r1.log` |
| Independent suite on final candidate | 7 pass | `independent-candidate-final.log` |
| Final complete maintained `npm test` | 37 pass | `final-npm-test.log` |
| Existing PR #2/#3 UI composed with the accepted ledger | 38 pass | `composition-test.log`, `composition.json` |

The standalone suite contains the existing 15 tests, 15 new author tests and
seven independently authored receiving tests. The reviewer read the source
and author tests before authoring receiving cases; this is not a blind review.
Its source, test and fixture hashes are retained in `independent-review.json`.
`baseline-fixture.json` preserves the complete original events and state.

The first candidate passed its author suite but admitted seed IDs that collided
in generated order IDs, and a payload accessor could append a nested event
after the outer event had reserved its sequence/time. The final source refuses
both at admission. The author reconstructed the first candidate from the known
corrections; the reviewer independently verified its exact previously observed
Git blob before executing the retained negative cases. That rejected source
is preserved as `candidate-r1-rejected.mjs`.

The composition uses the exact PR #2/#3 delta from
`f62e44a323318cb3acd0188faa89ca3b9a9f6025` to
`fcce3f7d4780aa29f0e961b9b098abfbd3b804aa` in a disposable worktree. Its DOM
adapter requires the two callout element IDs already introduced by default-
branch PR #4; only those two IDs were added, preserving all original assertions.
This known adapter requirement is also recorded in the earlier current-capture
receiving packet. The composition has the original 15 tests, author 15 tests
and eight owner UI tests. Owner branches and draft dispositions were unchanged.

## Reproduce and incorporate

From the repository root, run `npm test`. The independent receiver is also
directly runnable as `node --test tests/capture-identity-receiving.test.mjs`.
The file uses a relative import and fixed fixture hashes, with no external
dependencies, provider call, account, credential or live payment data.

The existing workflow has no pull-request trigger. A default `paypal-ai` push
runs Node 24 tests and then deploys the public fixture through GitHub Pages.
This receiving did not run a browser or that deployed workflow. Browser source
and UI ownership are unchanged; component verification and identical fixture
bytes do not claim authenticated webhook, durable-journal or real-payment
qualification. Raw replay inputs remain supported fixture records, not a
sandbox for hostile JavaScript objects or proxies.

Publication transport failures are retained in `publication-block.json`.
They describe temporary GitHub content-creation limits after source publication;
they do not turn a pending PR, integration or deployment into a completed one.
