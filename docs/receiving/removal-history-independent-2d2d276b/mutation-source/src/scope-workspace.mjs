import { createDraftRemovalRecovery } from './scope-draft-removal.mjs';
import { mountScopeHistory } from './scope-history-view.mjs';
import { createScopeReviewDocument, SCOPE_REVIEW_FILENAME } from './scope-review-export.mjs';
import { createScopeRevisionDraft, SCOPE_REVISION_FILENAME } from './scope-revision-draft.mjs';
import { MAX_CHECKPOINTS, draftFromFixture, draftBudget, validateScopeDraft, createScopeReview, formatUSD as money } from './scope-plan.mjs';
import { capturePresentation } from './payment-status.mjs';
import { encodeScopeWorkspace, decodeScopeWorkspace, WORKSPACE_FILENAME, MAX_WORKSPACE_BYTES } from './scope-workspace-record.mjs';

const $ = selector => document.querySelector(selector);
const form = $('#scope-form');
let draft = draftFromFixture();
let review = null;
const evidenceDrafts = new Map();
const draftRemoval = createDraftRemovalRecovery();
const scopeHistory = mountScopeHistory($('#scope-history'));

function clearDraftRemoval() {
  draftRemoval.clear();
  $('#scope-undo-remove').disabled = true;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function draftField(index, key, caption, value, options = {}) {
  const label = element('label', caption, key === 'evidence' ? 'scope-wide' : undefined);
  const input = element(key === 'evidence' ? 'textarea' : 'input');
  input.id = `draft-${index}-${key}`;
  label.htmlFor = input.id;
  input.dataset.field = key;
  input.value = value;
  input.required = true;
  if (key === 'evidence') input.rows = 3;
  if (key === 'amount') { input.inputMode = 'decimal'; input.autocomplete = 'off'; }
  if (options.maxLength) input.maxLength = options.maxLength;
  label.append(input);
  return label;
}

function renderDraftRows() {
  // Independent negative control: omit history clear.
  const list = $('#scope-draft-list');
  list.replaceChildren();
  draft.checkpoints.forEach((cp, index) => {
    const row = element('fieldset', undefined, 'scope-row');
    row.dataset.index = index;
    row.append(element('legend', `Checkpoint ${index + 1}`));
    const fields = element('div', undefined, 'scope-fields');
    fields.append(
      draftField(index, 'title', 'Deliverable', cp.title, { maxLength: 160 }),
      draftField(index, 'amount', 'Milestone amount (USD)', cp.amount),
      draftField(index, 'evidence', 'Planned acceptance evidence', cp.evidence, { maxLength: 5000 })
    );
    const actions = element('div', undefined, 'scope-draft-actions');
    for (const direction of ['up', 'down']) {
      const move = element('button', `Move ${direction}`, 'text-button');
      move.type = 'button';
      move.dataset.move = direction;
      move.dataset.index = index;
      move.setAttribute('aria-label', `Move checkpoint ${index + 1} ${direction}`);
      move.disabled = direction === 'up' ? index === 0 : index === draft.checkpoints.length - 1;
      actions.append(move);
    }
    const duplicate = element('button', 'Duplicate checkpoint', 'text-button');
    duplicate.type = 'button';
    duplicate.dataset.duplicate = index;
    duplicate.setAttribute('aria-label', `Duplicate checkpoint ${index + 1}`);
    duplicate.disabled = draft.checkpoints.length >= MAX_CHECKPOINTS;
    actions.append(duplicate);
    const remove = element('button', 'Remove checkpoint', 'text-button scope-remove');
    remove.type = 'button';
    remove.dataset.remove = index;
    remove.setAttribute('aria-label', `Remove checkpoint ${index + 1}`);
    remove.disabled = draft.checkpoints.length === 1;
    actions.append(remove);
    row.append(fields, actions);
    list.append(row);
  });
  $('#scope-add').disabled = draft.checkpoints.length >= MAX_CHECKPOINTS;
  $('#scope-undo-remove').disabled = !draftRemoval.available;
  $('#scope-revision-download').disabled = !review || review.snapshot().approved === 0;
  $('#scope-order-status').textContent = '';
  updateBudget();
}

function readDraft() {
  return {
    label: $('#scope-label').value, brief: $('#scope-brief').value, cap: $('#scope-cap').value,
    checkpoints: [...document.querySelectorAll('.scope-row')].map(row => ({
      title: row.querySelector('[data-field="title"]').value,
      amount: row.querySelector('[data-field="amount"]').value,
      evidence: row.querySelector('[data-field="evidence"]').value
    }))
  };
}

function updateBudget() {
  const budget = draftBudget(readDraft());
  const over = budget.unallocated !== null && budget.unallocated < 0;
  $('#scope-budget').classList.toggle('over', over);
  $('#scope-budget').textContent = budget.allocated === null || budget.cap === null
    ? 'Enter valid USD amounts to see the allocation.'
    : `${money(budget.allocated)} allocated · ${money(Math.abs(budget.unallocated))} ${over ? 'over the project cap' : 'unallocated within the cap'}`;
}

function fieldForError(field) {
  if (field === 'checkpoints') return $('#scope-add');
  if (!field.startsWith('checkpoints.')) return $(`#scope-${field}`);
  const [, index, key] = field.split('.');
  return $(`#draft-${index}-${key}`);
}

function clearErrors() {
  $('#scope-errors').hidden = true;
  $('#scope-errors').replaceChildren();
  form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
}

function showErrors(errors) {
  clearErrors();
  const box = $('#scope-errors');
  box.append(element('p', 'Review these fields before continuing:'));
  const list = element('ul');
  for (const error of errors) {
    const row = element('li');
    const field = fieldForError(error.field);
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      const link = element('a', error.message);
      link.href = `#${field.id}`;
      link.addEventListener('click', () => field.focus());
      row.append(link);
    } else row.textContent = error.message;
    list.append(row);
  }
  box.append(list);
  box.hidden = false;
  box.focus();
}

const actionLabels = {
  approve: 'Approve this evidence', order: 'Simulate order creation',
  request: 'Simulate capture request', receipt: 'Simulate webhook receipt',
  lose: 'Simulate lost response', duplicate: 'Simulate duplicate webhook',
  reconcile: 'Simulate lookup: captured'
};

const actionMessages = {
  approve: 'Evidence approved by the fixture reviewer.', order: 'Sandbox-shaped fixture order recorded.',
  request: 'Fixture capture request recorded; its outcome is pending.',
  receipt: 'Fixture webhook recorded. Check the current outcome below.',
  lose: 'Lost response recorded. The outcome is unknown; do not repeat the capture.',
  duplicate: 'Duplicate webhook recorded without counting it again.',
  reconcile: 'Simulated lookup reconciled the capture once.'
};

function resultText(event) {
  switch (event.type) {
    case 'checkpoint.approved': return `Human-approved evidence: ${event.acceptedEvidence}`;
    case 'paypal.order.created': return event.orderId;
    case 'paypal.capture.requested': return 'Pending · await an outcome';
    case 'paypal.capture.response_lost': return 'Unknown · do not retry';
    case 'paypal.webhook.received': return event.duplicate ? 'Duplicate receipt · ignored for counting' : `Webhook received · ${event.captureId}`;
    case 'paypal.capture.reconciled': return `Reconciled once · ${event.captureId}`;
    default: return 'Recorded';
  }
}

function renderReview() {
  const state = review.snapshot();
  $('#review-title').textContent = state.plan.label;
  $('#review-brief').textContent = state.plan.brief;
  $('#scope-total').textContent = money(state.plan.amount);
  $('#scope-approved').textContent = `${state.approved} / ${state.checkpoints.length}`;
  $('#scope-captured').textContent = money(state.captured);
  $('#scope-remaining').textContent = money(state.remaining);
  $('#scope-unallocated').textContent = `${money(state.total)} allocated to checkpoints. ${money(state.unallocated)} of the project cap remains unallocated.`;
  $('#scope-edit').disabled = state.events.length > 0;
  $('#scope-revision-download').disabled = state.approved === 0;
  $('#scope-lock-note').textContent = state.events.length > 0
    ? 'This scope is locked because approval has begun. Accepted evidence remains attached to its recorded decision.'
    : 'You can edit this plan until the first checkpoint is approved.';
  $('#draft-step').removeAttribute('aria-current');
  $('#review-step').toggleAttribute('aria-current', state.approved === 0);
  $('#simulate-step').toggleAttribute('aria-current', state.approved > 0);
  const currentStep = state.approved === 0 ? $('#review-step') : $('#simulate-step');
  currentStep.setAttribute('aria-current', 'step');
  const list = $('#scope-review-list');
  list.replaceChildren();
  state.checkpoints.forEach((cp, index) => {
    const card = element('article', undefined, 'scope-review-card');
    card.dataset.checkpoint = cp.id;
    card.append(element('span', `CHECKPOINT ${index + 1} · ${cp.approved ? 'HUMAN APPROVED' : 'NEEDS REVIEW'}`, 'cp-state'));
    const heading = element('div', undefined, 'scope-review-heading');
    const title = element('h3', cp.title);
    title.id = `review-heading-${cp.id}`;
    title.tabIndex = -1;
    heading.append(title, element('strong', money(cp.amount)));
    card.setAttribute('aria-labelledby', title.id);
    card.append(heading);
    const label = element('label', cp.approved ? 'Accepted evidence' : 'Evidence for human review');
    const textarea = element('textarea', undefined, 'scope-evidence');
    textarea.id = `review-evidence-${cp.id}`;
    textarea.dataset.evidence = cp.id;
    label.htmlFor = textarea.id;
    textarea.rows = 3;
    textarea.maxLength = 5000;
    textarea.value = cp.approved ? cp.acceptedEvidence : evidenceDrafts.get(cp.id) ?? cp.evidence;
    textarea.readOnly = cp.approved;
    const actions = element('div', undefined, 'scope-review-actions');
    for (const action of cp.actions) {
      const button = element('button', actionLabels[action], `button ${action === 'approve' || action === 'reconcile' ? 'button-dark' : 'button-outline'}`);
      button.type = 'button';
      button.dataset.action = action;
      button.dataset.checkpoint = cp.id;
      actions.append(button);
    }
    const capture = capturePresentation(cp);
    const status = element('div', undefined, `scope-review-state${cp.captureStatus === 'unknown' ? ' uncertain' : ''}`);
    status.append(element('strong', capture.title), element('p', capture.guidance));
    card.append(label, textarea, actions, status);
    if (cp.orderId) {
      const receipt = state.events.find(e => e.checkpointId === cp.id && e.captureId);
      card.append(element('p', `Fixture order: ${cp.orderId}${receipt ? ` · Fixture capture: ${receipt.captureId}` : ''}`, 'scope-receipt-ids'));
    }
    list.append(card);
  });
  $('#scope-event-count').textContent = `${state.events.length} ${state.events.length === 1 ? 'event' : 'events'}`;
  const body = $('#scope-event-body');
  body.replaceChildren();
  for (const event of state.events) {
    const row = element('tr');
    row.append(
      element('td', String(event.seq).padStart(2, '0')),
      element('td', state.checkpoints.find(cp => cp.id === event.checkpointId).title),
      element('td', event.type), element('td', resultText(event))
    );
    body.append(row);
  }
  scopeHistory.update(() => encodeScopeWorkspace({ draft, review, evidenceDrafts }));
}

$('#scope-label').value = draft.label;
$('#scope-brief').value = draft.brief;
$('#scope-cap').value = draft.cap;
renderDraftRows();
form.addEventListener('input', () => { workspaceChanged(); updateBudget(); });
$('#scope-add').addEventListener('click', () => {
  draft = readDraft();
  if (draft.checkpoints.length >= MAX_CHECKPOINTS) return;
  clearDraftRemoval();
  workspaceChanged();
  draft.checkpoints.push({ title: '', amount: '', evidence: '' });
  clearErrors();
  renderDraftRows();
  $(`#draft-${draft.checkpoints.length - 1}-title`).focus();
});
$('#scope-draft-list').addEventListener('click', event => {
  const duplicate = event.target.closest('button[data-duplicate]');
  if (duplicate) {
    if (duplicate.disabled || review || form.hidden) return;
    const index = Number(duplicate.dataset.duplicate);
    const current = readDraft();
    if (!Number.isInteger(index) || index < 0 || index >= current.checkpoints.length
      || current.checkpoints.length >= MAX_CHECKPOINTS) return;
    clearDraftRemoval();
    workspaceChanged();
    current.checkpoints.splice(index + 1, 0, { ...current.checkpoints[index] });
    draft = current;
    clearErrors();
    renderDraftRows();
    $(`#draft-${index + 1}-title`).focus();
    $('#scope-order-status').textContent = `Checkpoint ${index + 1} duplicated at position ${index + 2} of ${draft.checkpoints.length}.`;
    return;
  }
  const move = event.target.closest('button[data-move]');
  if (move) {
    if (move.disabled || review || form.hidden) return;
    const index = Number(move.dataset.index);
    const direction = move.dataset.move;
    const offset = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    const current = readDraft();
    const destination = index + offset;
    if (!offset || !Number.isInteger(index) || index < 0 || index >= current.checkpoints.length
      || destination < 0 || destination >= current.checkpoints.length) return;
    clearDraftRemoval();
    workspaceChanged();
    // Keep each row's raw inputs together. IDs still come from final draft validation.
    [current.checkpoints[index], current.checkpoints[destination]] = [current.checkpoints[destination], current.checkpoints[index]];
    draft = current;
    clearErrors();
    renderDraftRows();
    const nextMove = $(`button[data-index="${destination}"][data-move="${direction}"]`);
    (nextMove.disabled ? $(`#draft-${destination}-title`) : nextMove).focus();
    $('#scope-order-status').textContent = `Checkpoint ${index + 1} moved to position ${destination + 1} of ${draft.checkpoints.length}.`;
    return;
  }
  const remove = event.target.closest('button[data-remove]');
  if (!remove || remove.disabled || review || form.hidden) return;
  const current = readDraft();
  const removed = draftRemoval.remove(current.checkpoints, Number(remove.dataset.remove));
  if (!removed) return;
  workspaceChanged();
  draft = { ...current, checkpoints: removed.checkpoints };
  clearErrors();
  renderDraftRows();
  $(`#draft-${Math.min(removed.index, draft.checkpoints.length - 1)}-title`).focus();
  $('#scope-order-status').textContent = `Checkpoint ${removed.index + 1} removed. Undo removal can restore its fields.`;
});
$('#scope-undo-remove').addEventListener('click', () => {
  if ($('#scope-undo-remove').disabled || review || form.hidden) return;
  const current = readDraft();
  const restored = draftRemoval.restore(current.checkpoints);
  if (!restored) { clearDraftRemoval(); return; }
  workspaceChanged();
  draft = { ...current, checkpoints: restored.checkpoints };
  clearErrors();
  renderDraftRows();
  $(`#draft-${restored.index}-title`).focus();
  $('#scope-order-status').textContent = `Checkpoint restored at position ${restored.index + 1} of ${draft.checkpoints.length}. Your other draft edits are kept.`;
});
form.addEventListener('submit', event => {
  event.preventDefault();
  draft = readDraft();
  const validation = validateScopeDraft(draft);
  if (!validation.ok) { showErrors(validation.errors); return; }
  clearDraftRemoval();
  workspaceChanged();
  review = createScopeReview(draft);
  evidenceDrafts.clear();
  clearErrors();
  form.hidden = true;
  $('#scope-review').hidden = false;
  $('#scope-action-status').textContent = 'Plan ready for review. No checkpoints are approved and no fixture payment events exist yet.';
  $('#scope-action-status').classList.remove('error');
  renderReview();
  $('#review-title').focus();
});
$('#scope-edit').addEventListener('click', () => {
  if (!review || review.snapshot().events.length > 0) return;
  workspaceChanged();
  // Evidence edits made during review become part of the editable draft.
  review.snapshot().checkpoints.forEach((cp, index) => {
    draft.checkpoints[index].evidence = evidenceDrafts.get(cp.id) ?? cp.evidence;
  });
  review = null;
  renderDraftRows();
  form.hidden = false;
  $('#scope-review').hidden = true;
  $('#review-step').removeAttribute('aria-current');
  $('#simulate-step').removeAttribute('aria-current');
  $('#draft-step').setAttribute('aria-current', 'step');
  $('#scope-label').focus();
});
$('#scope-review-list').addEventListener('input', event => {
  if (event.target.dataset.evidence && !event.target.readOnly) {
    workspaceChanged();
    evidenceDrafts.set(event.target.dataset.evidence, event.target.value);
  }
});
$('#scope-review-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || !review) return;
  const id = button.dataset.checkpoint;
  const action = button.dataset.action;
  const status = $('#scope-action-status');
  try {
    const evidence = $(`#review-evidence-${id}`).value;
    review.act(id, action, evidence);
    workspaceChanged();
    status.textContent = actionMessages[action];
    status.classList.remove('error');
    renderReview();
    $(`#review-heading-${id}`).focus();
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
    $(`#review-evidence-${id}`).focus();
  }
});

let openRequest = 0;
let readingWorkspace = false;
let pendingWorkspace = null;
let chooserWorkspace = null;

function workspaceValue() {
  return JSON.stringify({
    draft: readDraft(),
    review: review?.snapshot() ?? null,
    evidenceDrafts: [...evidenceDrafts],
    evidenceFields: [...document.querySelectorAll('[data-evidence]')]
      .map(field => [field.dataset.evidence, field.value])
  });
}

function currentOpen(request) {
  if (request.id !== openRequest) return false;
  if (request.value !== workspaceValue()) {
    cancelOpen('Your workspace changed. Choose the saved file again before replacing it.');
    return false;
  }
  return true;
}

function fileStatus(message, error = false) {
  const status = $('#scope-file-status');
  status.textContent = message;
  status.classList.toggle('error', error);
}

function cancelOpen(message = '') {
  openRequest += 1;
  readingWorkspace = false;
  pendingWorkspace = null;
  $('#scope-open-preview').hidden = true;
  $('#scope-open-summary').textContent = '';
  $('#scope-open-cancel').hidden = true;
  $('#scope-open').value = '';
  if (message) fileStatus(message);
}

function workspaceChanged() {
  if (readingWorkspace || pendingWorkspace || chooserWorkspace) {
    cancelOpen('Your workspace changed. Choose the saved file again when you are ready to replace it.');
  }
}

$('#scope-save').addEventListener('click', () => {
  let url;
  let link;
  try {
    const contents = encodeScopeWorkspace({
      draft: review ? draft : readDraft(), review, evidenceDrafts
    });
    const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
    url = URL.createObjectURL(blob);
    link = element('a');
    link.href = url;
    link.download = WORKSPACE_FILENAME;
    document.body.append(link);
    link.click();
    fileStatus('Workspace download started. Keep the JSON file to reopen this fictional draft or simulation.');
  } catch (error) {
    fileStatus('Could not prepare the workspace download. ' + error.message, true);
  } finally {
    link?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

$('#scope-review-download').addEventListener('click', () => {
  let url;
  let link;
  try {
    const contents = createScopeReviewDocument({
      draft: review ? draft : readDraft(), review, evidenceDrafts
    });
    url = URL.createObjectURL(new Blob([contents], { type: 'text/html;charset=utf-8' }));
    link = element('a');
    link.href = url;
    link.download = SCOPE_REVIEW_FILENAME;
    document.body.append(link);
    link.click();
    fileStatus('Scope review download started. Open the HTML file to read or print this fictional snapshot. Keep the separate JSON file to resume editing.');
  } catch (error) {
    fileStatus('Could not prepare the scope review. ' + error.message, true);
  } finally {
    link?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

$('#scope-revision-download').addEventListener('click', () => {
  let url;
  let link;
  try {
    const contents = createScopeRevisionDraft({ draft, review, evidenceDrafts });
    url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }));
    link = element('a');
    link.href = url;
    link.download = SCOPE_REVISION_FILENAME;
    document.body.append(link);
    link.click();
    fileStatus('Revision draft download started. Reopen the JSON to edit the original terms and review them anew. This workspace keeps its approvals, review evidence and simulated history.');
  } catch (error) {
    fileStatus('Could not prepare the revision draft. ' + error.message, true);
  } finally {
    link?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

$('#scope-open').addEventListener('click', () => {
  cancelOpen();
  chooserWorkspace = { id: openRequest, value: workspaceValue() };
});

$('#scope-open').addEventListener('change', async event => {
  const file = event.currentTarget.files?.[0];
  const chosen = chooserWorkspace;
  chooserWorkspace = null;
  if (file && chosen && !currentOpen(chosen)) return;
  cancelOpen();
  if (!file) { fileStatus('Opening canceled. Your current workspace is unchanged.'); return; }
  // Direct file drops have no chooser click. They still bind the read and
  // preview to the complete current workspace at the selection boundary.
  const request = { id: openRequest, value: workspaceValue() };
  readingWorkspace = true;
  $('#scope-open-cancel').hidden = false;
  fileStatus('Reading the saved workspace. Your current work remains in place.');
  try {
    if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
    const bytes = await file.arrayBuffer();
    if (!currentOpen(request)) return;
    if (bytes.byteLength > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
    let contents;
    try { contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('The workspace file must contain valid UTF-8 text.'); }
    const admitted = decodeScopeWorkspace(contents);
    if (!currentOpen(request)) return;
    pendingWorkspace = { admitted, request };
    readingWorkspace = false;
    const summary = admitted.summary;
    const name = summary.label.trim() || 'Untitled draft';
    $('#scope-open-summary').textContent = name + ' · '
      + (summary.stage === 'draft' ? 'Editable draft' : 'Reviewed fixture')
      + ' · ' + summary.checkpoints + ' checkpoints · '
      + summary.approved + ' recorded approvals · ' + summary.events + ' events.';
    $('#scope-open-preview').hidden = false;
    fileStatus('File checked. Replace the current workspace to open it, or cancel to keep your work.');
  } catch (error) {
    if (!currentOpen(request)) return;
    cancelOpen();
    fileStatus('Could not open the workspace. ' + error.message + ' Your current work is unchanged.', true);
  }
});

$('#scope-open').addEventListener('cancel', () => {
  chooserWorkspace = null;
  cancelOpen('Opening canceled. Your current workspace is unchanged.');
});
$('#scope-open-cancel').addEventListener('click', () => {
  chooserWorkspace = null;
  cancelOpen('Opening canceled. Your current workspace is unchanged.');
  $('#scope-open').focus();
});

$('#scope-open-apply').addEventListener('click', () => {
  if (!pendingWorkspace || !currentOpen(pendingWorkspace.request)) return;
  const next = pendingWorkspace.admitted;
  cancelOpen();
  clearDraftRemoval();
  draft = structuredClone(next.draft);
  review = next.review;
  evidenceDrafts.clear();
  for (const [id, value] of next.evidenceDrafts) evidenceDrafts.set(id, value);
  $('#scope-label').value = draft.label;
  $('#scope-brief').value = draft.brief;
  $('#scope-cap').value = draft.cap;
  renderDraftRows();
  clearErrors();
  form.hidden = Boolean(review);
  $('#scope-review').hidden = !review;
  $('#scope-action-status').classList.remove('error');
  if (review) {
    $('#scope-action-status').textContent = 'Saved fixture opened. Choose the next simulation step when you are ready.';
    renderReview();
  } else {
    $('#scope-action-status').textContent = '';
    $('#scope-review-list').replaceChildren();
    $('#scope-event-body').replaceChildren();
    $('#scope-event-count').textContent = '0 events';
    for (const id of ['review-title', 'review-brief', 'scope-total', 'scope-approved', 'scope-captured', 'scope-remaining', 'scope-unallocated']) {
      $('#' + id).textContent = '';
    }
    $('#review-step').removeAttribute('aria-current');
    $('#simulate-step').removeAttribute('aria-current');
    $('#draft-step').setAttribute('aria-current', 'step');
  }
  $('#scope-file-origin').hidden = false;
  fileStatus('Saved workspace opened. The file records a fictional fixture; it does not verify real approvals or payments.');
  (review ? $('#review-title') : $('#scope-label')).focus();
});
