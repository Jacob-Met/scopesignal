import {
  MAX_CHECKPOINT_CSV_BYTES, CHECKPOINT_DRAFT_FILENAME, CheckpointCsvError, prepareCheckpointDraft
} from './scope-checkpoint-csv.mjs';
import { formatUSD } from './scope-plan.mjs';

const $ = selector => document.querySelector(selector);
const form = $('#csv-form');
let generation = 0;
let prepared = null;

function metadata() {
  return { label: $('#csv-label').value, brief: $('#csv-brief').value, cap: $('#csv-cap').value };
}
function sameInputs(request) {
  const current = metadata();
  return request.generation === generation
    && request.file === $('#csv-file').files?.[0]
    && ['label', 'brief', 'cap'].every(field => current[field] === request.metadata[field]);
}
function retire(message = '') {
  generation++;
  prepared = null;
  $('#csv-preview').hidden = true;
  $('#csv-download').disabled = true;
  $('#csv-cancel').disabled = true;
  $('#csv-review').disabled = false;
  $('#csv-errors').hidden = true;
  $('#csv-errors').textContent = '';
  $('#csv-status').textContent = message;
  $('#csv-preview-rows').replaceChildren();
  $('#csv-validation').replaceChildren();
  for (const id of ['csv-source-name', 'csv-preview-label', 'csv-preview-brief', 'csv-preview-cap', 'csv-budget']) {
    $('#' + id).textContent = '';
  }
}
function failure(message) {
  retire();
  $('#csv-errors').textContent = message;
  $('#csv-errors').hidden = false;
  $('#csv-errors').focus();
}
function budgetText(budget) {
  if (budget.allocated === null) return 'The checkpoint total is unfinished. Amounts are kept exactly as entered.';
  if (budget.cap === null) return formatUSD(budget.allocated) + ' allocated · the project cap is unfinished.';
  if (budget.unallocated < 0) return formatUSD(budget.allocated) + ' allocated · ' + formatUSD(-budget.unallocated) + ' over the cap.';
  return formatUSD(budget.allocated) + ' allocated · ' + formatUSD(budget.unallocated) + ' unallocated within the cap.';
}
function showPreview(request, result) {
  $('#csv-source-name').textContent = request.file.name + ' · ' + request.file.size + ' bytes · '
    + result.draft.checkpoints.length + ' checkpoints';
  $('#csv-preview-label').textContent = result.draft.label;
  $('#csv-preview-brief').textContent = result.draft.brief;
  $('#csv-preview-cap').textContent = result.draft.cap;
  $('#csv-budget').textContent = budgetText(result.budget);
  const rows = result.draft.checkpoints.map((checkpoint, index) => {
    const row = document.createElement('tr');
    const position = document.createElement('th');
    position.scope = 'row';
    position.textContent = String(index + 1);
    row.append(position);
    for (const field of ['title', 'amount', 'evidence']) {
      const cell = document.createElement('td');
      cell.textContent = checkpoint[field];
      cell.dataset.field = field;
      row.append(cell);
    }
    return row;
  });
  $('#csv-preview-rows').replaceChildren(...rows);
  if (result.validation.ok) {
    const item = document.createElement('li');
    item.textContent = 'The native scope checks pass. Open the file as a draft, then review the scope in the workspace.';
    $('#csv-validation').replaceChildren(item);
  } else {
    $('#csv-validation').replaceChildren(...result.validation.errors.map(error => {
      const item = document.createElement('li');
      item.textContent = error.message;
      return item;
    }));
  }
  prepared = { request, contents: result.contents };
  $('#csv-preview').hidden = false;
  $('#csv-download').disabled = false;
  $('#csv-cancel').disabled = false;
  $('#csv-review').disabled = false;
  $('#csv-status').textContent = result.validation.ok
    ? 'Draft file reviewed. Download it when you are ready.'
    : 'Draft file reviewed with unfinished scope details. You can download it and complete them in the workspace.';
  $('#csv-preview-title').focus();
}

for (const id of ['csv-label', 'csv-brief', 'csv-cap']) {
  $('#' + id).addEventListener('input', () => retire('Details changed. Review the draft file again before downloading.'));
}
$('#csv-file').addEventListener('change', () => retire(
  $('#csv-file').files?.length ? 'CSV selected. Add the project details and review the draft file.' : 'No CSV selected.'
));
$('#csv-file').addEventListener('cancel', () => retire('File selection canceled. Review the draft file again before downloading.'));
$('#csv-cancel').addEventListener('click', () => {
  retire('Review canceled. Your selected file and project details are still here.');
  $('#csv-review').focus();
});
window.addEventListener('pagehide', () => retire());

form.addEventListener('submit', async event => {
  event.preventDefault();
  retire();
  const file = $('#csv-file').files?.[0];
  if (!file) { failure('Choose a checkpoint CSV file to review.'); return; }
  const request = { generation, file, metadata: metadata() };
  $('#csv-review').disabled = true;
  $('#csv-cancel').disabled = false;
  $('#csv-status').textContent = 'Reading the CSV. Cancel or change an input to discard this review.';
  try {
    if (file.size > MAX_CHECKPOINT_CSV_BYTES) {
      throw new CheckpointCsvError('CSV_SIZE', 'Choose a CSV file no larger than 1 MiB.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!sameInputs(request)) return;
    const result = prepareCheckpointDraft(bytes, request.metadata);
    if (!sameInputs(request)) return;
    showPreview(request, result);
  } catch (error) {
    if (!sameInputs(request)) return;
    failure(error instanceof CheckpointCsvError ? error.message : 'The CSV could not be read. Choose the file again and retry.');
  }
});

$('#csv-download').addEventListener('click', () => {
  if (!prepared || !sameInputs(prepared.request)) {
    retire('The inputs changed. Review the draft file again before downloading.');
    return;
  }
  let url, link;
  try {
    url = URL.createObjectURL(new Blob([prepared.contents], { type: 'application/json;charset=utf-8' }));
    link = document.createElement('a');
    link.href = url;
    link.download = CHECKPOINT_DRAFT_FILENAME;
    document.body.append(link);
    link.click();
    $('#csv-status').textContent = 'Draft download started. In the workspace, choose Open saved workspace, review the file, then choose Replace workspace.';
  } catch {
    $('#csv-status').textContent = 'The draft download could not start. Your reviewed file is still ready; try Download draft workspace again.';
  } finally {
    link?.remove();
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
