import { MAX_CHECKPOINTS, createScopeReview } from './scope-plan.mjs';

export const WORKSPACE_SCHEMA = 'scopesignal.scope-workspace';
export const WORKSPACE_VERSION = 1;
export const WORKSPACE_FILENAME = 'scopesignal-workspace-v1.json';
export const MAX_WORKSPACE_BYTES = 1024 * 1024;
export const MAX_WORKSPACE_EVENTS = 96;

function exactObject(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== fields.length
    || fields.some(field => !Object.hasOwn(value, field))) {
    throw new Error(label + ' has missing, extra, or unsupported fields.');
  }
}

function text(value, maximum, label, multiline = false) {
  if (typeof value !== 'string' || value.length > maximum) {
    throw new Error(label + ' must be text of at most ' + maximum + ' characters.');
  }
  // Native textareas use LF; text inputs strip line breaks on assignment.
  // Admit only values the editor can preserve rather than rewriting a file.
  if (value.includes('\r') || (!multiline && value.includes('\n'))) {
    throw new Error(label + (multiline
      ? ' must use LF line breaks, as saved by this workspace.'
      : ' must stay on one line.'));
  }
  return value;
}

// Draft admission deliberately allows unfinished fields. Ordinary review
// validation still decides whether the restored draft can become a plan.
function copyDraft(value) {
  exactObject(value, ['label', 'brief', 'cap', 'checkpoints'], 'Saved draft');
  if (!Array.isArray(value.checkpoints) || value.checkpoints.length < 1
    || value.checkpoints.length > MAX_CHECKPOINTS) {
    throw new Error('A saved draft must contain 1–12 checkpoints.');
  }
  return {
    label: text(value.label, 120, 'Project name'),
    brief: text(value.brief, 8000, 'Creative brief', true),
    cap: text(value.cap, 64, 'Project cap'),
    checkpoints: Array.from(value.checkpoints, (row, index) => {
      const label = 'Checkpoint ' + (index + 1);
      exactObject(row, ['title', 'amount', 'evidence'], label);
      return {
        title: text(row.title, 160, label + ' deliverable'),
        amount: text(row.amount, 64, label + ' amount'),
        evidence: text(row.evidence, 5000, label + ' planned evidence', true)
      };
    })
  };
}

const actions = Object.freeze({
  'checkpoint.revision_requested': 'request_revision',
  'checkpoint.approved': 'approve',
  'paypal.order.created': 'order',
  'paypal.capture.requested': 'request',
  'paypal.capture.response_lost': 'lose',
  'paypal.capture.reconciled': 'reconcile'
});

function sameEvent(saved, generated) {
  const fields = Object.keys(generated);
  return saved && typeof saved === 'object' && !Array.isArray(saved)
    && Object.keys(saved).length === fields.length
    && fields.every(field => Object.hasOwn(saved, field)
      && Object.is(saved[field], generated[field]));
}

function restoreReview(draft, events) {
  const review = createScopeReview(draft);
  for (const [index, event] of events.entries()) {
    let action;
    if (event && typeof event === 'object' && !Array.isArray(event)) {
      action = Object.hasOwn(actions, event.type) ? actions[event.type] : undefined;
      if (event.type === 'paypal.webhook.received') {
        action = event.duplicate === true ? 'duplicate' : 'receipt';
      }
    }
    if (!action) throw new Error('Saved event ' + (index + 1) + ' is unsupported.');
    // Replay only the existing explicit authoring controls into a private
    // fixture. The current workspace is never involved in file admission.
    const payload = action === 'request_revision'
      ? { reason: event.reason, reviewedEvidence: event.reviewedEvidence }
      : event.acceptedEvidence;
    const state = review.act(event.checkpointId, action, payload);
    if (!sameEvent(event, state.events.at(-1))) {
      throw new Error('Saved event ' + (index + 1) + ' does not match its fixture history.');
    }
  }
  return review;
}

export function decodeScopeWorkspace(contents) {
  if (typeof contents !== 'string' || contents.length > MAX_WORKSPACE_BYTES
    || new TextEncoder().encode(contents).byteLength > MAX_WORKSPACE_BYTES) {
    throw new Error('Choose a UTF-8 workspace JSON file no larger than 1 MiB.');
  }
  let record;
  try { record = JSON.parse(contents); }
  catch { throw new Error('The selected file is not valid workspace JSON.'); }
  exactObject(record, ['schema', 'version', 'fixtureOnly', 'paymentEvidence',
    'stage', 'draft', 'events', 'evidenceDrafts'], 'Workspace file');
  if (record.schema !== WORKSPACE_SCHEMA || record.version !== WORKSPACE_VERSION
    || record.fixtureOnly !== true || record.paymentEvidence !== false
    || !['draft', 'review'].includes(record.stage)) {
    throw new Error('This file is not a supported version 1 fictional workspace.');
  }
  const draft = copyDraft(record.draft);
  if (!Array.isArray(record.events) || record.events.length > MAX_WORKSPACE_EVENTS) {
    throw new Error('The saved fixture history is missing or too large.');
  }
  if (!Array.isArray(record.evidenceDrafts) || record.evidenceDrafts.length > MAX_CHECKPOINTS) {
    throw new Error('The saved evidence drafts are missing or too large.');
  }
  if (record.stage === 'draft' && (record.events.length || record.evidenceDrafts.length)) {
    throw new Error('An editable draft cannot contain approval events or review evidence.');
  }
  const review = record.stage === 'review' ? restoreReview(draft, record.events) : null;
  const state = review?.snapshot();
  const evidenceDrafts = new Map();
  for (const entry of record.evidenceDrafts) {
    exactObject(entry, ['checkpointId', 'text'], 'Saved evidence draft');
    const checkpoint = state?.checkpoints.find(cp => cp.id === entry.checkpointId);
    if (!checkpoint || checkpoint.approved || evidenceDrafts.has(entry.checkpointId)) {
      throw new Error('Saved evidence must belong to a distinct unapproved checkpoint.');
    }
    evidenceDrafts.set(entry.checkpointId, text(entry.text, 5000, 'Pending evidence', true));
  }
  return {
    draft, review, evidenceDrafts,
    summary: {
      label: state?.plan.label ?? draft.label,
      stage: record.stage,
      checkpoints: draft.checkpoints.length,
      approved: state?.approved ?? 0,
      events: record.events.length
    }
  };
}

export function encodeScopeWorkspace({ draft, review = null, evidenceDrafts = new Map() }) {
  const snapshot = review?.snapshot();
  if (!(evidenceDrafts instanceof Map)) throw new Error('Evidence drafts are unavailable.');
  const pending = [];
  if (snapshot) {
    for (const [checkpointId, value] of evidenceDrafts) {
      const checkpoint = snapshot.checkpoints.find(cp => cp.id === checkpointId);
      if (!checkpoint) throw new Error('An evidence draft has an unknown checkpoint.');
      // An approval's accepted text comes only from its recorded event. A
      // formerly pending editor value must never replace that accepted text.
      if (!checkpoint.approved) pending.push({ checkpointId, text: value });
    }
  }
  const record = {
    schema: WORKSPACE_SCHEMA, version: WORKSPACE_VERSION,
    fixtureOnly: true, paymentEvidence: false,
    stage: snapshot ? 'review' : 'draft',
    draft: copyDraft(draft),
    events: snapshot ? structuredClone(snapshot.events) : [],
    evidenceDrafts: pending
  };
  const contents = JSON.stringify(record, null, 2) + '\n';
  const restored = decodeScopeWorkspace(contents);
  if (snapshot && JSON.stringify(restored.review.snapshot()) !== JSON.stringify(snapshot)) {
    throw new Error('The workspace plan and recorded review do not match.');
  }
  return contents;
}
