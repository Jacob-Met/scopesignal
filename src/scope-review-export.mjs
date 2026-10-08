import { encodeScopeWorkspace, decodeScopeWorkspace } from './scope-workspace-record.mjs';
import { formatUSD } from './scope-plan.mjs';
import { capturePresentation } from './payment-status.mjs';

export const SCOPE_REVIEW_FILENAME = 'scopesignal-scope-review.html';

// User-authored values only appear in text nodes. Character references retain
// carriage returns rather than allowing the HTML parser to normalize them.
function escape(value) {
  const text = String(value);
  // HTML cannot retain NUL or unpaired UTF-16 surrogates as text. Refuse the
  // export instead of silently changing a draft that JSON can still preserve.
  if (text.includes('\0') || !text.isWellFormed()) {
    throw new Error('Some text cannot be preserved in HTML. Keep the workspace JSON and correct that text before exporting a review.');
  }
  return text.replace(/[&<>"'\r]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;'
  })[character]);
}

const field = (label, value) => `<div class="field"><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;

function draftCards(draft) {
  return draft.checkpoints.map((checkpoint, index) => `<article class="checkpoint">
<p class="eyebrow">Checkpoint ${index + 1} · unfinished draft</p>
<dl>${field('Deliverable (as entered)', checkpoint.title)}${field('Amount in USD (as entered, not validated)', checkpoint.amount)}${field('Planned acceptance evidence', checkpoint.evidence)}</dl>
</article>`).join('\n');
}

function reviewCards(state, evidenceDrafts) {
  return state.checkpoints.map((checkpoint, index) => {
    const capture = capturePresentation(checkpoint);
    return `<article class="checkpoint">
<p class="eyebrow">Checkpoint ${index + 1} · ${checkpoint.approved ? 'approval recorded in fixture' : 'not approved'}</p>
<h3>${escape(checkpoint.title)}</h3>
<dl>${field('Checkpoint identity', checkpoint.id)}${field('Milestone amount (USD)', formatUSD(checkpoint.amount))}${field('Planned acceptance evidence', checkpoint.evidence)}${
      checkpoint.approved
        ? field('Accepted evidence — from recorded approval', checkpoint.acceptedEvidence)
        : field('Pending evidence — not approved', evidenceDrafts.get(checkpoint.id) ?? checkpoint.evidence)
    }${field('Current simulated capture state', capture.state === 'not_started' ? 'not started' : capture.state)}${field('Current fixture guidance', capture.guidance)}${checkpoint.orderId ? field('Fixture order identity', checkpoint.orderId) : ''}</dl>
</article>`;
  }).join('\n');
}

function eventHistory(events) {
  if (!events.length) return '<p>No fixture events have been recorded.</p>';
  return `<ol class="events">${events.map(event => `<li><h3>Event ${event.seq} · ${escape(event.type)}</h3><dl>${
    Object.entries(event).map(([key, value]) => field(key, value)).join('')
  }</dl></li>`).join('\n')}</ol>`;
}

export function createScopeReviewDocument(workspace) {
  // Reuse the existing bounded format and private native replay. In particular,
  // never trust a caller-supplied total or infer acceptance from editor text.
  const admitted = decodeScopeWorkspace(encodeScopeWorkspace(workspace));
  const { draft, review, evidenceDrafts } = admitted;
  const state = review?.snapshot();
  const title = state?.plan.label ?? draft.label;
  const stage = state ? 'Reviewed fictional scope' : 'Unfinished fictional draft';
  const summary = state
    ? `<dl class="totals">${field('Project cap (USD)', formatUSD(state.plan.amount))}${field('Allocated to checkpoints (USD)', formatUSD(state.total))}${field('Unallocated cap (USD)', formatUSD(state.unallocated))}${field('Simulated captured (USD)', formatUSD(state.captured))}${field('Allocated remaining (USD)', formatUSD(state.remaining))}${field('Recorded approvals', `${state.approved} of ${state.checkpoints.length}`)}</dl>
<p>Allocated remaining is the allocated milestone total less simulated captures. Unallocated cap is separate. Pending and unknown outcomes count nothing.</p>`
    : `<dl>${field('Project cap in USD (as entered, not validated)', draft.cap)}</dl>
<p>This draft has not entered review. Its fields may be empty or need correction. No amounts are totaled, and no approvals or capture outcomes are implied.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Scope review — ScopeSignal</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f1e8;color:#203b3d;font:16px/1.6 system-ui,sans-serif}main{max-width:980px;margin:auto;padding:40px 28px}h1{font-size:clamp(1.8rem,5vw,3rem);line-height:1.15}h1,h2,h3,p,dd{overflow-wrap:anywhere}h2{margin-top:2.4rem}h3{line-height:1.35}.eyebrow,dt{font-size:.8rem;font-weight:700;letter-spacing:.04em}.notice{border:2px solid #203b3d;padding:18px;background:#fff}.checkpoint,.events li{background:#fff;border:1px solid #bbc8c5;border-radius:8px;padding:20px;margin:18px 0}.field{margin:0 0 16px}dt{color:#496360}dd{margin:3px 0 0;white-space:pre-wrap;min-height:1.6em}.totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 24px}.totals dd{font-size:1.25rem;font-weight:650}.events{padding-left:26px}.events .field{display:grid;grid-template-columns:minmax(100px,1fr) 3fr;gap:16px}.events dd{margin:0}footer{border-top:1px solid #bbc8c5;margin-top:32px;padding-top:20px;font-size:.9rem}@media(max-width:480px){main{padding:22px 16px}.checkpoint,.events li{padding:16px}.events .field{display:block}.events{padding-left:20px}}@media print{body{background:white;color:#111;font-size:11pt}main{padding:0;max-width:none}h1{font-size:24pt}h2,h3,dt{break-after:avoid}.checkpoint{break-inside:avoid}.notice,.checkpoint,.events li{border-color:#777;border-radius:0}.events li{break-inside:avoid;page-break-inside:avoid;display:block;padding:10px;margin:8px 0}.events h3{margin:0 0 8px;font-size:11pt;break-after:auto}.events dt{break-after:auto}.events .field{display:grid;grid-template-columns:110px 1fr;gap:8px;margin:0 0 3px}.events dt{overflow-wrap:anywhere;min-width:0}.events dd{min-height:0;min-width:0}dd{overflow-wrap:anywhere}.totals{grid-template-columns:repeat(3,1fr)}@page{margin:16mm}}
</style></head><body><main>
<header><p class="eyebrow">SCOPESIGNAL · PORTABLE REVIEW</p><h1>${escape(title || 'Untitled draft')}</h1><p>${stage}</p></header>
<aside class="notice"><strong>Fictional snapshot · no live payments</strong><p>This unsigned document records an authored ScopeSignal fixture. It does not establish a person's identity, real human approval, a payment, or a payment receipt. All recorded approvals, orders and captures are simulated. It has no payment controls or external resources.</p><p>Open this file in a browser to read it offline. Use the browser's Print command to print or save a PDF. To continue editing or restore the workspace, keep the separate workspace JSON download.</p></aside>
<section aria-labelledby="brief-title"><h2 id="brief-title">Creative brief</h2><dl>${field('Project name', title)}${field('Brief', state?.plan.brief ?? draft.brief)}</dl></section>
<section aria-labelledby="summary-title"><h2 id="summary-title">${state ? 'Current fixture summary' : 'Draft amounts'}</h2>${summary}</section>
<section aria-labelledby="checkpoints-title"><h2 id="checkpoints-title">Acceptance checkpoints</h2>${state ? reviewCards(state, evidenceDrafts) : draftCards(draft)}</section>
<section aria-labelledby="events-title"><h2 id="events-title">Recorded fixture history</h2><p>${state?.events.length ?? 0} events. Sequence and time fields are fixture markers, not verified transaction timestamps. The current outcome above is derived from the complete recorded history. Raw event amounts are integer cents in the recorded currency: for example, amount 50025 with currency USD means $500.25. Checkpoint and summary amounts above are formatted in dollars.</p>${eventHistory(state?.events ?? [])}</section>
<footer>ScopeSignal · read-only fictional review · no browser storage, provider request or real payment</footer>
</main></body></html>\n`;
}
