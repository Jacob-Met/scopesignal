import { FIXTURE, replayFixture } from './src/ledger.mjs';
import { roles } from './src/agents.mjs';
import { capturePresentation } from './src/payment-status.mjs';

const ledger = replayFixture();
const $ = (sel, root = document) => root.querySelector(sel);
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: FIXTURE.currency }).format(cents / 100);

function render() {
  const state = ledger.snapshot();
  $('#total').textContent = money(state.total);
  $('#approved').textContent = `${state.approved} / ${FIXTURE.checkpoints.length}`;
  $('#captured').textContent = money(state.captured);
  $('#remaining').textContent = money(state.remaining);
  $('#checkpoint-list').innerHTML = FIXTURE.checkpoints.map(cp => {
    const s = state.checkpoints[cp.id];
    return `<article class="checkpoint ${s.approved ? 'accepted' : ''}"><div class="cp-top"><span class="cp-index">${String(FIXTURE.checkpoints.indexOf(cp) + 1).padStart(2, '0')}</span><span class="cp-state">${s.approved ? '✓ Approved' : 'Needs review'}</span><strong>${escapeHtml(cp.title)}</strong><b>${money(cp.amount)}</b></div><label for="evidence-${cp.id}">Acceptance evidence</label><textarea id="evidence-${cp.id}" rows="2">${escapeHtml(cp.evidence)}</textarea><div class="cp-actions"><button type="button" class="text-button suggest" data-id="${cp.id}">Preview evidence suggestion</button><button type="button" class="approve" data-id="${cp.id}" ${s.approved ? 'disabled' : ''}>${s.approved ? 'Approved by human' : 'Approve checkpoint'}</button></div></article>`;
  }).join('');
  const first = FIXTURE.checkpoints[0];
  const capture = capturePresentation(state.checkpoints[first.id]);
  $('#capture-title').textContent = capture.title;
  $('#capture-guidance').textContent = capture.guidance;
  $('#role-cards').innerHTML = [roles.briefInterpreter(), roles.evidenceMapper(first), roles.paymentPolicy(first), roles.recoveryReview(ledger.events)].map(role => `<article class="role-card"><span>${escapeHtml(role.role)}</span><small>${escapeHtml(role.mode)}</small><p>${escapeHtml(role.summary || role.suggestedEvidence || role.rule || role.guidance)}</p></article>`).join('');
  $('#ledger-body').innerHTML = ledger.events.map(e => `<tr><td>${String(e.seq).padStart(2, '0')}</td><td><code>${escapeHtml(e.type)}</code></td><td>${escapeHtml(e.checkpointId || '')}${e.eventId ? ` · ${escapeHtml(e.eventId)}` : ''}</td><td>${escapeHtml(eventResult(e))}</td></tr>`).join('');
  $('#ledger-count').textContent = `${ledger.events.length} events`;
}
function eventResult(e) { return e.type === 'paypal.capture.response_lost' ? 'unknown · do not retry' : e.type === 'paypal.webhook.received' ? (e.duplicate ? 'duplicate ignored' : 'captured once') : e.type === 'paypal.capture.reconciled' ? 'reconciled · counted once' : e.type === 'checkpoint.approved' ? 'human approval' : e.environment === 'sandbox' ? 'Sandbox fixture order' : 'recorded'; }
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

$('#checkpoint-list').addEventListener('click', e => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (e.target.classList.contains('approve')) {
    try { ledger.approve(id, document.getElementById(`evidence-${id}`).value); } catch (err) { alert(err.message); }
    render();
  } else if (e.target.classList.contains('suggest')) {
    const cp = FIXTURE.checkpoints.find(x => x.id === id);
    document.getElementById(`evidence-${id}`).value = roles.evidenceMapper(cp).suggestedEvidence;
  }
});
$('#add-checkpoint').addEventListener('click', () => alert('This fixture keeps the event model deterministic. In a real project, add and version checkpoints before approval.'));
$('#replay').addEventListener('click', () => { window.location.reload(); });
render();
