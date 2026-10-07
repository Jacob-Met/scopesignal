# ScopeSignal

**Creative brief → editable acceptance checkpoints → human-approved milestone payment.** ScopeSignal makes payment scope explicit and recoverable when payment systems behave badly.

This first public slice is a static, fixture-only experience. It demonstrates approval gating, a PayPal Sandbox-shaped order/capture lifecycle, an unknown capture after a lost response, duplicate webhook idempotency, and reconciliation without double counting. The visible fixture is deterministic and contains no real payment evidence, customers, or credentials. No PayPal API is called and no live-money action exists.

## Run locally

Requires Node.js 24 or newer; no dependencies or paid services are needed.

```sh
npm test
npm run serve
```

Open `http://127.0.0.1:4173`. The fixture has three $400.00 milestones, a $1,200.00 project cap, and a deterministic seven-event path. The first checkpoint is human-approved, creates a Sandbox-labeled fixture order, loses the capture response, receives the same webhook twice, and reconciles once. Captured value remains $400.00, never $800.00.

## Payment safety model

- A milestone cannot create an order until a human explicitly approves it.
- Capture requires an approved milestone's order.
- A lost capture response transitions to `unknown`; capture cannot be retried while uncertain.
- Duplicate webhook `eventId` is recorded for audit but ignored for counting.
- Reconciliation is allowed only for an unknown capture and is applied once.
- The in-memory append-only ledger is deterministic; sequence numbers and logical times are fixture values, not a durable ledger or PayPal records.
- This demo does not authenticate, authorize, or execute payments.

## Separated roles

`src/agents.mjs` has separate brief interpretation, evidence mapping, payment policy, and recovery review functions. They are labeled **local rule preview**, not AI output. They are advisory only; they cannot approve checkpoints or move funds. Evidence remains human-editable.

## AI connector status

`src/workers-ai.mjs` is a fail-closed Cloudflare Workers AI adapter scaffold with strict output checks. It has no configured binding, model result, key, or paid provider fallback. To exercise it requires an eligible Cloudflare account with Workers AI enabled and a Worker deployment configured with the `AI` binding (and a real schema-capable response path). Until those prerequisites exist, the UI correctly reports **disconnected**. The app makes no external AI request.

Do not add secrets to this repository. Any later PayPal connector must be Sandbox-only, server-side, host-only configuration; credentials must never enter browser code, source control, logs, or fixture output. Never use customer data. No live-money API is permitted in this slice.

## CI and hosting

- GitHub Actions runs tests on Node 24 and deploys the static fixture to GitHub Pages on `paypal-ai` pushes. Pages is public and free when repository/account settings permit it; deployment can require repository Pages settings to select GitHub Actions.
- GitLab CI runs the fixture tests as an evidence job when mirrored to GitLab.

## Scope and readiness

The public slice is not represented as satisfying a contest AI requirement and is not submittable as an AI/Sandbox-integrated product until an approved AI integration and PayPal Sandbox integration are actually configured and exercised. See `out/result.md` for verified implementation/deployment status.

MIT licensed.
