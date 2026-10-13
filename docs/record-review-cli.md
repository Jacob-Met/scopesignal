# Review a saved fixture record from the command line

With Node.js 24 or newer, run from the repository directory:

```sh
node scripts/review-record.mjs ./scopesignal-fixture-record-v1.json ./record-review.html
```

Choose a **new** output path. Open the resulting HTML locally to read the review
or use your browser's Print command. The document uses the same unchanged
renderer as **Download record review** in the saved-record viewer. It contains
the complete admitted fixed-fixture record, including partial outcomes and every
duplicate receipt. No browser or dependency installation is needed to create it.

This command accepts the fixed version-1 `scopesignal.fixture-record` JSON.
Authored `scopesignal.scope-workspace` files use a different format. Keep the
original JSON to reopen the interactive viewer; HTML is an offline review, not
an editable backup or evidence of real identity, approval or payment.

## Paths, input and output

Supply exactly two nonempty positional paths, or use `--help` alone. Relative
paths resolve from the current working directory; quote paths containing spaces.
A path beginning with `-` must use a prefix such as `./`. There is no stdin,
file discovery, batch mode or overwrite option.

The command acquires one regular file read-only and reads at most 1 MiB plus an
overflow sentinel. The **raw input bytes**, including any BOM, must fit the
1,048,576-byte limit. Fatal UTF-8 decoding consumes one leading BOM, matching
the browser viewer. The existing reader checks the complete record and its
512-event limit; the existing renderer owns HTML text admission and escaping.
Its refusal of NUL and unpaired UTF-16 surrogate text remains unchanged.
The review's literal opened-file label is the input basename.

The complete HTML is prepared before an output is created. A private temporary
directory is created beside the destination; complete UTF-8 bytes are written
there and published with an exclusive hard link. Existing files, directories,
symlinks and input aliases are refused. Missing parent directories are not
created. Filesystems that do not support hard links refuse without an overwrite
fallback. Only this command's private stage is removed.

A successful run leaves the source file unchanged and the stage removed. It
does not lock the source against other writers or promise power-loss durability
or a transaction across multiple files. If cleanup or receipt delivery fails
**after** publication, the complete output remains; stderr explicitly says it
was created. Inspect or keep it before retrying with another new output path.
Do not infer that a failing exit removed an already published review.

## Completion receipt

Success exits `0` and writes one JSON object plus a newline to stdout:

- `format`: `scopesignal.record-review-cli.v1`
- `input`, `output`: absolute resolved paths
- `inputBytes`, `outputBytes`: exact acquired input and created HTML byte counts
- `inputSha256`, `outputSha256`: lowercase SHA-256 identities of those bytes
- `eventCount`: admitted event count, including duplicate receipts
- `fixtureOnly: true`, `paymentEvidence: false`

These hashes identify local bytes; they do not authenticate a record.
`--help` exits `0` with usage text. Ordinary argument, admission, filesystem
and delivery failures exit `2` with a concise quoted diagnostic on stderr.
No successful receipt is emitted on refusal. A broken stdout stream can retain
a partial receipt, so consumers must also check the exit status.

The HTML retains the existing synthetic-data notices, raw integer-cent labels,
logical sequence markers, literal accepted evidence and unknown outcomes.
Creating it calls no account, network or payment service.

## Maintained checks

```sh
node --test tests/record-reader.test.mjs tests/record-review-export.test.mjs tests/record-review-cli.test.mjs
```

The CLI tests use actual child processes and temporary files for exact renderer
parity, recovery prefixes, BOM/Unicode, byte/event boundaries, late invalid
facts, occupied outputs, nonregular input and competing publishers. Explicit
test-only preload seams exercise post-stat growth and stage/cleanup/stdout
faults. These seams are not production options. Native receiving records the
actual operating system and Node version separately; this command adds no
browser-printing or Windows qualification.
