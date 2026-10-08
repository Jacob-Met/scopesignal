import { createScopeLibrary, exportLibraryRow } from './scope-library.mjs';
import { formatUSD } from './scope-plan.mjs';
import { capturePresentation } from './payment-status.mjs';

const byId = id => document.getElementById(id);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
function field(list, label, value) {
  const wrapper = node('div', undefined, 'field');
  wrapper.append(node('dt', label), node('dd', value));
  list.append(wrapper);
}
let renderedRows = null;
let renderedSelection = null;
function detail(row) {
  byId('workspace-detail').replaceChildren();
  byId('export-status').textContent = '';
  byId('detail-placeholder').hidden = !!row;
  byId('export-panel').hidden = row?.status !== 'admitted';
  byId('detail-file').textContent = row ? 'FILE ' + (row.index + 1) + ' · ' + row.filename : 'READ-ONLY PREVIEW';
  byId('detail-title').textContent = row?.status === 'admitted' ? row.workspace.draft.label || 'Untitled draft (empty project name)' : row ? 'File refused' : 'Select a workspace';
  if (!row) return;
  const container = byId('workspace-detail');
  if (row.status === 'refused') { container.append(node('p', row.error)); return; }
  const { draft, review, summary, evidenceDrafts } = row.workspace;
  const state = review?.snapshot();
  container.append(node('p', (state ? 'Reviewed fictional scope' : 'Unfinished fictional draft') + ' · ' + summary.checkpoints + ' checkpoints · ' + summary.approved + ' recorded approvals · ' + summary.events + ' fixture events'));
  const original = node('dl', undefined, 'fields');
  field(original, 'Project name (as saved)', draft.label);
  field(original, 'Creative brief (as saved)', draft.brief);
  field(original, 'Project cap in USD (as entered)', draft.cap);
  container.append(original);
  if (state) {
    const totals = node('dl', undefined, 'totals');
    for (const [label, amount] of [['Project cap', state.plan.amount], ['Allocated checkpoints', state.total], ['Unallocated cap', state.unallocated], ['Simulated captured', state.captured], ['Allocated remaining', state.remaining]]) field(totals, label + ' (USD)', formatUSD(amount));
    container.append(totals, node('p', 'Pending and unknown outcomes count nothing. Recorded approvals and captures are fictional; totals belong only to this workspace.'));
  } else container.append(node('p', 'Draft fields may be unfinished. No amounts are totaled and no approvals or captures are implied.'));
  draft.checkpoints.forEach((checkpoint, index) => {
    const card = node('article', undefined, 'checkpoint');
    card.append(node('h3', 'Checkpoint ' + (index + 1)));
    const fields = node('dl', undefined, 'fields');
    field(fields, 'Deliverable (as entered)', checkpoint.title);
    field(fields, 'Amount in USD (as entered)', checkpoint.amount);
    field(fields, 'Planned acceptance evidence (as entered)', checkpoint.evidence);
    if (state) {
      const current = state.checkpoints[index];
      const capture = capturePresentation(current);
      field(fields, 'Recorded approval', current.approved ? 'Approval recorded in fixture' : 'Not approved');
      field(fields, current.approved ? 'Accepted evidence — from recorded approval' : 'Pending evidence — not approved', current.approved ? current.acceptedEvidence : evidenceDrafts.get(current.id) ?? current.evidence);
      field(fields, 'Current simulated capture state', capture.state === 'not_started' ? 'not started' : capture.state);
      field(fields, 'Current fixture guidance', capture.guidance);
    }
    card.append(fields); container.append(card);
  });
}
function render(state) {
  byId('batch-status').textContent = state.message;
  byId('workspace-list').setAttribute('aria-busy', String(state.busy));
  byId('empty-list').hidden = !!state.rows.length;
  if (state.rows !== renderedRows) {
    byId('workspace-list').replaceChildren(...state.rows.map(row => {
      const item = node('li'); const button = node('button', undefined, 'workspace-row');
      button.type = 'button'; button.dataset.index = row.index;
      button.append(node('span', (row.index + 1) + '. ' + row.filename, 'row-file'));
      if (row.status === 'admitted') {
        const summary = row.workspace.summary;
        button.append(node('span', row.workspace.draft.label || 'Untitled draft (empty project name)', 'row-title'),
          node('span', summary.stage + ' · ' + summary.checkpoints + ' checkpoints · ' + summary.approved + ' approvals · ' + summary.events + ' events', 'row-meta'));
      } else button.append(node('span', 'Refused', 'row-refusal'), node('span', row.error, 'row-meta'));
      button.addEventListener('click', () => library.select(row.index));
      item.append(button); return item;
    }));
  }
  for (const button of byId('workspace-list').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.index) === state.selected));
  if (state.rows !== renderedRows || state.selected !== renderedSelection) detail(state.rows[state.selected]);
  renderedRows = state.rows; renderedSelection = state.selected;
}
const library = createScopeLibrary(render);
byId('workspace-files').addEventListener('change', event => {
  const files = Array.from(event.target.files); event.target.value = '';
  void library.load(files);
});
byId('clear-batch').addEventListener('click', () => { byId('workspace-files').value = ''; library.clear(); });
byId('download-review').addEventListener('click', () => {
  const state = library.snapshot();
  try {
    const result = exportLibraryRow(state.rows[state.selected]);
    const url = URL.createObjectURL(new Blob([result.html], { type: 'text/html;charset=utf-8' }));
    const link = node('a'); link.href = url; link.download = result.filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('export-status').textContent = 'Downloaded ' + result.filename + '. Your original workspace files are unchanged.';
  } catch (error) { byId('export-status').textContent = error.message; }
});
render(library.snapshot());
