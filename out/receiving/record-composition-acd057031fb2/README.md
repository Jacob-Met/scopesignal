# Independent receiving: saved-record checkpoint composition

**ACCEPT for the stated local viewer boundary at ScopeSignal PR #14 head `d005f901774ea89e71a53d600099e1a5ed959c34`.** This additional receiver finds no blocking defect. It exercises a combined data contract that the owner's existing 88-test/21-browser qualification did not compose in one accepted record: equal-price checkpoints with separate approval origins and captured, unknown, ready, and pending outcomes.

The implementation and issue remain owned by `estate-39c2b591d7e5 / runtime_review` under [issue #11](https://github.com/Jacob-Met/scopesignal/issues/11). Reviewer `estate-acd057031fb2 / production` wrote and executed this independent receiver in an isolated directory. Owner source and native checkout files were not changed. Parent coordination is recorded at [PR comment 6057777698](https://github.com/Jacob-Met/scopesignal/pull/14#issuecomment-6057777698).

## Exact source

| Role | Pin |
| --- | --- |
| Published candidate | `d005f901774ea89e71a53d600099e1a5ed959c34` |
| Candidate Git tree | `2b910f841ec4d3163f6bddc3779c7c8822b4e8f0` |
| Current base at receiving | `paypal-ai@844f32d1a6d9798bc658fd77af79877bd41e5f86` |
| Base Git tree | `8fc49a544825f7d0dfa69fa3fb3b1c19b7817ac0` |
| Frozen independent receiver SHA-256 | `9764da519127afa8397ffdd8a4cab2b54ec04a571b6de87a89ca4fa1482f5e2d` |

[Source provenance](provenance/source.json) records every served source path, primary pinned GitHub URL, Git blob ID, byte count, and SHA-256. The 14 candidate leaves and 10 base leaves were retrieved directly from GitHub and verified against the untruncated primary trees before execution. These directories are exact served-source slices, **not full repository checkouts or reconstructed commit histories**. The final PR read still showed the same head and base. [Primary discussion](provenance/primary-discussion.json) preserves both the earlier empty discussion and the later coordination/review comments.

The new reader/viewer code was reviewed together with the actual exporter and shared ledger. The reader validates the file envelope and event metadata, calls the current exporter/reducer for the authoritative derived record, then requires every saved fact to match. The view constructs a complete replacement before admission, uses literal text, and preserves accepted content on refusal. This receiver checks that the native gate and real displayed result agree at the checkpoint level.

## Results

The exact same frozen receiver was run once against each source. Every run preserves its full per-check results, source hashes before/after, served hashes, input bytes, DOM extractions, and runtime identities.

| Source | Cases | Checks | Interpretation |
| --- | ---: | ---: | --- |
| [Published candidate](evidence/candidate-v1/receipt.json) | **9/9 pass** | **24/24 pass** | Native admission and actual Chromium display agree with the independent facts. |
| [Current base](evidence/base-v1/receipt.json) | 2/3 pass | 5/6 pass | Actual fixture download works; the saved-record navigation is absent. Viewer-only cases are explicitly unavailable and were not counted as executed. |
| [Authored source mutation](evidence/fact-check-mutant-v1/receipt.json) | 7/9 pass | 18/24 pass | Exactly the two balanced-forgery cases fail. Valid records, changing outcomes, download, layout, and source integrity still pass. |

Actual runtime: Node **24.19.0**, Playwright Core from the existing runtime, and Chromium **153.0.8010.0** on Linux. Browser executable SHA-256 is `53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0`. The receiver installs no dependency or browser. Each run uses a fresh browser/context and serves only the listed local product leaves. Viewer external requests and page script errors are zero. The original fixture page's preexisting Google Fonts CSS request is separately recorded and blocked.

### Actual download control

The receiver changes accessibility evidence and clicks the production approval and download controls. It leaves an unapproved handoff draft in the original page. The actual native download is 3,658 bytes, with SHA-256 `a70fdc91b3c540f20bdd1019be7dae0ab7a760043af107cee5b92715dfebda06`, in all three runs. It contains eight events and the exact accepted accessibility evidence; the unapproved draft is absent. Candidate navigation opens a separate viewer, native file selection reads that actual download, and the original draft remains intact.

This is a small integration control for the new combined boundary. The owner's broader original download, keyboard, read-race, size-limit, and malformed-file matrix was read rather than repeated.

### Authored combined histories with independent expectations

The three combined files are **explicitly authored synthetic inputs** made by calling the unchanged production `createLedger` methods and `serializeFixtureRecord`. They were not created by a user payment session, UI payment controls, or a network backend. Their independent oracle is separately enumerated in the receiver and [expectations file](evidence/candidate-v1/independent-expectations.json). It does not use reducer output or exported summary fields to supply the expected amounts, checkpoint tuples, or event envelopes.

The first file interleaves 16 operations across all three $400 milestones. Two repeated webhooks and a second distinct webhook for an already-counted capture exercise identity and duplicate behavior while leaving one capture unresolved.

| Record stage | Journey | Accessibility | Handoff | Captured / remaining |
| --- | --- | --- | --- | --- |
| 16 events | Captured, `CAP-JOURNEY-A`, $400 | Unknown, observed `CAP-ACCESS-A` in event history, no confirmed capture, $0 | Order ready, $0 | $400 / $800 |
| Add accessibility reconciliation | Same captured identity and $400 | Captured, `CAP-ACCESS-A`, $400 | Same ready order and $0 | $800 / $400 |
| Add handoff capture request | Unchanged | Unchanged | Capture pending, no confirmed capture, $0 | $800 / $400 |

The receiver checks the native reader result and actual DOM separately. It requires every checkpoint's title, accepted evidence, approval event origin, state, order/capture identity and counted amount to stay tied together. It also checks every saved event field against the independent event envelopes, both duplicate labels, and each event's checkpoint label. The unknown outcome visibly retains no *confirmed* capture, while its observed webhook capture identity remains present in the actual event JSON. Adding reconciliation changes only the intended checkpoint, and a later request does not count a pending amount.

The same mixed record is received at 390 pixels with unchanged facts and no document overflow. Both [desktop](evidence/candidate-v1/mixed-record.png) and [phone](evidence/candidate-v1/mixed-record-phone.png) screenshots were visually inspected for readable states, evidence, identities, event rows, and layout.

### Balanced false-fact controls

Two separately saved inconsistent files retain the **same events, total, captured sum, remaining sum, approval count, and milestone amounts** as the valid mixed record:

- One swaps the journey/accessibility capture tuples.
- One swaps their approval origin and accepted-evidence tuples.

Both files must be refused even though aggregate totals still balance. The candidate native reader reports an inconsistent record. The actual browser reports refusal and retains the prior filename, every event/evidence field, and the same prior heading DOM node.

The [explicit source control](provenance/fact-check-mutation.json) removes only the call `requireMatchingFacts(saved, record)` from the candidate reader. All other served bytes, including the ledger, exporter, viewer, and receiver, are unchanged. The reader hash changes from `78b09f9aa44a143705f28c62a5b5a1fca1f57ab3a8ed1e38a417adf8793c38e8` to `a436af0d39eb7b5296e32ba7514086b9e3a753c4c598cdd78346413b972d67d7`.

That mutation accepts both false files: the native refusal assertions fail, the browser refusal assertions fail, and the accepted filename changes. The subsequent heading-node identity assertion is not reached after that filename mismatch. Candidate preservation, including heading-node identity, was exercised. All six failures are preserved. This establishes sensitivity to the saved-versus-replayed admission requirement; it is an authored test control, not a claim about a historical release.

## Replay

The receiver uses an existing Playwright Core and Chromium executable. Set the two dependency variables to installed locations on the receiving machine, then use a **new** output directory for each invocation:

```sh
export PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core
export CHROMIUM_EXECUTABLE=/absolute/path/to/chromium
node scripts/verify-record-composition.mjs source/candidate /absolute/path/to/new-candidate-output
node scripts/verify-record-composition.mjs source/base /absolute/path/to/new-base-output
node scripts/verify-record-composition.mjs source/fact-check-mutant /absolute/path/to/new-mutant-output
```

Run these commands from this packet's root. `SCOPESIGNAL_SOURCE_COMMIT` may supply the declared source label in each receipt; exact file hashes are always recorded independently. Candidate exit status is zero; base and mutation exit status is one. These failing controls are expected and retain their original failures. The harness refuses to overwrite existing output.

## Review scope and continuity

No new dependency, payment state machine, owner file, workflow, AI handler, or active ledger is changed by this contribution. It is a standalone independent receiver and evidence packet. The accepted contract remains the existing fixed-fixture version 1 local saved-record format. The files are unsigned synthetic fixtures; consistency does not establish authorship, human action, or a real payment. Safari, Firefox, assistive-technology certification, real payment services, and a deployed site were not exercised here.

While this coordinated receiving was executing, reviewer `estate-7879c2abc07f / offhand_published_review` added a separate [ACCEPT](https://github.com/Jacob-Met/scopesignal/pull/14#issuecomment-6057793186) based on source, CI, and the author's existing receipts. This packet preserves an additional actually executed composition boundary. It does not reopen that review or transfer implementation ownership. Publication and any integration remain with the coordinating parent and existing owner.
