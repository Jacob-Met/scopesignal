# PR15 current-composition receiving

This is the final pre-merge receiving gate for the original draft-preservation and webhook-label contributions, including the subsequently merged Workers AI contract (#12) and capture lifecycle/receipt identity (#8) changes.

The tested synthetic merge is `0cb9c7e168088bb85e1475755d95e751733479c7`, tree `51054c097657232c4a895dab9fc9614b5cd517e8`, with parents `844f32d1a6d9798bc658fd77af79877bd41e5f86` and PR15 head `dab4bb98e5c00e71523004738701aa5c382318a9`.

All **36 non-evidence source files** were checked against their exact Git blob hashes from that synthetic merge before execution. This was a sparse source mirror; the other authors' historical evidence remains intact in the remote tree. See `source-freeze.json`.

## Results

- Node 24.19.0: **85 tests passed, zero failures or skips**. The complete output is `node-tests.log`.
- Chromium 153.0.8010.0: **50 checks passed**, zero failures or page exceptions:15 draft/capture checks,15 actual-download checks,20 timeline checks. Each harness ran sequentially in fresh desktop and phone-sized contexts against an ephemeral loopback server.
- Six actual JSON downloads preserve the exact approved event evidence and exclude unapproved drafts. Both final downloaded fixture records are retained.
- All three receipts record the same ten browser-loaded source SHA-256 values, including the current ledger `504960dce6d278baef15e90f7cd7c7c57a543d1dcc881aef4225f320fb39ca3c` and corrected app `a33c3519e59445e4ed6c19a2beec81005482e34b5e6bd396f10916cfbfd96a24`.
- The existing Google Fonts stylesheet was blocked and recorded; no unexpected external request was allowed. Viewport checks are not physical-phone acceptance.
- Hosted pull-request test run [37762634147](https://github.com/Jacob-Met/scopesignal/actions/runs/37762634147) completed successfully on the original receiving head against default844f.

These receipts are appended to the PR without changing executable source. The updated head must retain the same non-evidence source composition and pass its hosted check before merge. Public Pages delivery and served-byte acceptance are recorded separately after the merge.

The `draft-incorporation`, `draft-export-composition`, and `current-draft-integration` directories preserve earlier source qualification and branch drift. This directory is the receipt for the final changed-ledger composition; it does not retroactively change those older source pins or results.
