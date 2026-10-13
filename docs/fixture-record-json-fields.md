# Repeated fields in saved fixture records

The fixed-fixture reader accepts one value for each decoded JSON member name
within an object. A file that repeats a field is refused with
`FixtureRecordError`, code `format`, before its saved facts are replayed.
Identical repeated values are refused too. A spelling such as `ver\u0073ion`
is the same decoded name as `version`.

This closes an ambiguity in the saved-file boundary: ordinary `JSON.parse`
keeps the last occurrence, which previously let earlier conflicting fields
disappear before the existing format and ledger checks. The new check runs
after native syntax validation. Incomplete JSON still receives code `syntax`;
the existing 1 MiB byte limit still runs first.

Each object has its own set of names. Normal repeated fields in different
events or checkpoints remain valid. Unicode, escaped strings, whitespace,
field-like evidence text, array order and native number parsing retain their
existing behavior. The scanner uses an explicit stack, so deeply nested JSON
with the wrong record format reaches a typed refusal without recursive scanning.

Callers should show the refusal and keep their last accepted record. The existing
file controller already prepares a complete accepted record before replacing its
view; that controller is unchanged. Preserve the refused file for diagnosis and
choose an original fixture-record export. No automatic correction or invented
field value is introduced.

## Scope and receiving

The only product edit is `src/record-reader.mjs`. The ledger, fixture exporter,
controller, authored workspace reader, server and packaging remain unchanged.
This is the synthetic `scopesignal.fixture-record` format. It adds no payment
verification or real-transaction evidence.

The independent original-first course passes 30/54 on the original and 54/54
on the candidate. It covers 22 ambiguous API inputs and two refused-file
controller-retention cases, with all 30 prior controls retained: eight genuine
recovery prefixes, literal and Unicode evidence, decoded escapes, exact size
bounds and a 12,000-level wrong-format JSON input. The four controller cases use
an authored DOM-shaped local harness. They do not qualify a browser or device.

The focused author course passes 5/5 on the candidate. Its corrected original
baseline passes 4/5, failing only the repeated-field expectation. The initial
author fixture wrongly expected the ledger to preserve trailing evidence
whitespace; its source and failed result remain in evidence. That fixture was
corrected by placing whitespace inside the evidence, before the product edit.

Run focused and maintained selected tests from the repository root:

```sh
node --test tests/fixture-record-duplicate-fields.test.mjs \
  tests/record-reader.test.mjs tests/fixture-record.test.mjs tests/ledger.test.mjs
```

This increment is source-branch-only. The default `paypal-ai` branch has Pages
enabled and a default-branch deployment workflow; pull requests also trigger
tests. No pull request, default-branch update, hosted CI, deployment, installed
replacement or browser qualification is part of this delivery.
