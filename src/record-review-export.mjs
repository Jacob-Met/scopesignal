import { readFixtureRecord } from './record-reader.mjs';

export const RECORD_REVIEW_FILENAME = 'scopesignal-record-review.html';

// Values are text, never markup. A character reference preserves CR while
// literal C1 characters avoid HTML's Windows-1252 numeric-reference mapping.
function escape(value) {
  const text = String(value);
  if (text.includes('\0') || !text.isWellFormed()) {
    throw new Error('Some text cannot be preserved in HTML. Keep the original JSON and correct that text before downloading a review.');
  }
  return text.replace(/[&<>"'\r]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;'
  })[character]);
}

const field = (label, value, path) => '<div class="field"><dt>' + escape(label)
  + '</dt><dd data-field="' + escape(path) + '">' + escape(value) + '</dd></div>';
const facts = (object, prefix, cents = []) => Object.entries(object).map(([key, value]) =>
  field(key + (cents.includes(key) ? ' (USD integer cents)' : ''), value, prefix + '.' + key)).join('\n');

export function createRecordReviewDocument(record, filename) {
  if (typeof filename !== 'string') throw new Error('The opened record needs a text file label.');
  // The existing reader/reducer owns format, lifecycle and redundant totals.
  // Do not infer acceptance or amounts from displayed text or pending reads.
  const admitted = readFixtureRecord(JSON.stringify(record));
  const checkpoints = admitted.checkpoints.map((checkpoint, index) => {
    const path = 'checkpoints.' + index;
    return '<article><h3>Checkpoint ' + (index + 1) + ' · ' + escape(checkpoint.title) + '</h3><dl>'
      + field('id', checkpoint.id, path + '.id')
      + field('title', checkpoint.title, path + '.title')
      + field('amount (USD integer cents)', checkpoint.amount, path + '.amount')
      + '</dl><h4>Recorded approval</h4><dl>'
      + (checkpoint.approval === null
        ? field('approval — none recorded', null, path + '.approval')
        : facts(checkpoint.approval, path + '.approval'))
      + '</dl><h4>Recorded capture</h4><dl>'
      + facts(checkpoint.capture, path + '.capture', ['counted']) + '</dl></article>';
  }).join('\n');
  const events = admitted.events.length
    ? '<ol class="events">' + admitted.events.map((event, index) => '<li><article><h3>Event '
      + event.seq + ' · ' + escape(event.type) + '</h3><dl>'
      + facts(event, 'events.' + index, ['amount']) + '</dl></article></li>').join('\n') + '</ol>'
    : '<p>No fixture events are recorded.</p>';
  const metadata = Object.fromEntries(Object.entries(admitted).filter(([key]) =>
    !['fixture', 'summary', 'checkpoints', 'events'].includes(key)));
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>Saved fixture record review — ScopeSignal</title>\n<style>\n'
    + ':root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f4f1e8;color:#182923;font:16px/1.6 system-ui,sans-serif}'
    + 'main{max-width:980px;margin:auto;padding:36px 24px}h1{font-size:clamp(26px,5vw,40px);line-height:1.2}'
    + 'h2{margin-top:38px}h3{margin-top:0}h4{margin-bottom:8px}h1,h2,h3,h4,p,dt,dd{overflow-wrap:anywhere}'
    + '.notice{padding:16px;border:2px solid #57694e;background:#e6eddf}.filename,dd{white-space:pre-wrap;overflow-wrap:anywhere}'
    + 'article{background:white;border:1px solid #b5c0b0;padding:22px;margin:18px 0}dl{margin:0}'
    + '.field{display:grid;grid-template-columns:minmax(150px,1fr) minmax(0,3fr);gap:12px;padding:8px 0;border-bottom:1px solid #e4e8e0}'
    + 'dt{font-weight:600}dd{margin:0;min-width:0}.events{padding-left:26px}footer{margin-top:36px;border-top:1px solid #b5c0b0;padding-top:18px}'
    + '@media(max-width:560px){main{padding:24px 16px}article{padding:16px}.field{grid-template-columns:1fr;gap:4px}}'
    + '@media print{body{background:white;color:black}main{max-width:none;padding:0}article{border-color:#999;break-inside:auto}h2,h3,h4{break-after:avoid}.notice{background:white}footer{font-size:10pt}}'
    + '\n</style>\n</head>\n<body><main><header><p>ScopeSignal · saved fixture record review</p>'
    + '<h1>' + escape(admitted.fixture.label) + '</h1>'
    + '<p>Opened file label:</p><p class="filename" data-field="filename">' + escape(filename) + '</p>'
    + '<p class="notice">Synthetic fixture · Not payment evidence. This unsigned review does not establish identity, human action or a real transaction.</p>'
    + '<p>Keep the original JSON to reopen the interactive viewer. This document contains the complete opened record; it does not apply current view filters. T+ values are sequence markers, not clock times. Amounts below are USD integer cents, not dollars.</p>'
    + '</header><section><h2>Record metadata</h2><dl>' + facts(metadata, 'record')
    + '</dl></section><section><h2>Fixture definition</h2><dl>' + facts(admitted.fixture, 'fixture', ['amount'])
    + '</dl></section><section><h2>Recorded totals</h2><dl>' + facts(admitted.summary, 'summary', ['total', 'captured', 'remaining'])
    + '</dl><p>Pending and unknown captures remain uncounted. Duplicate receipts remain in the history without counting the same capture again.</p>'
    + '</section><section><h2>Checkpoint evidence and outcomes</h2>' + checkpoints
    + '</section><section><h2>Complete recorded event history</h2><p>' + admitted.events.length + ' events, in saved order.</p>'
    + events + '</section><footer>Offline review only · No payment controls, scripts or external assets. File labels do not establish authorship or chronology.</footer></main></body>\n</html>\n';
}
