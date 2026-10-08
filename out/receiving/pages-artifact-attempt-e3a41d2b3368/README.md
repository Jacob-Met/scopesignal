# Pages artifact identity across deployment attempts

The deployment for comparison merge `549f6d551d1ad92ee97198b1799c7bcb40aa5e01` failed after a successful upload because the Pages action initially listed zero artifacts. That artifact later became visible. One authorized retry of the failed deployment job uploaded a second artifact with the same default name, and the action then refused the two matches.

This changes only `.github/workflows/pages.yml`: upload and deployment both use `github-pages-${{ github.run_id }}-${{ github.run_attempt }}`. A retry keeps prior artifacts while selecting only the artifact uploaded by its own attempt. Workflow permissions, action versions, concurrency, source path, job dependency and application bytes are unchanged.

## Concrete failure evidence

Run [37802625312](https://github.com/Jacob-Met/scopesignal/actions/runs/37802625312) targeted the exact comparison merge. Initial deploy job `113398601782` finalized artifact `11560528748`, then reported zero matches. Retried deploy job `113403137995` finalized artifact `11562156085`, then reported two matches. `observed-attempts.json` preserves both artifact digests and both job listings; the successful test job retains its original start and completion times. The two artifacts were neither deleted nor overwritten.

A later push, checkpoint-copy merge `c99a291600fff8f56fb2acc3194feeb9a4822d07`, succeeded in Pages run [37805160191](https://github.com/Jacob-Met/scopesignal/actions/runs/37805160191) using the unchanged workflow. That fresh-run control is recorded separately. The retry ambiguity remains directly reproduced.

## Qualification

The workflow was parsed with PyYAML 6.0.3. Its only semantic changes are the supported `name` upload input and matching `artifact_name` deployment input. The action contracts were fetched at the commits actually resolved by the failed jobs:

- `actions/upload-pages-artifact`: `56afc609e74202658d3ffba0e8f6dda462b719fa`
- `actions/deploy-pages`: `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`
- Nested `actions/upload-artifact`: `ea165f8d65b6e75b540449e92b4886f43607fa02`

Six contract groups passed on Node 24.19.0 using the complete unchanged pinned `src/internal/api-client.js`, with external dependencies replaced by read-only metadata stubs. They reproduce the observed zero- and duplicate-match failures, preserve the one-artifact control, select the correct attempt and run while old artifacts remain, and preserve refusal of missing or duplicate candidate names. Synthetic candidate artifacts are identified explicitly. This test performs no upload, deletion or deployment.

The packet includes both exact workflow versions, the diff, self-contained receivers, results, action sources and MIT licenses, failure excerpts, source pins and raw-log digests. `verify-action-contract.mjs` can be run with Node 24; `verify-workflow.py` requires PyYAML. The source candidate still requires its normal hosted CI and deployment gate. It does not claim to eliminate every future transient empty listing.

All checkpoint-copy and comparison application files are outside this production delta. The expected parent is `c99a291600fff8f56fb2acc3194feeb9a4822d07`; source publication must recheck that boundary.
