# Create a scope review at the command line

Use Node 24 or newer in the ScopeSignal source directory. No package installation is needed.

```sh
npm run --silent review:workspace -- "./saved workspace.json" "./new review.html"
```

The equivalent direct command is:

```sh
node scripts/review-workspace.mjs "./saved workspace.json" "./new review.html"
```

Choose a saved version-1 workspace JSON from ScopeSignal and a **new** output filename in an existing directory. Open the resulting HTML directly in a browser or use that browser's Print command. The document is the same standalone review produced by **Download scope review**: it contains no scripts, external resources, or payment controls.

Unfinished drafts retain their raw fields without invented totals. Reviewed workspaces retain the unchanged native terms, recorded accepted evidence, separate pending notes, exact event history, and current fictional capture outcomes. A pending or unknown capture remains uncounted. Keep the original JSON to reopen editable work; the HTML is a read-only fictional snapshot.

## Input and output behavior

The input must be a regular file of at most 1 MiB. Directory, symlink, device, and FIFO inputs are refused. UTF-8 decoding is fatal on malformed bytes; a leading UTF-8 BOM is accepted. The existing strict workspace decoder checks the saved format and replays its history. The existing HTML exporter still refuses NUL and unpaired UTF-16 surrogates because HTML cannot preserve them, even when the JSON workspace itself can retain them.

The command prepares the entire HTML before publishing. It writes a private temporary file beside the output and creates the destination exclusively using a filesystem hard link. An existing file, directory, or symlink at the destination is refused, including the input itself or an alias of it. Existing files are never overwritten. Missing parent directories are not created. A filesystem without hard-link support reports an error; choose a supported local filesystem. The temporary file is private to the current user where POSIX permissions apply.

Owned temporary files are removed after success or ordinary failure. If a filesystem error prevents cleanup after publication, the command reports failure and retains the completed output; it never removes a published destination. The command does not lock a concurrently edited source, snapshot an entire directory, or promise power-loss durability. Input hashes identify the exact bytes consumed.

Use `--` before two paths whose names begin with `-`:

```sh
node scripts/review-workspace.mjs -- "-saved.json" "-review.html"
```

`--help` prints usage and exits 0. Bad arguments exit 64. Input, decoding, export, or filesystem failures exit 1, print an explanation to stderr, and emit no success receipt.

## Receipt and verification

The direct command, or the `npm run --silent` form above, prints one JSON receipt after successful publication. Ordinary `npm run` also prints npm's command preamble. The receipt includes absolute input/output paths, byte lengths, SHA256 digests, and native stage/checkpoint/approval/event counts. It labels the artifact fictional and not payment evidence; hashes establish byte identity, not authenticity or signatures.

The same saved input yields the same HTML bytes at different fresh output paths. The input digest includes a BOM or JSON whitespace if present; the HTML is produced from the decoded workspace.

Run `node --test tests/review-workspace-cli.test.mjs` for actual process and filesystem receiving, or `npm test` for the current repository suite. Native receiving covers exact existing-export identity, reviewed and unfinished inputs, UTF-8 and size bounds, refusals, source/output custody, explicit paths, concurrent publication, and the package command. The CLI adds no browser interaction; the existing exporter owns the HTML rendering contract.
