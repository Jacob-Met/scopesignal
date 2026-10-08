# Saved-scope comparison export: verification and receiving record

Worker: `chatgpt-0378a7b6b7c2/root`. Claim: https://github.com/Jacob-Met/scopesignal/issues/33.
Native source: `/home/jacob/scopesignal-comparison-export-0378a7b6` on hamon-thinkpad.
Genuine receiving parent: `847505d2fe9f8295110fc13a3fb9e05ec71f6644`, tree `cac1d2bbdd38e2e4c2aed7249c2593ec174c0eaa`.
An ordinary native fetch before source freeze still returned that parent.

## Delivered behavior

The existing Compare saved scopes page now offers **Download comparison review**. It prepares one standalone, printable HTML file from the two successfully displayed saved files and the current one-to-one pairing choices. The report retains both source labels, every compared project and checkpoint field, both complete event lists, explicit matches and every unpaired row. It retains all fields when the screen is showing changed fields only.

The exporter re-admits each retained original saved-file string through the unchanged codec and comparison model. It does not trust caller-supplied workspace snapshots, DOM totals or labels. Pending replacement reads continue to expose the currently displayed documents; a rejected read or export does not replace them. Literal markup and carriage returns survive as text. Strings that HTML/UTF-8 cannot preserve (NUL and unpaired UTF-16 surrogates) refuse with a retryable message.

Captured, unknown, pending, accepted and unpriced meanings remain those of the existing comparator. The report explains that value equality and chosen pairing do not prove historical identity; event sequence numbers do not establish chronology or authorship across files. Event money is labeled integer cents. The generated HTML contains no script, external resource or account/payment controls.

## Evidence

| Receiver | Result | Retained evidence |
| --- | --- | --- |
| Exact original runtime projection, Node 24.19.0 | 155/155 existing tests before edits | Original log remains in the root execution workspace; genuine native base is retained as its own worktree |
| Candidate runtime projection, Node 24.19.0 | 166/166 tests, 0 failures or skips | `local-node24-tests.log`, `local-node24-receipt.json` |
| Native candidate, Node 22.22.1 | 166/166 tests, 0 failures or skips | `native-node22-tests.log` |
| Native original page, Chromium 153.0.8010.47 | 3 baseline groups pass, including actual saved-file loading and absence of this export | `baseline/receipt.json` |
| Native candidate page and downloaded file, Chromium 153.0.8010.47 | All 8 receiving groups pass | `candidate-v2/receipt.json`, six actual downloaded HTML files and first-download hash |
| Independent worker source review and additional model challenge | No blocking findings; all 6 challenge assertions pass | `independent/REVIEW.md`, receipt, driver and generated HTML |

The browser receiver uses the project's real codec-created input files, a loopback source server, real file inputs and actual browser downloads. It reopens the downloaded file offline and checks manual pairing, unpaired rows, side swapping, a changed-only screen, a pending replacement file read, HTML refusal, simulated object-URL preparation failure and valid retry. It exercises keyboard activation, 390px layout and A4 printing. No storage writes, page exceptions or external resource requests were observed. The desktop comparison and phone report screenshots were also visually inspected.

The 11 new unit tests cover every lifecycle prefix, complete event histories, accepted/pending evidence, manual pairing and injectivity, repeated definitions, literal text, extreme safe-integer cents, different plan lengths, divergent evidence, malformed inputs and forged caller snapshots. Existing source tests are unchanged.

The independent reviewer traced codec admission, immutable comparison, complete serialization and UI lifecycle. Its separate native challenge used all 12 rows in reverse pairing, all 24 unpaired rows with no pairs, every checkpoint field, CR/markup/Unicode filenames, caller immutability and invalid pairs. This was source/model receiving; it does not claim a second browser execution.

## Preserved failures and corrections

The first candidate browser run received a browser download event but Playwright could not copy its default `/tmp/playwright-artifacts-…` file out of snap Chromium's temporary namespace. That failed receipt and the exact first receiver remain in `candidate-v1/`. Only the receiver changed: it now creates and supplies an explicit downloads directory beneath its evidence root. Product source hashes are identical in the failed and passing browser receipts.

The independent review's first receiver write failed because its new proof directory did not yet exist; the corresponding launch then could not find the script. Its receipt preserves that setup failure. The directory was created and the same challenge ran successfully.

The source packaging operation initially looked for the independent driver inside its result directory. The driver was actually a sibling of that directory. The source path was corrected after a directory read; product files and receiving outcomes were unchanged.

Initial GitHub content creation was held by a secondary rate limit. An ordinary same-connector retry later created issue 33. A subsequent native GitHub API primary-limit response in another worker delayed cohort publication. These API results do not constitute source integration or deployment.

## Scope and source preservation

Only the new exporter, its tests and browser receiver; the narrow existing comparison UI download hook and button/help; an additive README section; and this unique receiving directory belong to this contribution. Ledger, plan, codec, comparison semantics, authored history issue 29, authoring workspace, provider/payment/storage code, dependencies and workflows are preserved.

The Node 24 projection has exact candidate-file hash correspondence to the native source. Its local synthetic Git baseline was a diff convenience and is not an upstream parent. Publication must preserve the genuine native parent and compare the resulting Git tree with the native frozen tree.

The native screenshots, print PDF, original baseline worktree and full proof directories remain on hamon-thinkpad. `native-artifacts.json` records paths, byte sizes and SHA-256 values; the compact text receipts and actual downloaded reports are committed here. These are functional and source-preservation results, not measured user adoption or learning/business benefit.

## Integration boundary

At source freeze the change is implemented, tested and independently accepted. It is not yet merged or deployed. The existing `pages.yml` runs `npm test` under Node 24 after a push to `paypal-ai`, and only its dependent deployment job can publish Pages. It does not define a pull-request test trigger. The separate `test.yml` workflow provides the existing **Fixture tests** pull-request gate on Node 24; that gate must pass on the actual published PR before merging. Record the actual resulting merge, workflow result and deployed receiving separately; do not infer them from these native passes.
