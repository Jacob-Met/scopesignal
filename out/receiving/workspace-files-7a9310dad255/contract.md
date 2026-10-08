# ScopeSignal saved workspace — receiving contract before implementation

Author: estate 7a9310dad255 / production. The current source is Jacob-Met/scopesignal, paypal-ai at 317c1aad0bc6d68e4f4d3c70863b481741a61fb5, tree 2b910f841ec4d3163f6bddc3779c7c8822b4e8f0. Native baseline: /Users/me/scopesignal-workspace-7a9310dad255/source on Mac 0e3d582f-e25b-44b2-8418-9639fc4e4e33. No candidate implementation exists when this contract is written.

## Product boundary

The authored scope page supports an explicit local JSON download and local-file open, including unfinished drafts and reviewed synthetic sessions. Reload still clears page memory; a saved file can restore the workspace and allow the next ordinary user-selected fixture step. Nothing is automatically stored, uploaded, approved, captured, or sent to a provider by saving, selecting, previewing, or applying a file. These unsigned files contain fictional workspace data and do not establish identity, real human action, or payment evidence.

The existing scope model and ledger are consumed without edits. The fixed-example app.mjs remains owned by PR15; the fixed-example exporter and separate record viewer remain intact. New source is src/scope-workspace-record.mjs. Existing seams are scope.html, scope-workspace.css, src/scope-workspace.mjs and README.md, plus distinct tests and evidence.

## File contract

Fixed download filename: scopesignal-workspace-v1.json. UTF-8 JSON, at most 1 MiB. Exact top-level keys: schema, version, fixtureOnly, paymentEvidence, stage, draft, events, evidenceDrafts. Constants: schema = scopesignal.scope-workspace; version = 1; fixtureOnly = true; paymentEvidence = false. stage is draft or review.

draft retains the exact editable strings in {label, brief, cap, checkpoints}; checkpoints is a dense list of 1–12 exact {title, amount, evidence} objects. Maximum string lengths in UTF-16 code units match existing authoring controls: label120, brief8000, title160, evidence5000. cap and amount raw strings are at most64 characters. A draft may be unfinished or contain an invalid amount/allocation: it must reopen as that exact unfinished draft and still face the ordinary review validation.

A draft-stage file has events:[] and evidenceDrafts:[]. A review-stage file must have a valid plan and an exact reachable history of the existing createScopeReview controls. events contains the complete canonical generated event objects, in order, up to96 entries; event sequence, logical time, identities, amounts, currency, environment, duplicate facts and accepted text must match a reconstruction through the unchanged model. Unknown remains unknown and uncounted. No alternate ledger or transition rules are introduced.

evidenceDrafts is a list of distinct {checkpointId,text} entries for existing unapproved checkpoints only, up to12 entries and5000 characters each. Accepted text belongs to the canonical approval event and remains read-only; a pending draft stays separate and exact. All unexpected/missing fields, unsupported versions/stages, invalid types, out-of-bound values, malformed JSON, invalid UTF-8 or inconsistent histories are refused.

## UI contract

The existing authored page is scope.html. Existing authoring and simulation selectors/behavior remain.

- #scope-save: Download workspace button; captures current DOM draft or review plus unapproved evidence drafts without changing workspace state.
- #scope-open: labeled native file input for a saved workspace.
- #scope-file-status: live status/refusal text.
- #scope-open-preview and #scope-open-summary: show a successfully validated file's project, stage, checkpoint/approval/event counts before replacement.
- #scope-open-apply: explicit Replace workspace button. Selection and preview do not change current draft, evidence, events, totals or available actions.
- #scope-open-cancel: Cancel open; cancels pending reads or a preview.
- #scope-file-origin: visible notice for an opened unsigned fictional workspace.

Application is atomic. Invalid/unreadable/oversized files preserve the current workspace and leave no applicable preview. Newer selections supersede older pending reads; cancellation prevents late completion from applying or restoring a preview. Editing the current draft/evidence, adding/removing a row, entering/leaving review or recording a simulation action invalidates a pending read/preview so an old read cannot erase newer work. Re-selecting the same file is supported. Applying a validated preview restores the exact stage, draft strings, accepted/pending evidence, event history, reduced totals/outcomes and legal next actions; the next explicit action uses the same existing model.

## Required receiving

Freeze independent cases before reading candidate code. Exercise actual downloaded bytes and native file selection on desktop and phone. Cover unfinished draft round-trip; reviewed mixed checkpoints with unknown/duplicate history and literal multiline Unicode evidence; explicit preview/cancel/apply; next-action equivalence; malformed/schema/size/type/history/UTF-8 refusals preserving complete active work; delayed reads, superseding selection, cancellation and current edits; download refusal/retry; unchanged original fixture and its existing downloads. Check keyboard usability, phone overflow, source hashes, page errors and unexpected network activity. Keep baseline absence/reload loss distinct from candidate results and retain meaningful failures.

Ownership reads: full current138-leaf tree has no AGENTS/ownership file; authoring #9/#10 and saved fixed-record #11/#14 are merged, with closed owner receipts. PR15 remains a separate app.mjs receiving lane. Latest native authoring/record-viewer records show no active saved-custom-workspace claim. Public source coordination is prepared but deferred during the account-wide GitHub write cooldown.
