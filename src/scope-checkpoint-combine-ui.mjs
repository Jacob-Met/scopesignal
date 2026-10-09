import { readCombineWorkspace, prepareCheckpointCombine, COMBINE_FILENAME } from './scope-checkpoint-combine.mjs';
import { MAX_WORKSPACE_BYTES } from './scope-workspace-record.mjs';
import { formatUSD } from './scope-plan.mjs';

const $ = selector => document.querySelector(selector);
let loaded = null;
let prepared = null;
let revision = 0;
let readEpoch = 0;
let reading = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function detail(list, label, value) {
  list.append(element('dt', label), element('dd', value, 'combine-literal'));
}

function projectDetails(list, draft) {
  list.replaceChildren();
  detail(list, 'Project name', draft.label);
  detail(list, 'Creative brief', draft.brief);
  detail(list, 'Project cap (USD)', draft.cap);
}

function rowDetails(row, ordinal, tag = 'div') {
  const card = element(tag, undefined, 'combine-row');
  card.dataset.ordinal = String(ordinal);
  card.append(element('h3', 'Checkpoint ' + (ordinal + 1)));
  const list = element('dl', undefined, 'combine-details');
  detail(list, 'Deliverable', row.title);
  detail(list, 'Amount (USD)', row.amount);
  detail(list, 'Planned evidence', row.evidence);
  card.append(list);
  return card;
}

function showBudget(target, budget) {
  target.replaceChildren();
  const amount = value => value === null ? 'Unfinished or invalid amount' : formatUSD(value);
  target.append(element('p', 'Project cap: ' + amount(budget.cap)
    + ' · Checkpoint total: ' + amount(budget.allocated)
    + ' · Unallocated: ' + amount(budget.unallocated)));
}

function selectedPositions() {
  return [...$('#combine-rows').querySelectorAll('input[type="checkbox"]:checked')]
    .map(input => Number(input.value));
}

function signature() {
  return JSON.stringify({
    loadedRevision: loaded?.revision ?? null,
    selected: selectedPositions(),
    title: $('#combine-title').value,
    evidence: $('#combine-evidence').value
  });
}

function setReading(value) {
  reading = value;
  $('#combine-editor').disabled = value;
  $('#combine-open').disabled = value;
  $('#combine-cancel-read').disabled = !value;
  $('#combine-clear').disabled = !loaded && !value;
}

function retire(message, cancelRead = true) {
  revision += 1;
  prepared = null;
  $('#combine-download').disabled = true;
  $('#combine-preview').hidden = true;
  for (const id of ['combine-selected', 'combine-result-project', 'combine-result-budget',
    'combine-result-rows', 'combine-validation-errors']) $('#' + id).replaceChildren();
  for (const id of ['combine-change', 'combine-validation-note', 'combine-json']) $('#' + id).textContent = '';
  $('#combine-error').hidden = true;
  $('#combine-error').textContent = '';
  if (cancelRead) {
    readEpoch += 1;
    setReading(false);
  }
  if (message) $('#combine-status').textContent = message;
}

function showError(message) {
  $('#combine-error').textContent = message;
  $('#combine-error').hidden = false;
}

function updateSelection() {
  $('#combine-selection-count').textContent = selectedPositions().length + ' of 2 checkpoints selected.';
}

function renderLoaded() {
  const { draft, budget } = loaded.admitted;
  $('#combine-form').hidden = false;
  $('#combine-source-name').textContent = 'Loaded draft: ' + loaded.name
    + ' · ' + loaded.bytes.byteLength + ' bytes · ' + draft.checkpoints.length + ' checkpoints.';
  projectDetails($('#combine-project'), draft);
  showBudget($('#combine-source-budget'), budget);
  const rows = $('#combine-rows');
  rows.replaceChildren();
  draft.checkpoints.forEach((row, index) => {
    const card = rowDetails(row, index);
    const label = element('label', undefined, 'combine-select');
    const input = element('input');
    input.type = 'checkbox';
    input.name = 'checkpoint';
    input.id = 'combine-pick-' + index;
    input.value = String(index);
    label.htmlFor = input.id;
    label.append(input, element('span', 'Combine checkpoint ' + (index + 1)));
    card.prepend(label);
    rows.append(card);
  });
  $('#combine-title').value = '';
  $('#combine-evidence').value = '';
  updateSelection();
}

$('#combine-file').addEventListener('click', () => {
  retire('File selection started. Any loaded draft and entered details remain; preview again after choosing or canceling.');
});
$('#combine-file').addEventListener('change', () => {
  retire('File selection changed. Open the selected file explicitly; the last loaded draft remains in place.');
});
$('#combine-file').addEventListener('cancel', () => {
  retire('File selection canceled. The loaded draft and entered details remain; preview again before downloading.');
});

$('#combine-file-form').addEventListener('submit', async event => {
  event.preventDefault();
  retire();
  const file = $('#combine-file').files?.[0];
  if (!file) {
    showError('Choose one saved draft file first.');
    $('#combine-status').textContent = 'No file opened. Any loaded draft and entered details remain.';
    return;
  }
  const epoch = readEpoch;
  const fileIdentity = [file.name, file.size, file.lastModified, file.type].join('\u0000');
  const current = () => epoch === readEpoch && $('#combine-file').files?.[0] === file
    && [file.name, file.size, file.lastModified, file.type].join('\u0000') === fileIdentity;
  setReading(true);
  $('#combine-status').textContent = 'Reading the selected draft. The last loaded draft stays in place.';
  try {
    if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
    const buffer = await file.arrayBuffer();
    if (!current()) return;
    const bytes = new Uint8Array(buffer);
    const admitted = readCombineWorkspace(bytes);
    if (!current()) return;
    retire(undefined, false);
    loaded = { bytes, admitted, name: file.name, revision };
    setReading(false);
    renderLoaded();
    $('#combine-status').textContent = 'Draft opened. Choose two checkpoint positions and enter their replacement.';
    $('#combine-pick-0')?.focus();
  } catch (error) {
    if (!current()) return;
    retire('The selected file was refused. Any previously loaded draft and entered details remain; prepare a fresh preview.');
    showError(error.message);
  } finally {
    if (current()) setReading(false);
  }
});

$('#combine-cancel-read').addEventListener('click', () => {
  retire('File read canceled. Any loaded draft and entered details remain; prepare a fresh preview.');
  $('#combine-file').focus();
});

$('#combine-clear').addEventListener('click', () => {
  retire('Loaded draft cleared. Open a draft to choose checkpoints.');
  loaded = null;
  $('#combine-file').value = '';
  $('#combine-form').reset();
  $('#combine-form').hidden = true;
  $('#combine-project').replaceChildren();
  $('#combine-source-budget').replaceChildren();
  $('#combine-rows').replaceChildren();
  $('#combine-source-name').textContent = 'No draft loaded.';
  setReading(false);
  $('#combine-file').focus();
});

$('#combine-rows').addEventListener('change', () => {
  retire('Checkpoint selection changed. Preview again before downloading.');
  updateSelection();
});
for (const id of ['combine-title', 'combine-evidence']) {
  $('#' + id).addEventListener('input', () => {
    retire('Replacement text changed. Preview again before downloading.');
  });
  $('#' + id).addEventListener('change', () => {
    retire('Replacement text changed. Preview again before downloading.');
  });
}

$('#combine-form').addEventListener('submit', event => {
  event.preventDefault();
  const wasReading = reading;
  retire();
  if (!loaded || wasReading) {
    showError('Open a draft and finish its file read before preparing a preview.');
    return;
  }
  try {
    const result = prepareCheckpointCombine(loaded.bytes, selectedPositions(), {
      title: $('#combine-title').value,
      evidence: $('#combine-evidence').value
    });
    prepared = { result, revision, signature: signature() };
    $('#combine-change').textContent = 'Checkpoints ' + result.selected.map(index => index + 1).join(' and ')
      + ' combine to ' + formatUSD(result.combinedCents) + ' at checkpoint ' + (result.selected[0] + 1)
      + '. The draft changes from ' + result.source.draft.checkpoints.length + ' to ' + result.draft.checkpoints.length + ' rows.';
    result.selected.forEach(index => {
      $('#combine-selected').append(rowDetails(result.source.draft.checkpoints[index], index));
    });
    projectDetails($('#combine-result-project'), result.draft);
    showBudget($('#combine-result-budget'), result.budget);
    result.draft.checkpoints.forEach((row, index) => {
      $('#combine-result-rows').append(rowDetails(row, index, 'li'));
    });
    $('#combine-validation-note').textContent = result.validation.ok
      ? 'The ordinary draft field checks currently pass. Review this draft explicitly in the workspace before any simulation.'
      : 'Some ordinary draft fields still need attention before review. Their exact unfinished content is preserved in the download.';
    for (const error of result.validation.errors) {
      $('#combine-validation-errors').append(element('li', error.message));
    }
    $('#combine-json').textContent = result.contents;
    $('#combine-preview').hidden = false;
    $('#combine-download').disabled = false;
    $('#combine-status').textContent = 'Preview ready. Inspect the complete resulting draft before explicitly downloading.';
    $('#combine-preview-title').focus();
  } catch (error) {
    retire('A combined draft could not be prepared. Correct the indicated input and preview again.');
    showError(error.message);
  }
});

$('#combine-cancel-preview').addEventListener('click', () => {
  retire('Preview canceled. Your loaded draft and entered details remain.');
  $('#combine-preview-button').focus();
});

$('#combine-download').addEventListener('click', () => {
  if (!prepared || reading || prepared.revision !== revision || prepared.signature !== signature()) {
    retire('The input changed. Prepare a fresh preview before downloading.');
    return;
  }
  let url;
  let link;
  try {
    url = URL.createObjectURL(new Blob([prepared.result.contents], { type: 'application/json;charset=utf-8' }));
    link = element('a');
    link.href = url;
    link.download = COMBINE_FILENAME;
    document.body.append(link);
    link.click();
    $('#combine-status').textContent = 'Combined draft download started. Open and review the new JSON explicitly in the scope workspace.';
  } catch (error) {
    retire('The draft download could not start. Prepare a fresh preview to try again.');
    showError(error.message);
  } finally {
    link?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
window.addEventListener('pagehide', () => retire());
