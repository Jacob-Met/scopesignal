# ScopeSignal

**Creative brief → editable acceptance checkpoints → human-approved milestone payment.** ScopeSignal makes payment scope explicit and recoverable when payment systems behave badly.

This first public slice is a static, fixture-only experience. It demonstrates approval gating, a PayPal Sandbox-shaped order/capture lifecycle, an unknown capture after a lost response, duplicate webhook idempotency, and reconciliation without double counting. The visible fixture is deterministic and contains no real payment evidence, customers, or credentials. No PayPal API is called and no live-money action exists.

## Run locally

Requires Node.js 24 or newer; no dependencies or paid services are needed.

```sh
npm test
npm run serve
```

Open `http://127.0.0.1:4173`. The fixture has three $400.00 milestones, a $1,200.00 project cap, and a deterministic seven-event path. The first checkpoint is human-approved, creates a Sandbox-labeled fixture order, loses the capture response, receives the same webhook twice, and reconciles once. Captured value remains $400.00, never $800.00.

The capture callout and recovery reviewer describe the current reduced ledger. After the complete replay, they show the captured outcome; the lost response remains visible in the event history. Before reconciliation, the outcome stays unknown even after the duplicate webhook. A pending request is also kept distinct from a captured outcome.

Open **Inspect the recovery, event by event** to explore the original payment story from before human approval through all seven events. Use Previous event, Next event, or the event selector to inspect each capture state, recorded identity, approval count, and amount counted. The capture stays unknown and the counted amount stays $0 through both webhook receipts; reconciliation counts $400 once.

This is a read-only view of the original fixture. Navigating it keeps the workspace's current approvals and evidence edits intact. The existing Replay deterministic fixture button still resets the workspace.

Timeline model tests run with the existing test command. Its optional real-browser receiving command is:

    node scripts/check-fixture-timeline.mjs

It uses the same existing Playwright/Chromium environment options described below, writes receipts and screenshots to out/timeline-receiving by default, and checks desktop, phone, keyboard navigation, workspace preservation, and isolated timeline startup failure. SCOPESIGNAL_EVIDENCE can choose another output directory.

Optional browser receiving checks run with `node scripts/check-browser.mjs`. They require an existing Playwright and Chromium installation; `SCOPESIGNAL_PLAYWRIGHT` may point to its entry module and `SCOPESIGNAL_CHROME` to its browser executable. The command serves this source on an ephemeral loopback port, launches fresh desktop and phone contexts, blocks external requests and writes a receipt under `out/browser-receiving/`. The existing Google Fonts stylesheet attempts are recorded and blocked, so captures use fallback fonts. `SCOPESIGNAL_CHECK_SCOPE=combined-drafts` additionally checks the separate draft-preservation and webhook-label PRs when those changes have been incorporated into the tested source.

## Save a reviewed fixture record

Choose **Download fixture record** above the event ledger to save a versioned JSON snapshot. The file includes this fictional fixture's checkpoint definitions, recorded approvals, exact accepted evidence, current reduced capture outcomes and event history. It is explicitly labeled synthetic fixture data and is not a payment receipt or evidence of a real transaction.

Accepted evidence comes from its `checkpoint.approved` event. Text still in an unapproved textarea, or an unrecorded edit to an already-approved field, is not an approval and is not included. Downloading does not change the ledger or save anything in browser storage. Keep the file if you want to inspect the recorded review after a page reload. The separate saved-record viewer can read it locally; it does not restore the active fixture.

The file uses schema `scopesignal.fixture-record`, version `1`, and the fixed name `scopesignal-fixture-record-v1.json`. The optional native browser harness can exercise actual downloads with `SCOPESIGNAL_CHECK_SCOPE=fixture-record node scripts/check-browser.mjs`, using the installed browser options described above.

## Inspect a saved record

Choose **Inspect a saved record** beside the download button. It opens record.html in a separate tab, keeping the current fixture and unapproved drafts in their original tab. Choose a saved version 1 fixture-record JSON file to read its exact accepted evidence, checkpoint outcomes, totals and complete recorded event fields. The viewer accepts the fixed fixture format, up to 1 MiB of UTF-8 JSON and 512 events. It supports unfinished histories as well as completed recovery; an unknown outcome remains unknown.

The reader checks the saved facts against the same ledger and exporter used by the fixture. Missing, extra, unsupported or inconsistent fields are refused. Invalid JSON, unsupported versions, file-read errors and oversized files leave the previously opened record intact. Choosing another file replaces the display only after it passes these checks; a slower earlier selection cannot replace a newer one. **Clear view** removes the displayed record and cancels any pending selection.

The file stays on the device. The viewer has no external assets, network service, browser-storage writes or payment controls. Reloading clears the view; choose the saved file again to reopen it. These unsigned synthetic files are not proof of identity, human action, payment or a real transaction. This page inspects the existing fixed-fixture export and does not import an editable scope plan into the ledger.

Reader tests run with npm test. Optional native browser receiving runs with node scripts/check-record-view.mjs and requires an existing Puppeteer Core and Chromium installation. Set SCOPESIGNAL_PUPPETEER to the Puppeteer Core module and SCOPESIGNAL_CHROME to the browser executable; SCOPESIGNAL_SOURCE and SCOPESIGNAL_EVIDENCE can choose the source and output directories. The receiver uses fresh desktop and phone contexts, actual exported downloads and native file selection, blocks external requests, and retains screenshots plus a source-hashed receipt. It also checks keyboard operation, retained reviews after refusal, competing reads and explicit clearing.

## Author a fixture scope

Choose **Build your own fixture scope** below the example checkpoints, or open
`http://127.0.0.1:4173/scope.html`. This flow turns an editable fictional brief
into checkpoints you can actually review and step through. The original
seven-event Northstar example remains available from the return link.

1. Edit the project name, brief, USD cap, and each checkpoint's deliverable,
   amount, and planned acceptance evidence. Add or remove checkpoints before
   review, and use **Move up** or **Move down** to arrange their order. Each
   checkpoint's three fields move together, preserving unfinished input. The
   controls also work with Tab and Enter or Space; movement announces the new
   position and keeps focus with the moved checkpoint. The plan supports 1–12
   checkpoints. All amounts must be positive,
   use at most two decimal places, and fit within the project cap. Unallocated
   cap is shown separately from the remaining allocated milestones.
2. Select **Review this scope**. This prepares an unapproved plan with zero
   events. You can return to the draft while no checkpoint is approved; edits
   made to review evidence come back with you.
3. Review each checkpoint's evidence and explicitly approve it. Its recorded
   accepted text becomes read-only, other evidence drafts survive, and the
   scope's deliverables and amounts are locked for that fixture session.
4. Use the explicit simulation controls to create an order, request capture,
   record a webhook or lost response, inspect a duplicate, and reconcile an
   unknown result. Each control records one event in the existing fixture
   ledger. An uncertain capture cannot be requested again, and receiving a
   webhook while uncertain does not itself reconcile that outcome.

The fictional plan and its events stay in this page's memory. Use **Download
workspace** to keep an explicit local file before leaving or refreshing.
**Open saved workspace** checks a chosen file and shows a preview; only
**Replace workspace** replaces the current page's work. All simulation controls
continue to use the local fixture ledger; no payment or AI service is called.

`node scripts/check-scope-draft-order.mjs` runs optional desktop and phone
receiving for checkpoint movement. Set `SCOPESIGNAL_PUPPETEER` to an installed
Puppeteer module and `SCOPESIGNAL_CHROME` to an installed Chrome/Chromium
executable. `SCOPESIGNAL_SOURCE` and `SCOPESIGNAL_EVIDENCE` select the source and
output directories. The receiver uses a fresh headless profile and local
fictional drafts, blocks external requests, and records keyboard/pointer
movement, validation, native workspace downloads/reopening and stale-read
invalidation. It does not install a browser or call a provider.

### Save and reopen an authored workspace

The workspace file preserves an unfinished draft's exact strings, including
empty fields or amounts that still need correction. Ordinary validation remains
in place before review. For a reviewed scope it also preserves the recorded
fixture events, accepted evidence, other checkpoints' pending evidence drafts,
current outcomes and available next steps. An unknown capture stays unknown
and counts nothing until the same explicit simulated lookup.

The fixed filename is `scopesignal-workspace-v1.json`, using schema
`scopesignal.scope-workspace`, version `1`. The page admits up to 1 MiB of
UTF-8 JSON, 1–12 checkpoints and 96 canonical fixture events. It reconstructs a
review through the existing authoring controls and checks every saved event
against the generated history. Missing, extra, unsupported or inconsistent
fields, invalid UTF-8, malformed JSON and unreadable or oversized files are
refused before replacement.

Selecting a file and inspecting its preview keep the active workspace intact.
Canceling an open, choosing a newer file, or editing the active workspace
invalidates an older pending read or preview. A refused file leaves the current
brief, evidence, events and totals unchanged. Re-select the file when ready to
replace the workspace; download the current work first if you want to keep it.

The file choice is bound to the workspace before the native chooser opens,
and current field values are checked again before replacement. Newer edits
made during a chooser, read or preview are kept. Editable textareas use LF
line breaks; project/checkpoint names and amount fields stay on one line.
Editable field values containing CR, or LF in single-line fields, are refused
before preview so native form assignment cannot silently change their values.
CRLF formatting between JSON fields is still accepted.

Saving and opening use no automatic browser storage or network service.
Reloading still clears memory until a saved file is opened again. These
unsigned files contain fictional data and do not verify identity, human
approval or payment. This authored-workspace format is distinct from the fixed
example's read-only fixture-record download and viewer.

`node scripts/check-scope-workspace.mjs` runs the optional desktop and phone
browser receiving checks with the same installed Playwright/Chromium variables
as `scripts/check-browser.mjs`. It blocks external requests and records served
source hashes, observed behavior, and screenshots. No packages are installed.

## Download an authored scope review

In the authored workspace, **Download scope review** saves
`scopesignal-scope-review.html`. Open it directly in a browser to read offline,
or use the browser's Print command to print or save a PDF. The standalone file
contains no scripts, external resources or payment controls. Event amounts remain
raw integer cents and are explicitly labeled; checkpoint and summary values are
formatted in dollars. Printing uses the local browser and its installed fonts.
Some Unicode symbols may lack glyphs in a resulting PDF; keep the original HTML
and JSON when exact text matters. The HTML retains the original Unicode text.

An unfinished draft retains the exact entered fields, including empty or
invalid amounts, and is labeled unfinished without calculated totals. A reviewed
scope includes its checked terms, separate planned and accepted or pending
evidence, current simulated capture states, exact USD amounts, and every recorded
event field. Accepted evidence comes from its recorded approval. Pending editor
text is never presented as accepted; unknown and pending captures remain uncounted.
Unallocated cap and allocated remaining amounts are shown separately.

The review is an unsigned fictional snapshot, not evidence of a real approval
or payment. It cannot restore an editable workspace; keep the separate JSON
download for that. Exporting changes no approvals, events, drafts or prepared
open preview. A failed preparation leaves the workspace intact and can be retried.
Text containing NUL or unpaired UTF-16 surrogates is refused because HTML cannot
preserve it; the workspace JSON can still retain those original strings.

Native tests run with `npm test`. The optional actual-browser receiver is
`node scripts/check-scope-review-export.mjs`, using the existing
`SCOPESIGNAL_PLAYWRIGHT`, `SCOPESIGNAL_CHROME`, `SCOPESIGNAL_SOURCE` and
`SCOPESIGNAL_EVIDENCE` options described above. It exercises actual downloads,
offline file reading, phone and keyboard operation, failure/retry, unchanged
workspace/preview, and Chromium PDF printing. It uses authored fictional inputs
and blocks external requests; no packages or provider services are needed.

## Payment safety model

- A milestone cannot create an order until a human explicitly approves it.
- Capture requires an approved milestone's order.
- A pending capture cannot be requested again. Only a pending request can transition to `unknown` after a lost response; a late loss cannot undo a recorded capture.
- Duplicate webhook `eventId` is recorded for audit but ignored for counting only when its checkpoint, capture, amount and currency match the original receipt. Conflicting reuse is refused.
- A capture ID belongs to one checkpoint, and each checkpoint has at most one capture ID. A receipt observed during an unknown outcome retains this binding without counting the amount before reconciliation.
- Reconciliation is allowed only for an unknown capture and is applied once.
- The in-memory append-only ledger is deterministic; sequence numbers and logical times are fixture values, not a durable ledger or PayPal records.
- This demo does not authenticate, authorize, or execute payments.

The ledger methods and `append` use the same transition validation as `reduce`.
Unsupported events, wrong order/amount/currency/environment bindings and invalid
transitions throw without changing the stored journal. Returned `events` arrays
are frozen snapshots. `append` admits supported scalar payloads and rejects
accessors. The ledger copies its seed at creation, and returned state does not
expose that seed for mutation. Checkpoint amounts and the project cap must use
nonnegative safe integer cents; their total must fit the cap. Checkpoint IDs must
be unique both as authored and under the existing uppercase fixture order-ID
mapping. These are local fixture consistency checks, not provider verification.
The original seven-event replay and its duplicate-receipt audit remain unchanged.

## Separated roles

`src/agents.mjs` has separate brief interpretation, evidence mapping, payment policy, and recovery review functions. They are labeled **local rule preview**, not AI output. They are advisory only; they cannot approve checkpoints or move funds. Evidence remains human-editable.

## AI connector status

`src/workers-ai.mjs` is a fail-closed Cloudflare Workers AI adapter scaffold with strict output checks. It has no configured binding, model result, key, or paid provider fallback. To exercise it requires an eligible Cloudflare account with Workers AI enabled and a Worker deployment configured with the `AI` binding (and a real schema-capable response path). Until those prerequisites exist, the UI correctly reports **disconnected**. The app makes no external AI request.

Do not add secrets to this repository. Any later PayPal connector must be Sandbox-only, server-side, host-only configuration; credentials must never enter browser code, source control, logs, or fixture output. Never use customer data. No live-money API is permitted in this slice.

## CI and hosting

- GitHub Actions runs tests on Node 24 and deploys the static fixture to GitHub Pages on `paypal-ai` pushes. Pages is public and free when repository/account settings permit it; deployment can require repository Pages settings to select GitHub Actions.
- GitLab CI runs the fixture tests as an evidence job when mirrored to GitLab.

## Scope and readiness

The public slice is not represented as satisfying a contest AI requirement and is not submittable as an AI/Sandbox-integrated product until an approved AI integration and PayPal Sandbox integration are actually configured and exercised. See `out/result.md` for verified implementation/deployment status.

MIT licensed.
