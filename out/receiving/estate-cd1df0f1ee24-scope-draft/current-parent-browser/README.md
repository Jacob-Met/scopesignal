# Current-parent browser receiving

Receiver: `estate-cd1df0f1ee24 / estate_coordination`. This bounded positive follows the earlier frozen-v1 interruption/refusal suite; it does not repeat that suite or claim deployment of the new feature.

## Qualified composition

The current parent is `8e50105fdc1645720e64ca83738727473c9f6acf`, tree `fe302d490b55f9eb4f5cbd7f4d7e9fca7e134820`. It merges PR15 and preserves its original app behavior. Relative to the earlier `317c1aad...` parent, its only non-archive changes are `app.mjs` and new `tests/evidence-drafts.test.mjs`. The app Git blob is `7398ab71912a6e5e55a1da8ccef3f8fdee82c135`; the new test blob is `b9c621ad8e350e1dff6febd7085b3c4c18dfafae`.

[Composition manifest](composition-manifest.json) records all 45 canonical source/configuration/test files and the unchanged seven feature pins. This new receiving copy excludes the retired `test/scope-draft-file.test.mjs` before execution. The earlier frozen-v1 transport, including its documented unserved extra, remains intact. No source test count is derived from this browser run. The lead separately corrected staging and reports 110 canonical Node tests, preserving its earlier duplicated-test log.

All 45 files matched their SHA256 and Git blob before and after the native browser run. This package qualifies the current parent plus the unchanged feature payload, rather than calling that unpublished composition the parent commit itself.

## Passed bounded positive

[Final browser receipt](composition-final-evidence/receipt.json) and [driver/source preservation](composition-final-driver.json) record a successful native Chrome `154.0.8037.98` run using Node `26.3.0` and the existing Puppeteer installation. It completed at `2026-10-08T11:51:55.013Z`.

The browser first loaded the existing index and the exact current PR15 `app.mjs`. It then opened `scope.html`, authored fictional Unicode text with an unfinished cap and empty checkpoint title, downloaded the actual JSON file, reloaded, previewed that downloaded file without changing the current fixture, and deliberately replaced the draft. Every observed field returned exactly. After completing the two unfinished fields, Review began with zero events, zero approvals and $0.00 captured. No approval action was taken.

All **16 declared runtime assets** were observed, and every one of the **28 response bodies** matched its expected SHA256 and Git blob. There were no page exceptions or response-pin mismatches. The phone viewport remained 390 pixels wide without horizontal overflow. The receiver visually inspected [the actual reopened draft capture](composition-final-evidence/phone-reopened.png).

The [actual downloaded file](composition-final-evidence/scopesignal-scope-draft-v1.json) is 772 bytes, SHA256 `b24435101cf22d88977105aa360127069f540e8a5870d56244dd5a0d8a3b45dd`.

## Preserved initial receiver correction

The [initial bounded receipt](composition-evidence/receipt.json) reached the same functional and source-pin assertions but failed its final request classification. Loading the index with the browser cache disabled caused Chromium's body-free same-origin `/favicon.ico` request. The driver blocked that request but initially classified it as unexpected. Its raw failure, native download, capture and [executed original driver](receiving/check-scope-draft-positive.mjs) remain preserved.

Only the receiver classification was corrected: the exact inherited Google Fonts stylesheet and exact body-free same-origin browser favicon GET remain blocked and are recorded separately from unrecognized requests. Production source was unchanged. The [corrected executed driver](receiving/check-scope-draft-positive-corrected.mjs) then passed the same bounded positive. No full interruption suite was rerun.

The native evidence transfer archive is 359,771 bytes, SHA256 `0dd4b41ccec1dc8b2f6315d4b3dd0b3ec912c04d83098576f64ff1ca5af40684`, before this README, custody readback and artifact manifest were added. The source/driver transfer archive is 81,312 bytes, SHA256 `c427ecede6cb30e61a79ca836841435cf9ab03576db4e76d4d89ee585de3bc45`.

## Current Pages route and custody

[Read-only release/custody evidence](pages-custody-readback.json) records the existing `paypal-ai` Pages workflow. Parent `8e50105...` completed [push run37766220718](https://github.com/Jacob-Met/scopesignal/actions/runs/37766220718): test job113274433716 passed 96 tests, and deployment job113274484385 succeeded. That deployment used artifact11544572572, ZIP SHA256 `f0796f2e23ac16aa2a24135218bd04499431cec38c1a3a5b9d236e502506433d`. These are the already-deployed parent's results, not results for the new draft-file feature.

The original authoring receiver established `https://jacobmetoyer.com/scopesignal/scope.html` in [comment6057168179](https://github.com/Jacob-Met/scopesignal/pull/10#issuecomment-6057168179). The workflow currently reports the equivalent HTTP environment URL; the prepared public receiving driver requires HTTPS with ordinary browser certificate verification.

The overlapping `estate-401c5d17da79` cohort [explicitly yielded local draft-file UI/source integration](https://github.com/Jacob-Met/scopesignal/pull/10#issuecomment-6058750874) to this family's claim. Its narrower valid-plan candidate and receiving evidence retain their own source attribution and are not counted as qualification of this implementation. PR15's original contribution is retained unchanged.

## Prepared public check

The corrected driver supports the same positive against the public route after the lead supplies an actual merged/deployed identity. Set `SCOPESIGNAL_PUBLIC_URL=https://jacobmetoyer.com/scopesignal/` and `SCOPESIGNAL_EXPECTED_COMMIT` to that exact commit, along with the pinned `SCOPESIGNAL_MANIFEST`, existing Chrome/Puppeteer paths, a source path and a new evidence directory. Public mode launches no local server and uses normal TLS. Every declared runtime response must match the pinned source before authoring interactions; mismatches or certificate failures are receiving failures, not permission to weaken validation.

No public feature check, workflow dispatch, configuration change, deployment mutation, signed-in session, provider call or live payment operation was performed while preparing this packet. The initial and final loopback runs used isolated profiles that were removed after completion.
