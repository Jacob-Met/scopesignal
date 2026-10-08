import { readComparisonWorkspace, compareWorkspaces, checkpointFields } from './scope-compare.mjs';
import { formatUSD } from './scope-plan.mjs';

export const SCOPE_COMPARISON_FILENAME = 'scopesignal-comparison-review.html';

function escape(value) {
  const text = String(value);
  // JSON can preserve strings that HTML cannot. Never silently replace them.
  if (text.includes('\0') || !text.isWellFormed()) {
    throw new Error('Some text cannot be preserved in HTML. Keep the workspace JSON files and correct that text before downloading a comparison review.');
  }
  return text.replace(/[&<>"'\r]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;'
  })[character]);
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
  return value === '' ? '(empty text)' : String(value);
}

function fieldTable(fields, caption) {
  return `<table><caption>${escape(caption)}</caption><thead><tr><th scope="col">Field</th><th scope="col">File A</th><th scope="col">File B</th></tr></thead><tbody>${fields.map(item =>
    `<tr data-field="${escape(item.key)}"${item.changed ? ' class="changed"' : ''}><th scope="row">${escape(item.label)}${item.changed ? '<span class="tag">Changed</span>' : ''}</th><td data-side="a">${escape(valueText(item.left, item.kind))}</td><td data-side="b">${escape(valueText(item.right, item.kind))}</td></tr>`
  ).join('\n')}</tbody></table>`;
}

function pairedRows(comparison) {
  if (!comparison.rows.length) return '<p>No checkpoints are paired for comparison.</p>';
  return comparison.rows.map(row => `<article class="card" data-pair="${row.leftIndex}-${row.rightIndex}">
<h3>A checkpoint ${row.leftIndex + 1} ↔ B checkpoint ${row.rightIndex + 1}</h3>
<p class="pair-label">${row.sameDefinition ? 'Same definition' : 'Paired for review'}${row.differentRowNumbers ? ' · Different row numbers' : ''}</p>
${fieldTable(row.fields, 'Checkpoint fields')}
</article>`).join('\n');
}

function unpairedRows(rows, side) {
  if (!rows.length) return `<p>No unpaired checkpoints in file ${side.toUpperCase()}.</p>`;
  return rows.map(row => `<article class="card" data-unpaired="${side}-${row.index}">
<h3>Unpaired ${side.toUpperCase()} checkpoint ${row.index + 1}</h3>
<p>This row is not paired for comparison; no addition or removal is inferred.</p>
<dl>${checkpointFields(row).map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(valueText(item.value, item.kind))}</dd></div>`).join('\n')}</dl>
</article>`).join('\n');
}

function historySummary(history) {
  const { leftEvents, rightEvents, commonEvents } = history;
  const messages = {
    'not-reviewed': 'At least one file is an editable draft. No shared review history is asserted.',
    'different-plans': 'Reviewed plan definitions differ. The two event lists are shown separately.',
    equal: `Both files contain the same canonical fixture event sequence (${leftEvents} events).`,
    'a-prefix': `All ${leftEvents} events in A match the beginning of B. B contains ${rightEvents - leftEvents} additional saved events.`,
    'b-prefix': `All ${rightEvents} events in B match the beginning of A. A contains ${leftEvents - rightEvents} additional saved events.`,
    divergent: `The reviewed plan definitions agree, but the event lists diverge after ${commonEvents} matching events.`
  };
  return messages[history.kind];
}

function eventList(workspace, side) {
  if (!workspace.events.length) return '<p>No events recorded in this file.</p>';
  return `<ol class="events">${workspace.events.map(event => `<li data-event="${side}-${event.seq}"><h4>Event ${event.seq} · ${escape(event.type)}</h4><dl>${
    Object.entries(event).map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('\n')
  }</dl></li>`).join('\n')}</ol>`;
}

export function createScopeComparisonDocument({ left, right, pairs } = {}) {
  if (!left || !right || typeof left.name !== 'string' || typeof right.name !== 'string') {
    throw new Error('Open both saved workspaces before downloading a comparison review.');
  }
  // Re-admit the displayed files through the unchanged native codec/replay.
  // Caller-supplied snapshots, totals or DOM text never establish saved facts.
  const a = readComparisonWorkspace(left.contents);
  const b = readComparisonWorkspace(right.contents);
  const comparison = compareWorkspaces(a, b, pairs);
  const sameDefinitions = comparison.rows.filter(row => row.sameDefinition).length;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Scope comparison review — ScopeSignal</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f1e8;color:#18332f;font:16px/1.55 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:40px 28px}h1{font-size:clamp(2rem,5vw,3.3rem);line-height:1.1;margin:.6rem 0 1.5rem}h2{font-size:1.5rem;margin:2.4rem 0 1rem}h3{font-size:1.15rem}h4{font-size:1rem}h1,h2,h3,h4,p,dt,dd{overflow-wrap:anywhere}.eyebrow{font-size:.75rem;letter-spacing:.1em;font-weight:750}.notice{border:2px solid #18332f;background:#fffefa;padding:20px}.file-grid,.unpaired-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.file-grid h2{font-size:1.1rem;margin:0 0 .7rem}.file-name,dd,td{white-space:pre-wrap;overflow-wrap:anywhere}.file-name{font-weight:650}.card{border:1px solid #c9d5cb;border-radius:8px;padding:20px;background:#fffefa;margin:18px 0}.card h3{margin:0 0 .7rem}.pair-label{font-size:.85rem;color:#52685e}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.9rem;margin:16px 0}caption{text-align:left;font-weight:700;margin-bottom:10px}th,td{vertical-align:top;text-align:left;padding:10px;border-bottom:1px solid #c9d5cb;overflow-wrap:anywhere}th:first-child{width:30%}thead th{background:#e7eee6}.changed th{border-left:3px solid #b24b30}.changed td{background:#fff0e5}.tag{display:block;color:#8b321e;font-size:.7rem;margin-top:4px}dt{font-weight:700;font-size:.82rem;color:#52685e}dd{margin:3px 0 12px;min-height:1.5em}.events{padding-left:24px}.events li{border-top:1px solid #c9d5cb;padding:12px 0}.events h4{margin:0 0 10px}.events dl>div{display:grid;grid-template-columns:minmax(100px,1fr) 3fr;gap:14px}.events dd{margin-top:0}footer{border-top:1px solid #c9d5cb;margin-top:32px;padding-top:18px;font-size:.85rem}@media(max-width:600px){main{padding:24px 14px}.file-grid,.unpaired-grid{grid-template-columns:1fr;gap:0}.card{padding:14px}table{font-size:.8rem}th,td{padding:7px}.events dl>div{display:block}.notice{padding:14px}}@media print{body{background:white;color:#111;font-size:10pt}main{max-width:none;padding:0}h1{font-size:24pt}h2,h3,h4,caption{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}.card,.notice{border-color:#888;border-radius:0}.file-grid,.unpaired-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.file-grid .card{break-inside:avoid}table{font-size:9pt}.events li{break-inside:auto}.events dd{min-width:0}.tag{color:#111}.changed th{border-left-color:#555}@page{margin:16mm}}
</style></head><body><main>
<header><p class="eyebrow">SCOPESIGNAL · PORTABLE COMPARISON</p><h1>Scope comparison review</h1></header>
<aside class="notice"><strong>Fictional saved workspaces · no live payments</strong><p>This unsigned review compares the two displayed files and the chosen checkpoint pairs. It does not establish identity, chronology, authorship, real human approval or payment.</p><p>All saved fields and both complete fixture event lists are included, even when the comparison screen shows only changed fields. Open this file offline and use the browser's Print command to print or save a PDF. Keep the original JSON files to reopen editable workspaces or change the pairing.</p></aside>
<section class="file-grid" aria-label="Compared files">
<article class="card"><h2>File A</h2><p class="file-name" data-file="a">${escape(left.name)}</p><p>${valueText(a.stage, 'stage')} · ${a.rows.length} checkpoints · ${a.events.length} events</p></article>
<article class="card"><h2>File B</h2><p class="file-name" data-file="b">${escape(right.name)}</p><p>${valueText(b.stage, 'stage')} · ${b.rows.length} checkpoints · ${b.events.length} events</p></article>
</section>
<section id="project"><h2>Project and amounts</h2><p>Saved text stays literal. Unavailable values are not zero. Unallocated cap and allocated remaining are separate; pending and unknown captures count nothing.</p>${fieldTable(comparison.project, 'Saved project fields')}${fieldTable(comparison.totals, 'Amounts and recorded fixture totals')}</section>
<section id="pairing"><h2>Chosen checkpoint pairs</h2><p>${comparison.rows.length} pairs · ${sameDefinitions} same definitions · ${comparison.unpairedLeft.length} unpaired in A · ${comparison.unpairedRight.length} unpaired in B</p><p>Pairing is a comparison choice. Same definition means identical saved deliverable, amount text and planned evidence; row numbers and fixture IDs do not prove historical identity.</p>${pairedRows(comparison)}</section>
<section id="unpaired"><h2>Unpaired checkpoints</h2><div class="unpaired-grid"><div>${unpairedRows(comparison.unpairedLeft, 'a')}</div><div>${unpairedRows(comparison.unpairedRight, 'b')}</div></div></section>
<section id="history"><h2>Recorded fixture histories</h2><p data-relationship="${comparison.history.kind}">${historySummary(comparison.history)}</p><p>A shared sequence does not establish chronology or authorship. Sequence and time fields are fictional markers. Raw event amounts are integer cents in their recorded currency: amount 40000 with currency USD means $400.00. Summary and checkpoint amounts above are formatted in dollars.</p>
<section id="history-a"><h3>File A · ${a.events.length} events</h3>${eventList(a, 'a')}</section>
<section id="history-b"><h3>File B · ${b.events.length} events</h3>${eventList(b, 'b')}</section>
</section>
<footer>ScopeSignal · read-only fictional comparison · file names label the supplied files and do not verify their origin · no scripts, external resources or payment controls</footer>
</main></body></html>\n`;
}
