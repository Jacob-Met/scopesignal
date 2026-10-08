# ScopeSignal checkpoint reuse — final receiving and delivery

Users can select checkpoint definitions from an explicit saved workspace and append fresh editable copies to the current draft in source order. The existing strict codec, complete capacity checks and current-workspace generation checks govern admission. The original title, amount and planned-evidence strings are preserved; a new review begins with fresh review state.

Source authorship remains with `estate-68094585a1c2 / receiving_review`, continued by `scope_receiving`. The independent receiver was `offhand_delivery`. `root` reviewed the source and integrated it. Hosted, public-byte and final artifact delivery is by `chatgpt:68094585a1c2 / delivery_continuation`. Those roles remain distinct across the session resets.

## Actual delivered source

PR [#46](https://github.com/Jacob-Met/scopesignal/pull/46) merged as `6f17ea30fe8659dc4ae47cae6cb3a8e32c1d2508`. The Git commit timestamp is 2026-10-08 at 20:48:09 UTC; GitHub records PR `merged_at` at 20:48:10 UTC. Issue [#35](https://github.com/Jacob-Met/scopesignal/issues/35) closed at 20:48:11 UTC.

The actual ordered parents are `85864b4c4f145985f3123fd43583b049088f22b4` and `47ecf2c41e132bd022d14cc8d20b7d6266f4af74`. Actual tree `245c0dd66c05c17f22e53bf57d9ae5847b36dc9a` has 763 leaves: all 747 unowned leaves from the 750-leaf actual base remain identical, and the contribution occupies 16 paths. Fourteen contribution files exactly match the qualified source composition. The two shared files, README and `scope.html`, include the separately merged library addition.

Main advanced through saved-workspace library PR #43 after the pre-merge check. The resulting actual tree therefore differs from the 748-leaf PR test tree `42407f98c0bb6d0d9eab403e92c1c410ce4c3bf2`. The expected-head merge guarded the source head, not the base. Both states and their evidence are retained.

Root accepted the actual composition in `root-actual-merge-source-review.json`, preserved as exact existing Git blob `3daf86666653e051a8878ee60b62325e5dd54026`. For each shared file, removing this contribution's exact original insertions from the actual merge reproduced the entire new base file; removing the library addition reproduced the entire qualified head file. The incoming runtime work is confined to a separate library page. Its only workspace-page addition is a new-tab, `noopener` navigation link. The import controller and other imported runtime files remain exact. The root receipt also retains an argument-length failure in a receipt helper and its bounded correction; no product executed in that failure.

## Hosted qualification and public bytes

| Phase | Exact checkout | Hosted result |
| --- | --- | --- |
| Historical original published source | `cf5cd76dcb008e3564b63a45fe20fb4d9cf17e59` | Run 37834321918 / job 113507362526: Node 24, 190 passed; preserved in the earlier root review |
| Current pre-merge composition on base `226d6d90` | `f5c9c3d4b62e4067053931e8b609ddc8305fffa0` | [Run 37840665837](https://github.com/Jacob-Met/scopesignal/actions/runs/37840665837), job 113528905488: Node 24.21.0 / npm 11.19.0, 233 passed, zero failures or skips |
| Actual merge on base `85864b4c` | `6f17ea30fe8659dc4ae47cae6cb3a8e32c1d2508` | [Run 37842163319](https://github.com/Jacob-Met/scopesignal/actions/runs/37842163319), test job 113533966067: Node 24.21.0 / npm 11.19.0, 242 passed, zero failures, skips or cancellations |

The actual push workflow is **Fixture-mode Pages deployment**. Its deploy job 113534064044 checked out the same actual merge, identified it as the Pages build version and reported success. The workflow completed at 20:48:56 UTC. Original pre-merge, post-merge and deployment logs are stored under `logs/`; full Git/run/job snapshots and leaf maps remain in the two receiving input JSON files.

At 20:54:01–20:54:02 UTC, the native HTTP receiver made 18 requests to the deployed site. Every response was HTTP 200 and matched the actual merge's expected byte count and Git blob exactly. The receipt and all response bodies are under `public-assets-v1/`. This includes `scope.html`, the current plan module, both new import modules, the import stylesheet, workspace controller, codec, history, removal and supporting styles. Public entry point: [Scope workspace](http://jacobmetoyer.com/scopesignal/scope.html).

The original asset plan for the old PR tree remains as `public-assets-premerge-plan.json`. The current plan binds the actual merge; the observer script itself was unchanged. Its process exited 0 with empty stderr. This was static HTTP-byte receiving: no product code or browser executed, and it does not establish rendered browser behavior.

## Preserved independent evidence and limits

The four files in `../checkpoint-reuse-independent-68094585a1c2/` are the original independent publication, unchanged. Its 106-member archive is 249,369 bytes, SHA-256 `ccf956ce569bdde903d440a2ded0216c664080edb3035a5f9996abfa61bb3dc8`. It was uploaded from the existing sealed bytes, without repacking. Five original native groups passed with 44 unchanged input pins. Their native Node 22.22.1 evidence remains supplemental below the supported Node 24 floor; the separate supported hosted checks retain their exact checkouts and results.

The inherited author capsule, its corrections, and root's earlier source review remain in `../checkpoint-reuse-68094585a1c2/`. The original qualified source is `65209a72c4593358848a6921847a478ce6fba8c3`, tree `57e70cff603e2e03a590daf9f346c565df4dcead`, on original base `cdffd2476cae0c7332dff64677ae814b7f594947`.

The additional current Remove/Undo/import browser witness remains **UNOBSERVED**. Its preserved attempts record the initial ENOSPC condition, a physical-click observer that never completed the initial whole-workspace open, and an observer-only synchronization correction that timed out during DevTools startup with zero page checks and empty stderr. No third browser attempt occurred and no product defect was established by those observer failures. Root's acceptance uses the preserved native and author evidence, full source inverse proofs and explicit lifecycle reasoning. No installed-device qualification is claimed.

## Actions hold and publication

The [primary Actions relay](https://github.com/Jacob-Met/hamon/issues/143#issuecomment-6067592767) was created at 19:36 UTC from the owner's 19:32 update. This root learned and adopted it around 21:09 UTC. The actual 20:48 merge and automatic push/Pages execution had already happened after the owner's update and before that adoption. Compliant timing for those completed executions is not claimed.

For this final publication, the complete inherited workflow inventory was read. `pages.yml` runs on pushes only to `paypal-ai`, or manual dispatch; `test.yml` runs only on pull requests. Neither handles branch creation or issue comments. The unique evidence branch `estate/68094585a1c2/checkpoint-reuse-final-evidence-20261008` is created without a pull request, default/source ref update, dispatch or rerun. It matches neither inherited trigger. Workflow source remains unchanged. The exact trigger inspection and timing are retained in `actions-hold-receipt.json`.

The evidence branch inherits all 763 leaves of the observed current default commit `6f17ea30fe8659dc4ae47cae6cb3a8e32c1d2508`. All new artifacts are confined to the independent and delivery evidence directories. The manifest records exact byte counts, SHA-256 and Git blob identities; final tree/ref/comment readback is recorded on PR #46. No test, browser or public HTTP receiving was repeated during recovery or final publication.
