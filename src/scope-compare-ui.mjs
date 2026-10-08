import { MAX_WORKSPACE_BYTES } from './scope-workspace-record.mjs';
import { formatUSD } from './scope-plan.mjs';
import { createScopeComparisonDocument, SCOPE_COMPARISON_FILENAME } from './scope-comparison-export.mjs';
import {
  readComparisonWorkspace, sameDefinitionPairs, pairCheckpoint,
  compareWorkspaces, checkpointFields
} from './scope-compare.mjs';

const $ = selector => document.querySelector(selector);
const sides = {
  a: { document: null, request: 0, pending: false },
  b: { document: null, request: 0, pending: false }
};
let pairs = [];

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function valueText(value, kind) {
  if (value === null) {
    if (kind === 'approval') return 'Not reviewed';
    if (kind === 'capture') return 'No reviewed state';
    return kind === 'money' || kind === 'count' ? 'Not available' : 'None recorded';
  }
  if (kind === 'money') return formatUSD(value);
  if (kind === 'approval') return value ? 'Yes' : 'No';
  if (kind === 'stage') return value === 'draft' ? 'Editable draft' : 'Reviewed fixture';
  if (value === '') return '(empty text)';
  return String(value);
}

function status(side, text, error = false) {
  const node = $('#status-' + side);
  node.textContent = text;
  node.classList.toggle('error', error);
}

function updateFile(side) {
  const document = sides[side].document;
  $('#clear-' + side).disabled = !document && !sides[side].pending;
  $('#name-' + side).textContent = document?.name ?? 'No file opened';
  $('#detail-' + side).textContent = document
    ? valueText(document.workspace.stage, 'stage') + ' · ' + document.workspace.rows.length
      + ' checkpoints · ' + document.workspace.events.length + ' events · ' + document.bytes + ' bytes'
    : 'Choose a saved workspace to begin.';
}

function fieldTable(fields, title, changesOnly) {
  const wrapper = el('div', undefined, 'table-wrap');
  const table = el('table');
  table.append(el('caption', title));
  const head = el('thead'), headings = el('tr');
  for (const label of ['Field', 'File A', 'File B']) {
    const th = el('th', label); th.scope = 'col'; headings.append(th);
  }
  head.append(headings); table.append(head);
  const body = el('tbody');
  const visible = fields.filter(item => !changesOnly || item.changed);
  for (const item of visible) {
    const row = el('tr', undefined, item.changed ? 'changed' : '');
    row.dataset.field = item.key;
    const th = el('th', item.label); th.scope = 'row';
    if (item.changed) { th.append(el('br'), el('span', 'Changed', 'change-tag')); }
    row.append(th);
    for (const [side, value] of [['a', item.left], ['b', item.right]]) {
      const td = el('td', valueText(value, item.kind), 'value');
      td.dataset.side = side;
      row.append(td);
    }
    body.append(row);
  }
  if (!visible.length) {
    const row = el('tr'), cell = el('td', 'No changed fields in this section.', 'muted');
    cell.colSpan = 3; row.append(cell); body.append(row);
  }
  table.append(body); wrapper.append(table);
  return wrapper;
}

function renderPairing(left, right, comparison) {
  const controls = $('#pair-controls');
  controls.replaceChildren();
  for (const row of left.rows) {
    const current = pairs.find(pair => pair[0] === row.index)?.[1];
    const used = new Set(pairs.filter(pair => pair[0] !== row.index).map(pair => pair[1]));
    const group = el('div', undefined, 'pair-control');
    const id = 'pair-' + row.index;
    const label = el('label', 'A checkpoint ' + (row.index + 1) + ': ' + (row.title || '(empty deliverable)'));
    label.htmlFor = id;
    const select = el('select');
    select.id = id; select.dataset.leftIndex = row.index;
    select.setAttribute('aria-label', 'Pair A checkpoint ' + (row.index + 1) + ' with B');
    const empty = el('option', 'Unpaired'); empty.value = ''; select.append(empty);
    for (const other of right.rows) {
      const option = el('option', 'B ' + (other.index + 1) + ': ' + (other.title || '(empty deliverable)'));
      option.value = other.index;
      option.disabled = used.has(other.index);
      select.append(option);
    }
    select.value = current === undefined ? '' : String(current);
    group.append(label, select); controls.append(group);
  }
  $('#pair-summary').textContent = comparison.rows.length + ' pairs · '
    + comparison.rows.filter(row => row.sameDefinition).length + ' same definitions · '
    + comparison.unpairedLeft.length + ' unpaired in A · '
    + comparison.unpairedRight.length + ' unpaired in B';
}

function unpairedCard(row, side) {
  const card = el('article', undefined, 'unpaired-card');
  card.dataset.unpaired = side + '-' + row.index;
  card.append(el('h4', 'Unpaired ' + side.toUpperCase() + ' checkpoint ' + (row.index + 1)));
  card.append(el('p', 'This row is not paired for comparison; no addition or removal is inferred.', 'help'));
  const dl = el('dl');
  for (const item of checkpointFields(row)) {
    dl.append(el('dt', item.label), el('dd', valueText(item.value, item.kind)));
  }
  card.append(dl); return card;
}

function renderRows(comparison, changesOnly) {
  const paired = $('#paired-rows'), unpaired = $('#unpaired-rows');
  paired.replaceChildren(); unpaired.replaceChildren();
  for (const row of comparison.rows) {
    if (changesOnly && !row.changed && !row.differentRowNumbers) continue;
    const card = el('article', undefined, 'pair-card');
    card.dataset.pair = row.leftIndex + '-' + row.rightIndex;
    const heading = el('h4', 'A checkpoint ' + (row.leftIndex + 1) + ' ↔ B checkpoint ' + (row.rightIndex + 1));
    heading.append(el('span', row.sameDefinition ? 'Same definition' : 'Paired for review', 'definition-tag'));
    card.append(heading);
    if (row.differentRowNumbers) card.append(el('p', 'These definitions occupy different row numbers in the two files.', 'help'));
    card.append(fieldTable(row.fields, 'Checkpoint fields', changesOnly));
    paired.append(card);
  }
  if (!paired.children.length) paired.append(el('p',
    comparison.rows.length ? 'No changed paired fields or different row numbers.' : 'No checkpoints are paired yet.', 'help'));
  const left = el('div'), right = el('div');
  for (const row of comparison.unpairedLeft) left.append(unpairedCard(row, 'a'));
  for (const row of comparison.unpairedRight) right.append(unpairedCard(row, 'b'));
  unpaired.append(left, right);
}

function renderHistory(comparison, left, right) {
  const h = comparison.history;
  const texts = {
    'not-reviewed': 'At least one file is an editable draft. No shared review history is asserted.',
    'different-plans': 'Reviewed plan definitions differ. The two event lists are shown separately.',
    equal: 'Both files contain the same canonical fixture event sequence (' + h.leftEvents + ' events).',
    'a-prefix': 'All ' + h.leftEvents + ' events in A match the beginning of B. B contains ' + (h.rightEvents - h.leftEvents) + ' additional saved events.',
    'b-prefix': 'All ' + h.rightEvents + ' events in B match the beginning of A. A contains ' + (h.leftEvents - h.rightEvents) + ' additional saved events.',
    divergent: 'The reviewed plan definitions agree, but the event lists diverge after ' + h.commonEvents + ' matching events.'
  };
  $('#history-summary').textContent = texts[h.kind];
  $('#history-summary').dataset.relationship = h.kind;
  for (const [side, workspace] of [['a', left], ['b', right]]) {
    const area = $('#events-' + side + ' .event-list');
    area.replaceChildren();
    $('#events-' + side + ' > summary').textContent = 'Inspect file ' + side.toUpperCase() + ' events (' + workspace.events.length + ')';
    for (const event of workspace.events) {
      const details = el('details');
      details.append(el('summary', '#' + event.seq + ' · ' + event.type + ' · ' + event.checkpointId));
      const dl = el('dl');
      for (const [key, value] of Object.entries(event)) dl.append(el('dt', key), el('dd', String(value)));
      details.append(dl); area.append(details);
    }
    if (!workspace.events.length) area.append(el('p', 'No events recorded in this file.', 'help'));
  }
}

function render() {
  updateFile('a'); updateFile('b');
  const left = sides.a.document?.workspace, right = sides.b.document?.workspace;
  $('#comparison').hidden = !left || !right;
  $('#waiting').hidden = Boolean(left && right);
  if (!left || !right) return;
  const comparison = compareWorkspaces(left, right, pairs);
  const changesOnly = $('#changes-only').checked;
  $('#project-fields').replaceChildren(fieldTable(comparison.project, 'Saved project fields', changesOnly));
  $('#totals').replaceChildren(fieldTable(comparison.totals, 'Amounts and recorded fixture totals', changesOnly));
  renderPairing(left, right, comparison);
  renderRows(comparison, changesOnly);
  renderHistory(comparison, left, right);
}

function resetPairing() {
  pairs = sides.a.document && sides.b.document
    ? sameDefinitionPairs(sides.a.document.workspace, sides.b.document.workspace) : [];
}

for (const side of ['a', 'b']) {
  const input = $('#file-' + side);
  input.addEventListener('click', () => {
    sides[side].request += 1;
    sides[side].pending = false; updateFile(side);
    status(side, 'Choose a saved workspace. The displayed file remains in place.');
  });
  input.addEventListener('cancel', () => {
    sides[side].request += 1;
    sides[side].pending = false; updateFile(side);
    status(side, 'Selection canceled. The displayed file remains in place.');
  });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    const request = ++sides[side].request;
    input.value = '';
    sides[side].pending = Boolean(file); updateFile(side);
    if (!file) { status(side, 'No file selected. The displayed file remains in place.'); return; }
    status(side, 'Reading ' + file.name + '. The displayed comparison remains in place.');
    try {
      if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
      const bytes = await file.arrayBuffer();
      if (request !== sides[side].request) return;
      if (bytes.byteLength > MAX_WORKSPACE_BYTES) throw new Error('Choose a file no larger than 1 MiB.');
      let contents;
      try { contents = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('The file must contain valid UTF-8 text.'); }
      const workspace = readComparisonWorkspace(contents);
      if (request !== sides[side].request) return;
      sides[side].pending = false;
      sides[side].document = { name: file.name, bytes: bytes.byteLength, workspace, contents };
      resetPairing(); render();
      status(side, 'Opened ' + file.name + '. Pairing now reflects the displayed files.');
      $('#comparison-status').textContent = 'The displayed file ' + side.toUpperCase() + ' was replaced. Review its checkpoint pairing.';
    } catch (error) {
      if (request !== sides[side].request) return;
      sides[side].pending = false; updateFile(side);
      status(side, 'Could not open ' + file.name + '. ' + error.message + ' The displayed file and pairing are unchanged.', true);
    }
  });
  $('#clear-' + side).addEventListener('click', () => {
    sides[side].request += 1; sides[side].document = null; sides[side].pending = false;
    input.value = ''; pairs = []; render();
    status(side, 'File ' + side.toUpperCase() + ' cleared.');
    input.focus();
  });
}

$('#pair-controls').addEventListener('change', event => {
  const select = event.target.closest('select[data-left-index]');
  if (!select) return;
  try {
    pairs = pairCheckpoint(sides.a.document.workspace, sides.b.document.workspace,
      pairs, Number(select.dataset.leftIndex), select.value === '' ? null : Number(select.value));
    render();
    $('#comparison-status').textContent = 'Checkpoint pairing updated. Neither file was changed.';
  } catch (error) {
    $('#comparison-status').textContent = error.message;
    render();
  }
  $('#' + select.id)?.focus({ preventScroll: true });
});
$('#reset-pairs').addEventListener('click', () => {
  resetPairing(); render();
  $('#comparison-status').textContent = 'Pairing reset to unique same definitions. Repeated and changed definitions remain unpaired.';
});
$('#changes-only').addEventListener('change', render);
$('#download-comparison').addEventListener('click', () => {
  let url;
  try {
    const contents = createScopeComparisonDocument({
      left: sides.a.document, right: sides.b.document, pairs
    });
    url = URL.createObjectURL(new Blob([contents], { type: 'text/html;charset=utf-8' }));
    const link = el('a');
    link.href = url; link.download = SCOPE_COMPARISON_FILENAME;
    document.body.append(link);
    try { link.click(); } finally { link.remove(); }
    $('#comparison-status').textContent = 'Comparison review download prepared from the displayed files and chosen pairs. All fields and event histories are included.';
  } catch (error) {
    $('#comparison-status').textContent = 'Could not prepare the comparison review. ' + error.message + ' The displayed files and pairing are unchanged.';
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
$('#swap').addEventListener('click', () => {
  if (!sides.a.document || !sides.b.document) return;
  for (const side of ['a', 'b']) { sides[side].request += 1; sides[side].pending = false; $('#file-' + side).value = ''; }
  [sides.a.document, sides.b.document] = [sides.b.document, sides.a.document];
  pairs = pairs.map(([a, b]) => [b, a]).sort((x, y) => x[0] - y[0]);
  render();
  status('a', 'Sides swapped.'); status('b', 'Sides swapped.');
  $('#comparison-status').textContent = 'A and B swapped; the same chosen pairs are retained.';
});
render();

