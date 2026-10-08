# Inspect an authored scope's recorded history

ScopeSignal's authored workspace can show how your own fictional plan changed
after each recorded decision. It accepts the same reviewed workspace that the
page can save and reopen. No second event format or payment workflow is added.

## Use the panel

1. Open `scope.html`, enter a fictional brief and 1–12 checkpoints, and choose
   **Review this scope**. The panel is available even before an approval.
2. Below **Your fixture event ledger**, open **Inspect this scope, event by
   event**.
3. Choose **0 · Before any recorded decision**, an event in the selector, or
   use **Previous event** and **Next event**. **Latest recorded point** returns
   to the final recorded event.
4. Read the historical approval count, simulated captured amount, allocated
   amount still remaining, and unallocated project cap. Each checkpoint keeps
   its own planned evidence and capture state.
5. Open **Recorded event fields** to inspect the exact selected event's
   fields, including its fixture sequence and logical time.

The ordinary review controls and current totals stay above this panel.
Navigating history does not approve, request, repeat, reconcile or undo an
event. It preserves the current pending evidence, downloaded workspace bytes,
and any prepared file-open preview.

A new recorded decision refreshes the panel to the latest event. Editing a
draft or replacing the active workspace clears the previous history before
the replacement is shown. A replacement can reuse checkpoint numbers and a
project name; those names are not treated as identity across files. Reloading
clears the page's in-memory state. Keep the existing workspace JSON and reopen
it to inspect its history again. The selected history cursor is not saved.

## What the historical state means

| Selected point | Approval evidence | Simulated captured amount |
| --- | --- | --- |
| Before any event | None accepted | Zero |
| After a checkpoint's approval | That checkpoint's recorded accepted text | Unchanged by approval |
| After a capture request | Prior approvals retained | The pending checkpoint is not counted |
| After a lost response | Prior approvals retained | The unknown checkpoint is not counted |
| After receipts while unknown | Prior approvals retained | Still uncounted until reconciliation |
| After reconciliation | Prior approvals retained | The resolved checkpoint is counted once |
| After an ordinary pending receipt | Prior approvals retained | That checkpoint is counted once |
| After an exact duplicate receipt | Prior approvals retained | No additional amount |

Unrecorded editor notes never appear as historical approvals. The accepted
text is the native approval event's text, including the native approval
operation's existing whitespace treatment. Planned evidence remains a
separate field. Literal entered markup is rendered as text.

A point is derived from the original plan and its event prefix. The full
workspace is admitted through the existing version-1 workspace reader before
any prefix is exposed. A later inconsistent event therefore refuses the
entire history instead of showing an apparently valid early prefix. The
existing 1 MiB, checkpoint and event limits still apply.

The model captures a private plan and event list. Every read returns detached
state. Navigation operates on that captured model and does not call the active
review. There is no automatic browser storage, new file schema, provider
request or account action.

If the existing workspace serializer or admission reader refuses the current
snapshot, this optional panel clears its old content, disables navigation and
shows an explanation. The active review remains available. A later valid
review or accepted replacement can populate the panel again. This does not
relax any existing save, open, ledger or approval rule.

These are unsigned fictional records. The event sequence and logical times
are not actual payment times and do not establish a person's identity,
approval or a real transaction.

## Native checks

The model tests run with the repository's normal command:

```sh
npm test
```

Optional browser checks use an existing Playwright installation and Chromium.
Set both executable/module paths explicitly. Each output directory must be
new; the commands refuse an existing directory.

```sh
SCOPESIGNAL_PLAYWRIGHT=/absolute/path/to/playwright \
SCOPESIGNAL_CHROME=/absolute/path/to/chromium \
node scripts/check-scope-history.cjs "$PWD" /absolute/path/to/new-history-receipt

SCOPESIGNAL_PLAYWRIGHT=/absolute/path/to/playwright \
SCOPESIGNAL_CHROME=/absolute/path/to/chromium \
node scripts/check-scope-history-lifecycle.cjs "$PWD" /absolute/path/to/new-lifecycle-receipt
```

Both commands serve the actual source on a temporary loopback port and use a
fresh browser context with fictional inputs. They retain source hashes,
observations and actual workspace downloads. The lifecycle check also retains
desktop and narrow-page screenshots. External requests are recorded and
blocked; the inherited Google Fonts stylesheet therefore uses fallback fonts.
Neither command installs packages or calls a payment or AI provider.

The core receiver exercises mixed capture paths, event navigation, exact
recorded fields, accepted-evidence timing, keyboard controls, current-workspace
preservation and narrow layout. The lifecycle receiver exercises zero-event
review, pending-evidence preservation, native replacement, optional-panel
refusal and recovery, and the largest safe integer-cent amount.

Qualification for issue #29 is retained in
[`out/receiving/scope-history-6c20bb4b010e`](../out/receiving/scope-history-6c20bb4b010e/README.md).
The receipt distinguishes the original absent-feature result, an original
browser-selector assumption, the corrected receiving results, and execution
or evidence-packaging failures.
