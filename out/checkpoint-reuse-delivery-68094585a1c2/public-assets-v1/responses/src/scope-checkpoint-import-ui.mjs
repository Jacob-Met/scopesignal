import { MAX_CHECKPOINTS } from './scope-plan.mjs';
import { MAX_WORKSPACE_BYTES } from './scope-workspace-record.mjs';
import { readCheckpointSource, selectCheckpointDefinitions } from './scope-checkpoint-import.mjs';

export function mountCheckpointImport({ root, getCurrent, append }) {
  const $ = selector => root.querySelector(selector);
  const fileInput = $('#scope-checkpoint-file');
  const preview = $('#scope-checkpoint-preview');
  const list = $('#scope-checkpoint-options');
  const apply = $('#scope-checkpoint-apply');
  const cancel = $('#scope-checkpoint-cancel');
  const status = $('#scope-checkpoint-status');
  let generation = 0;
  let chooser = null;
  let reading = false;
  let pending = null;

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  function retire(text = '') {
    generation += 1;
    reading = false;
    pending = null;
    preview.hidden = true;
    cancel.hidden = true;
    list.replaceChildren();
    $('#scope-checkpoint-source').textContent = '';
    $('#scope-checkpoint-selection').textContent = '';
    fileInput.value = '';
    apply.disabled = true;
    if (text) message(text);
    // Keep an outstanding chooser's old generation until its change/cancel.
    // Otherwise an edit while the chooser is open could admit that stale choice.
  }

  function current(request) {
    if (request.generation !== generation) return false;
    const now = getCurrent();
    if (!now.editable || request.value !== now.value) {
      retire('Your draft changed. Choose the saved file again before adding checkpoints.');
      return false;
    }
    return true;
  }

  function capture() {
    const now = getCurrent();
    if (!now.editable) throw new Error('Return to an editable draft before reusing checkpoints.');
    return { generation, value: now.value };
  }

  const selections = () => [...list.querySelectorAll('input:checked')].map(input => Number(input.value));

  function selectionSummary() {
    if (!pending || !current(pending.request)) return;
    const count = selections().length;
    const remaining = MAX_CHECKPOINTS - getCurrent().count;
    $('#scope-checkpoint-selection').textContent = `${count} selected · Room for ${remaining} more ${remaining === 1 ? 'checkpoint' : 'checkpoints'}.`
      + (count > remaining ? ' Choose fewer checkpoints before adding.' : '');
    apply.disabled = count === 0 || count > remaining;
  }

  function definition(label, value, row) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.className = 'scope-checkpoint-literal';
    if (value === '') {
      const empty = document.createElement('em');
      empty.textContent = 'Empty field';
      detail.append(empty);
    } else detail.textContent = value;
    row.append(term, detail);
  }

  function showSource(source) {
    const project = document.createElement('span');
    project.className = 'scope-checkpoint-literal';
    project.textContent = source.label || 'Untitled draft';
    $('#scope-checkpoint-source').append(project, document.createTextNode(
      ` · ${source.stage === 'draft' ? 'Editable draft' : 'Reviewed fixture'} · ${source.checkpoints.length} saved checkpoints`));
    source.checkpoints.forEach((checkpoint, index) => {
      const row = document.createElement('fieldset');
      row.className = 'scope-checkpoint-option';
      const legend = document.createElement('legend');
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(index);
      input.id = `scope-checkpoint-choice-${index}`;
      label.htmlFor = input.id;
      label.append(input, document.createTextNode(` Checkpoint ${index + 1}`));
      legend.append(label);
      const details = document.createElement('dl');
      definition('Deliverable', checkpoint.title, details);
      definition('Amount (USD, as saved)', checkpoint.amount, details);
      definition('Planned acceptance evidence', checkpoint.evidence, details);
      row.append(legend, details);
      list.append(row);
    });
    preview.hidden = false;
    selectionSummary();
  }

  // These controls manage a pending choice, not the authored form's data.
  root.addEventListener('input', event => event.stopPropagation());
  fileInput.addEventListener('click', event => {
    retire();
    chooser = null;
    try { chooser = capture(); }
    catch (error) { event.preventDefault(); message(error.message, true); }
  });
  fileInput.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    const chosen = chooser;
    chooser = null;
    if (file && chosen && !current(chosen)) {
      fileInput.value = '';
      return;
    }
    retire();
    if (!file) { message('Checkpoint reuse canceled. Your current draft is unchanged.'); return; }
    let request;
    try {
      request = capture();
      reading = true;
      cancel.hidden = false;
      message('Reading the saved checkpoints. Your current draft remains in place.');
      if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
      const bytes = await file.arrayBuffer();
      if (!current(request)) return;
      if (bytes.byteLength > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
      let contents;
      try { contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('The workspace file must contain valid UTF-8 text.'); }
      const source = readCheckpointSource(contents);
      if (!current(request)) return;
      reading = false;
      pending = { source, request };
      showSource(source);
      message('Choose the checkpoint definitions to add. Your current project and checkpoints will stay in place.');
    } catch (error) {
      if (request && !current(request)) return;
      retire();
      message('Could not read the saved checkpoints. ' + error.message + ' Your current draft is unchanged.', true);
    }
  });
  list.addEventListener('change', selectionSummary);
  const cancelChoice = () => {
    chooser = null;
    retire('Checkpoint reuse canceled. Your current draft is unchanged.');
    fileInput.focus();
  };
  fileInput.addEventListener('cancel', cancelChoice);
  cancel.addEventListener('click', cancelChoice);
  apply.addEventListener('click', () => {
    if (!pending || !current(pending.request)) return;
    try {
      const rows = selectCheckpointDefinitions(pending.source, selections(), getCurrent().count);
      append(rows);
      retire();
      message(`${rows.length} ${rows.length === 1 ? 'checkpoint added' : 'checkpoints added'} to this draft. Review the copied definitions and amounts before continuing.`);
    } catch (error) {
      message('Could not add the selected checkpoints. ' + error.message, true);
    }
  });
  return Object.freeze({
    retire() {
      const active = reading || pending || chooser;
      retire(active ? 'Your draft changed. Choose the saved file again before adding checkpoints.' : '');
    }
  });
}
