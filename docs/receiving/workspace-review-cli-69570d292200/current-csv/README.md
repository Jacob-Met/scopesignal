# Current accepted CSV composition

This packet adds receiving on the accepted CSV parent `5bbb52087aa3c5b33d1694887ff3d1380b826e5e`, tree `7bf94d8851045d5619f21c2ef6881c1714149e5c`, merged through [PR 45](https://github.com/Jacob-Met/scopesignal/pull/45) while the CLI contribution was publishing.

The original CLI source and complete historical packet remain at `1b659e2a770db5f554c6af3638dd8df09e4bb7bf`. The command, tests, guide and package script are unchanged. The only maintained composition is the same 649-byte CLI README section inserted into the complete accepted README; removing that section recovers the accepted README byte for byte. The CSV page, author-page link, parser, controller, tests, receiver and all published evidence retain their exact accepted tree entries.

## Result

The complete current native suite passes **242/242**, zero failed or skipped, Node24.19.0, exit0/empty stderr. `suite.tap` and `suite.stderr` are the raw outputs. It used the same private-cache `../run-current-suite.py` launcher as the final original run.

The actual command consumed the accepted CSV owner's genuine saved input at `docs/receiving/checkpoint-csv-cf5799f6d38b/downloads/literal-draft.json` (Git blob `fd57d5ad7be3113c9db60cdeb7754e98ed53a06c`). Its exact 696 bytes are copied here as `source-workspace.json`; all labels, whitespace, literal markup, tab, formula-like title and raw amounts are retained. The output `scope-review.html` is **5,078 bytes**, SHA256 `82bd1380baa91af8b131400dd2b21f19ee23d70bbacfbff7b31ae469ef914505`, and equals the unchanged native exporter byte for byte. It remains draft stage with two checkpoints, zero approvals and zero events.

`receive.mjs` checks all **57 unchanged current native inputs**, the copied upstream input identity, actual output bytes, command receipt hashes and native summary. `receiving.json` / `receiving.stderr` record its pass. Run it from the repository root with `node docs/receiving/workspace-review-cli-69570d292200/current-csv/receive.mjs`.

The original parent packet's 203-test result and source-pinned verifier remain historical at their original commit; they are not relabeled as current-source proof. This current packet preserves the new accepted source separately. Independent source/command receiving and ordinary hosted integration are still pending. No browser, provider, payment, deployment or installed acceptance is claimed.
