# Independent ScopeSignal receiving review

**Decision: no blocking findings against frozen head `c9e1530f0f6c2baa78bf5107cfeb634f09a68b83`.** The independent receiving evidence supports publication and the repository's normal integration gates. It does not establish hosted CI completion, Cloudflare runtime behavior, or use by the shipped UI.

Reviewer: `406d0fb04c43/native_engine` · 2026-10-08 · Node `v24.19.0` on Linux x64.

## Source identity and isolation

| Source | Commit | Git tree | Verified tracked files |
| --- | --- | --- | ---: |
| Baseline | `33f021aaacd6d7ed68c508d92901e7442d99586c` | `4b7b68a48acb7bd83665f7e97239d68c018f61ed` | 38 |
| Candidate | `c9e1530f0f6c2baa78bf5107cfeb634f09a68b83` | `ed342ef9ef43a3349b06c4e9a15b9e84617a9cfd` | 40 |

The contribution changes only `src/workers-ai.mjs`, `tests/workers-ai-contract.test.mjs`, and `.github/workflows/test.yml`. The candidate adapter SHA-256 is `d69676fceb4a3782e6eaa7edcff4d5a4d1b7d89fc0d4e642d3bdca6e079a938e`.

I read the complete adapter, its author tests, the diff, package configuration, workflow, author receipt, and relevant application references. No applicable `AGENTS.md` was found in the source or its ancestors. I imported the actual exported adapter from independent snapshots under this review directory. The author's checkout was not edited; all 40 tracked files still matched the frozen head and its status was clean after verification. `evidence/source-pins.json` contains each snapshot file's Git blob, SHA-256, and byte count.

## Receiving evidence

The independent harness has 15 cases. It exercises `interpretWithWorkersAI` through local promise-based `AI.run` doubles; it does not replace the validator with a test implementation. A throwing `fetch` sentinel prevents accidental network use by the harness or adapter. No model, provider, remote runtime, or UI connection occurred.

| Independent case family | Candidate | Baseline | Consequence |
| --- | ---: | ---: | --- |
| Mixed Unicode at the exact title/evidence limit, literal JSON and escaped response envelopes | 4/4 pass | 0/4 pass | Serialized valid text is accepted at the schema's character boundary. |
| Corresponding mixed Unicode one character beyond the limit | 4/4 pass | 4/4 pass | Upper bounds remain enforced. |
| Exact-limit ASCII with controls, quotes, and backslashes through both transports | 4/4 pass | 4/4 pass | Accepted text survives parsing and validation verbatim. |
| Overlapping calls settled in reverse order with retained-schema mutation | 1/1 pass | 0/1 pass | Requests receive independent nested schema objects; later requests remain pristine. |
| Deeply frozen ordinary JSON data returned through the async adapter | 1/1 pass | 0/1 pass | The returned result can be edited without modifying retained input. |
| Delayed rejection alongside an independently successful call | 1/1 pass | 1/1 pass | Error identity, result routing, and absence of retries are preserved. |
| **Total** | **15 pass, 0 fail** | **9 pass, 6 fail** | **Candidate exit 0; baseline exit 1.** |

The four baseline Unicode failures are ordinary serialized receiving counterexamples. Test strings are constructed from counted Unicode scalar values, including characters outside the Basic Multilingual Plane, a combining character, and escaped controls. Their expected lengths come from the construction count independently of the adapter's string-iteration implementation. The harness checks the entire returned value, not only successful completion.

JSON Schema's `maxLength` describes a string's character count. RFC 8259 describes how an escaped UTF-16 surrogate pair represents one character outside the Basic Multilingual Plane. The old JavaScript `value.length` check counted UTF-16 code units and refused the four valid exact-limit examples. The new conservative code-unit precheck followed by a code-point count accepts them while refusing the corresponding one-above cases. The text is preserved without normalization or trimming. References: [JSON Schema validation §6.3.1](https://json-schema.org/draft/2020-12/json-schema-validation#section-6.3.1) and [RFC 8259 §7](https://www.rfc-editor.org/rfc/rfc8259#section-7).

The two other baseline failures establish JavaScript object-origin contracts. They are useful isolation and editability checks; they do not demonstrate a live exploitation path. The existing requirement for nonblank text and the absence of a checkpoint-count cap are preserved. This review does not claim that the stronger nonblank requirement follows from `minLength` alone.

## Static contract and workflow assessment

The validator accepts exact own enumerable data fields and returns detached ordinary objects. It refuses accessors, extra own fields, and sparse or decorated arrays. For ordinary objects, inspecting descriptors avoids executing property getters. These checks are not a promise to safely inspect arbitrary hostile proxies or a mutated JavaScript realm.

The actual async adapter captures the selected binding once, preserves method receiver behavior, dispatches one request, gives each call a fresh nested schema, parses its supported result forms, and validates the result. The receiving harness verifies concurrency, both serialized transports, ordinary direct data, and rejection behavior. The shipped UI uses the local agent path and has no adapter consumer, so this contribution establishes the exported adapter boundary rather than live AI adoption.

The new workflow is a `pull_request` Node 24 `npm test` job with `contents: read`, checkout credential persistence disabled, a five-minute timeout, and per-PR cancellation of superseded runs. It contains no deployment job. I reviewed the workflow source; I did not execute hosted CI. The complete author suite was not rerun here: the independent 15-case suite supplies distinct receiving evidence, while the author's own test results remain in the separate production receipt.

## Reproduction

Restore the two pinned commits into separate `baseline` and `candidate` directories, preserving their repository-relative paths. The source snapshots are omitted from the compact packet; the full file manifests establish their exact identity. From the directory containing `independent-receiving.test.mjs`, run with Node 24:

```sh
node --check independent-receiving.test.mjs
SCOPESIGNAL_REVIEW_SOURCE="$PWD/candidate" node --test --test-reporter=tap independent-receiving.test.mjs
SCOPESIGNAL_REVIEW_SOURCE="$PWD/baseline" node --test --test-reporter=tap independent-receiving.test.mjs
```

The final command is an intentional negative control and returns exit 1 with six failures. Its complete failure output is retained, including the four Unicode refusals, shared-schema assertion, and frozen-output assignment error. The machine receipt records the exact absolute commands executed for this review.

## Evidence pins

| File | SHA-256 |
| --- | --- |
| `independent-receiving.test.mjs` | `7eb26adb6b05dcc121fb6b4158a9684c4b8b4f48e778d0798ef13d3297bc2e43` |
| `evidence/source-pins.json` | `fd0f0f939daec063d0fdddb0ca22f659685bf0455c8cfa9cc3bfeb3c8993dea3` |
| `evidence/candidate-independent.tap` | `04cf717c192efcf9518a0b16a90ef5a7dc07454420ac404b494dcb4b487fae20` |
| `evidence/baseline-independent.tap` | `9582eeae937e0bac2457572c46a873e9123692a632a27b1052fb7fa3bf1c06e1` |

`evidence/independent-receipt.json` records the decision, commands, toolchain, results, workflow assessment, and scope limits. `SHA256SUMS` seals the review, harness, receipt, source manifests, raw TAP logs, and recorded exits. Integration and publication remain with the root owner.
