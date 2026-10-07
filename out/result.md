# ScopeSignal — verified implementation/deployment status

Status record referenced by `README.md` ("See `out/result.md` for verified implementation/deployment status").
Verified 2026-10-07 ~09:05 PDT by outcome owner `owner-scopesignal-d` (side chat 4082c321).

## Repository

- `Jacob-Met/scopesignal`, public, MIT licensed. Default branch `paypal-ai` (no `main` branch exists).
- Head `45d99eaf90e4` ("ScopeSignal-first-public-slice", 2026-10-07T00:36:03Z, author Jacob-Met), single commit.
- Static, fixture-only demo. Zero dependencies (`package.json`: `scopesignal` 0.1.0, ESM, engines `node >= 24`).
- Files: `index.html` + `app.mjs` (UI), `src/ledger.mjs` (FIXTURE + deterministic event ledger), `src/agents.mjs` (local rule previews, explicitly labeled not AI output), `src/workers-ai.mjs` (fail-closed Cloudflare Workers AI adapter scaffold), `scripts/serve.mjs` (127.0.0.1 static server), `tests/ledger.test.mjs`, `.github/workflows/pages.yml`, `.gitlab-ci.yml`.

## Implementation — fixture facts (test-verified)

- 3 acceptance checkpoints × $400.00 (`journey`, `accessibility`, `handoff`); $1,200.00 project cap.
- Deterministic 7-event path: `checkpoint.approved` → `paypal.order.created` → `paypal.capture.requested` → `paypal.capture.response_lost` → `paypal.webhook.received` → `paypal.webhook.received` (duplicate, ignored) → `paypal.capture.reconciled`.
- Captured $400.00 counted once (never $800.00); $800.00 remaining; 1 / 3 approved.
- Gating enforced in code: approval required before order; order required before capture; no capture retry while `unknown`; reconcile allowed only for `unknown` capture and applied once; duplicate webhook `eventId` recorded but not counted.
- Workers AI adapter fails closed without an `AI` binding; schema validation rejects malformed model output.
- Tests: 8/8 pass (`node --test`), verified locally on Node v24.20.0 against live head content, and green in CI.

## CI

- `.github/workflows/pages.yml` ("Fixture-mode Pages deployment"): on push to `paypal-ai` and `workflow_dispatch`. Runs `npm test` on Node 24, then uploads the static site and deploys to GitHub Pages.
- Runs `37552843975` and `37552953506` both `completed`/`success` on head `45d99eaf90e4` (verified via API 2026-10-07).

## Deployment

- GitHub Pages: enabled, source branch `paypal-ai`, custom domain `jacobmetoyer.com/scopesignal/`.
- Live and rendering fixture values consistent with the README ($1,200.00 cap, 1 / 3 approved, $400.00 captured, $800.00 remaining, 7 events, Workers AI connector disconnected) — fetched 2026-10-07 ~09:00 PDT.
- GitLab CI: `.gitlab-ci.yml` (`fixture-evidence` job, `node:24-alpine`, JUnit artifact) present — runs when the repo is mirrored to GitLab; mirroring itself not verified in this pass.

## Deliberately not integrated (by design, per README)

- Real PayPal API: fixture-only slice; no live-money action exists or is permitted here.
- Workers AI: disconnected; requires an eligible Cloudflare account with the `AI` binding and a Worker deployment. No paid fallback. The UI correctly reports `NOT CONFIGURED`.

## Security posture

- Dependabot alerts enabled (public repo). Fixture contains no real credentials, customers, or payment evidence. `.gitignore` covers `node_modules/`, `test-results.xml`, `coverage/`, `.env`.
