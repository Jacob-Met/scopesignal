# Independent receiving for ScopeSignal PR 47

**Disposition: approve** exact source `e2fd217148c60165d261262c03c473e444127269`, tree `f386e8b18347058bcd019ab244feec11c3269e4c`, composed with accepted parent `5bbb52087aa3c5b33d1694887ff3d1380b826e5e`. No blocking source or command finding remains.

The reviewer directly executed the published CLI using Node v24.19.0 in its own private local process. It verified ten immutable Git blobs covering the complete seven-file runtime closure and three accepted fixtures, then confirmed those bytes remained unchanged. An independent complete-tree comparison found all 728 unrelated accepted-parent leaves unchanged within the five maintained-file fence.

## Observed outcomes

All 12 focused cases passed (13 child command invocations). Reviewed, unfinished, and accepted CSV workspaces produced byte-identical output from the unchanged native exporter with exact input/output hashes. The public npm command, literal Unicode/BOM paths, unknown capture, and explicit reconciliation controls also passed. The accepted 696-byte CSV workspace produced the expected 5,078-byte HTML, SHA256 `82bd1380baa91af8b131400dd2b21f19ee23d70bbacfbff7b31ae469ef914505`.

A child-only file-size limit caused actual partial-write EFBIG. Reviewer-scoped native interception separately caused fsync EIO, exclusive-publication link EIO, and temporary-file unlink EIO after successful publication. All failures exited 1 and emitted no success receipt. Prepublication failures left no destination or owned temporary file. The postpublication cleanup failure explicitly reported that the review had been created and retained both the complete destination and its complete private temporary hard link. All unrelated sentinel bytes and input bytes remained unchanged.

Two simultaneous commands with different source documents competed for one destination. Exactly one succeeded; the other refused the existing destination. The final file was the complete winning document. An independent Python standard-library HTML parser checked all nine resulting HTML files: no executable/resource/control elements, exact existing CSP, and the accepted CSV markup payload remained literal text.

## Receiver correction retained

The first reviewer program successfully checked native byte parity, the reviewed receipt and input custody, then incorrectly expected webhook receipts to resolve an earlier unknown capture. Unchanged `src/ledger.mjs` lines 202–205 explicitly retain unknown outcomes until reconciliation. The corrected receiver requires $0.00/unknown after both webhook events and adds a separate seventh explicit reconciliation event requiring $231.19/captured exactly once. No application source changed. The original program, failure receipt, logs and HTML remain in this packet alongside the corrected program and rationale.

## Evidence

- `review.json`: source disposition, preservation counts, measured cases and limits.
- `receive-scope47.mjs`: original executed reviewer program.
- `receive-scope47-v2.mjs`: corrected executed reviewer program.
- `scope-fault-inject.c`: exact reviewer-only native fault shim.
- `inspect-html.py`: exact independent structural parser.
- `captured-files.json`: 49 verbatim captured files, each with original relative path, UTF-8 byte count and SHA256; includes all raw child stdout/stderr, compiler results, original failure, final receipts, generated HTML and derived inputs.

The programs expect the pinned source closure and fixtures materialized under `source/` and `inputs/` in a private `/dev/integration-scope47-*` directory. No dependency installation was required. Compiler output is reproducible from the retained C source; the temporary binary is not included. These results qualify command behavior and parsed HTML structure. They do not claim browser rendering, deployment, provider activity, real payments, or installed use.
