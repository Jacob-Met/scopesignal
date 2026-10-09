# Combine planned checkpoints

Open `scope-combine.html` from the scope workspace's separate-tab link. This local fixture tool prepares a new editable workspace file when two planned acceptance stages should become one.

## Operator sequence

1. In the ordinary scope workspace, download an editable draft. A reviewed fixture requires the existing explicit revision-draft action before it can be used here.
2. Choose that JSON file and press **Open selected draft**. Inspect its loaded project and checkpoint details.
3. Choose exactly two checkbox positions. Equal-looking rows remain distinct positions.
4. Enter both a replacement deliverable and planned evidence. The tool does not fill either description from the selected rows.
5. Press **Preview combined draft**. Inspect the two original rows, their exact combined amount, every resulting row, project fields, ordinary draft validation and the exact JSON.
6. Press **Download combined draft** once to save one new `scopesignal-combined-draft-v1.json`.
7. In the ordinary workspace, use **Open saved workspace**, inspect the preview and explicitly choose **Replace workspace**. Continue ordinary review there.

The lower selected position receives the replacement and the higher position is removed. Every unselected row and project field remains structurally exact, including unfinished content. Selection order does not change placement. The source file is not written, and the current authoring workspace stays open in its original tab.

## Money and text

Both selected amount strings must independently pass the existing `parseDollars` positive safe integer-cent parser. Their integer-cent sum must also be safe. The existing `dollars` formatter writes that sum with two decimal places. No rejected amount is rounded or coerced.

Replacement text passes the existing per-row review checks and the native workspace codec's text admission. Deliverables are nonblank, at most 160 characters, on one line. Evidence is nonblank, at most 5,000 characters, with LF line breaks allowed. Exact entered whitespace, Unicode and allowed line breaks are preserved. Text fields have no browser maxlength clipping; validation sees the complete entered value.

Ordinary whole-draft validation is descriptive. A different unfinished field does not prevent an otherwise valid combination. An invalid or unfinished total is shown as such. Passing field checks does not approve any work.

## File and lifecycle boundaries

Only complete native v1 editable draft files are admitted, with strict UTF-8 and a 1 MiB limit. Review-stage envelopes are refused before the existing decoder can replay their private fixture history. Draft files carrying events or review evidence are refused by the unchanged decoder. Native unsupported fields remain unsupported.

The output uses the existing ordinary v1 encoder with draft stage, zero events and zero evidence drafts. There is no automatic persistence, provider call, original-file write, approval or payment action.

Selection or replacement-text changes, file selection, cancel, clearing the source and page retirement discard the prepared output. A refused or canceled replacement file keeps the last successfully loaded draft and entered replacement details, but requires a fresh preview. Generation and selected-file identity checks discard stale asynchronous reads. The download action checks the current input signature again.

All file names and draft text are rendered as literal text. Native checkboxes, labels, buttons and a focused preview heading support keyboard review. The layout wraps long admitted content at narrow widths.

## Focused checks and the runtime gate

The repository declares Node >=24. On that runtime:

```sh
node scripts/check-scope-checkpoint-combine.mjs
npm test
```

The first command runs the focused combine cases; it does not replace the full project test gate. On an earlier available runtime, an explicitly bounded observation can be run with:

```sh
node scripts/check-scope-checkpoint-combine.mjs --observe-current-runtime
```

Its receipt declares the actual Node version and whether the required runtime is available. Such observations do not satisfy an unavailable Node >=24 or full-project gate.

Browser receiving must additionally exercise actual file input, selection and edit retirement, stale reads, keyboard review, a narrow viewport, one physical download and complete-object import through the unchanged ordinary workspace. Focused model tests cannot establish these browser outcomes.

## Source boundary

The page, stylesheet, combine modules, focused test, check script and this document are additive. Existing `scope.html` and README changes add discovery and usage text only. Shared money, plan, ledger, payment, draft codec, package and workflow files are unchanged. Existing allocation, split, CSV, comparison, review-pack, history and paste scopes keep their owners.
