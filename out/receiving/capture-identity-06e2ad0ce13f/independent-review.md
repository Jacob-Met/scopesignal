# Independent receiving review: capture identity

Reviewer: `06e2ad0ce13f/live_access`. The reviewer authored and executed the
receiving suite independently after reading the production baseline and author
tests. This was not a blind review.

The final source at local commit
`aa08e8d4ed791a449f8d2e2002dcc5320059a784`, ledger Git blob
`beb94176ae3b1a2f29890c5752e47c25694f01f0`, passes all seven independently
authored receiving tests. No further executable-source change is requested for
this scope.

## Consequential counterexamples and controls

The original main source at `33f021aaacd6d7ed68c508d92901e7442d99586c`
accepted a webhook for one cent in a different currency and counted the full
400-dollar checkpoint. Raw replay also accepted an unapproved, unordered
webhook, a capture for an unrelated order, a non-sandbox order, and changed
receipt money under a duplicate marker. The receiving tests challenge both
the public append path and direct replay. Rejection must preserve the existing
ledger bytes and its reduced state.

The first candidate repaired those payment-event boundaries. Independent
review then identified two further failures:

- Checkpoint IDs `journey` and `JOURNEY` were accepted together, although both
  generated `SANDBOX-JOURNEY`. The second approved checkpoint could never
  create its order. The same collision occurred for `ss` and `ß`. The final
  constructor and reducer reject these ambiguous seed identities before
  accepting work; distinct mixed-case identities remain usable.
- An accessor in the public append payload could append another valid event
  while the outer event had already reserved sequence/time values. Both events
  received `seq=1` and `at=T+001`. The final append boundary rejects accessor
  payloads before invoking them, preserving the empty journal and next sequence.

The original fixture's serialized event and snapshot SHA-256 values remain
exactly unchanged. Three different combinations of direct webhook, lookup-only,
and lost-response-plus-webhook paths were also exercised across all three
checkpoints. Every accepted intermediate prefix round-trips through JSON and
replays with safe nonnegative integer totals, captured plus remaining equal to
the project total, and no duplicated captured amount.

## Exact receiving outcomes

| Source | Tests passed | Tests failed | Meaning |
| --- | ---: | ---: | --- |
| Original baseline, Git blob `dc324dda071f82071be10cb7f6327b953ccf6b1e` | 2 | 5 | Existing fixture/control paths pass; invalid admission and two discovered boundaries fail. |
| Rejected first candidate, Git blob `942e5dfba2f5ad202b6e0a68e4d032b178da6b77` | 5 | 2 | Payment admission is repaired; seed-order collision and accessor mutation remain. |
| Final candidate, Git blob `beb94176ae3b1a2f29890c5752e47c25694f01f0` | 7 | 0 | All bounded receiving cases pass. |

The exact logs and source/test hashes are adjacent in `independent-*.log` and
`independent-review.json`. The retained rejected source was reconstructed by
the author from the known corrections; the reviewer independently verified its
Git blob equals the originally reviewed r1 blob before executing the negative
controls. The final tests are portable at
`tests/capture-identity-receiving.test.mjs` and use the native Node test runner.

This qualifies the fixture ledger component. No browser, PayPal API, hosted
page, authenticated webhook, durable journal, or deployment was exercised by
this review. Raw reducer inputs remain supported fixture event records; this
review does not claim a sandbox for hostile JavaScript objects or proxies.
