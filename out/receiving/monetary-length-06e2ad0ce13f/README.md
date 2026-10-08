# Preserve reviewed scope exportability

Issue #49, estate-06e2ad0ce13f / scope_continue.

On parent `5bbb52087aa3c5b33d1694887ff3d1380b826e5e`, overlong zero-padded cap/amount strings pass review and permit an approval, after which the scope is locked but the strict workspace encoder refuses their raw strings above its 64-character limit. The HTML and revision exporters use that encoder too. An initial Node24 in-memory control observed a 71-character cap and a 70-character amount separately reaching one approval and then failing export. Source bytes came from that exact parent; only relative import locations were rebound for that initial control.

The retained file-native before/control pair uses exactly 65-character strings. On the unchanged source, the two refusal expectations fail; the normal/64-character export lifecycle and unfinished-draft controls pass. Two per-field validation guards prevent a new unexportable locked scope. The existing form retains the complete raw monetary string and displays the validator's field-specific refusal. Raw caller inputs remain unchanged and each error identifies the actual field.

## Executed receiving

`baseline.log` is the original native four-group run (2 fail / 2 pass). `candidate.log` combines those unchanged four groups with all 14 original scope-plan tests (18 pass). Both use Node24.19.0 and ordinary file-module imports in an isolated dependency projection. `receipt.json` records exact source blobs, SHA256 digests, runtime and commands. The focused tests check both overlong fields, normal and exact-64 strings, maximum safe integer cents, all three exports after approval, exact JSON reopening, zero-approval revision and preserved unfinished input. They do not create a provider transaction.

Shared filesystem capacity prevented a complete fresh checkout. A small isolated projection was materialized in available shared-memory space and executed without altered imports. The projection's package metadata only enables module loading and is not part of this contribution. The initial missing-module failure and a corrected trailing blank line were setup failures; the retained baseline uses the original exact application blobs. Independent root receiving and the repository's ordinary supported hosted gate remain required for integration. No browser, deployment or live-payment claim follows from these native tests.

## Ownership and preservation

The maintained change is two validation lines, one README sentence and four native regression groups. The input controller and HTML retain their complete original bytes. The strict codec, accepted ledger, exporters, package, dependencies, workflows and other product source remain byte-identical to the parent. Existing active allocation, saved-checkpoint import, library and command-review owners keep their lanes. The publication tree inherits the entire actual parent rather than reconstructing it from this limited receiving projection.

## Independent source correction before acceptance

Root review identified that the first candidate's HTML/input `maxlength` additions could clip a pasted monetary string before validation and change its numerical value. Both additions were removed; the existing form keeps the entire raw string and the validator identifies an overlong field before review. Rejected candidate `ccfff500bcbe9f492adc98f28a1dc6921475dd30` remains in the PR history. The accepted plan, executed dependency closure and native tests did not change, so their existing18/18 result was not repeated. Root receiving owns the independent browser observation; this author packet does not claim a browser test of clipping.
