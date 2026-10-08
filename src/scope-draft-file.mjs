import { MAX_CHECKPOINTS } from './scope-plan.mjs';

export const SCOPE_DRAFT_SCHEMA = 'scopesignal.scope-draft';
export const SCOPE_DRAFT_VERSION = 1;
export const SCOPE_DRAFT_FILENAME = 'scopesignal-scope-draft-v1.json';
export const MAX_SCOPE_DRAFT_BYTES = 1024 * 1024;

export class ScopeDraftFileError extends Error {}

function fields(value, names, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new ScopeDraftFileError(`${label} must be an object.`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length || keys.some(key => !names.includes(key))) {
    throw new ScopeDraftFileError(`${label} has missing or unsupported fields.`);
  }
  const result = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new ScopeDraftFileError(`${label} must contain plain values.`);
    }
    result[name] = descriptor.value;
  }
  return result;
}

// Draft files preserve unfinished field values. Amounts, required text and the
// budget are checked only by the existing Review this scope action.
function copyDraft(value) {
  const draft = fields(value, ['label', 'brief', 'cap', 'checkpoints'], 'The draft');
  for (const name of ['label', 'brief', 'cap']) {
    if (typeof draft[name] !== 'string') throw new ScopeDraftFileError(`Draft ${name} must be text.`);
    checkLines(draft[name], name === 'brief', `Draft ${name}`);
  }
  const rows = draft.checkpoints;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > MAX_CHECKPOINTS) {
    throw new ScopeDraftFileError(`A draft must have 1–${MAX_CHECKPOINTS} checkpoints.`);
  }
  if (Reflect.ownKeys(rows).length !== rows.length + 1) {
    throw new ScopeDraftFileError('Draft checkpoints must be a complete list without extra fields.');
  }
  draft.checkpoints = Array.from({ length: rows.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(rows, index);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new ScopeDraftFileError('Draft checkpoints must contain plain values.');
    }
    const row = fields(descriptor.value, ['title', 'amount', 'evidence'], `Checkpoint ${index + 1}`);
    for (const name of ['title', 'amount', 'evidence']) {
      if (typeof row[name] !== 'string') throw new ScopeDraftFileError(`Checkpoint ${index + 1} ${name} must be text.`);
      checkLines(row[name], name === 'evidence', `Checkpoint ${index + 1} ${name}`);
    }
    return row;
  });
  return draft;
}

function checkLines(value, multiline, label) {
  // Native form fields use LF in textareas and no line breaks in text inputs.
  // Refuse incompatible external values instead of silently changing on open.
  if (value.includes('\r') || (!multiline && value.includes('\n'))) {
    throw new ScopeDraftFileError(multiline
      ? `${label} must use LF line breaks, as saved by this page.`
      : `${label} must stay on one line.`);
  }
}

function checkSize(text) {
  if (typeof text !== 'string') throw new ScopeDraftFileError('Choose a UTF-8 JSON draft file.');
  if (new TextEncoder().encode(text).byteLength > MAX_SCOPE_DRAFT_BYTES) {
    throw new ScopeDraftFileError('Draft files must be 1 MiB or smaller.');
  }
}

export function serializeScopeDraft(draft) {
  const text = `${JSON.stringify({
    schema: SCOPE_DRAFT_SCHEMA,
    version: SCOPE_DRAFT_VERSION,
    fixtureOnly: true,
    draft: copyDraft(draft)
  }, null, 2)}\n`;
  checkSize(text);
  return text;
}

export function parseScopeDraftFile(text) {
  checkSize(text);
  let parsed;
  try { parsed = JSON.parse(text.startsWith('\uFEFF') ? text.slice(1) : text); }
  catch { throw new ScopeDraftFileError('That file is not valid JSON. Choose a saved ScopeSignal draft.'); }
  const envelope = fields(parsed, ['schema', 'version', 'fixtureOnly', 'draft'], 'The draft file');
  if (envelope.schema !== SCOPE_DRAFT_SCHEMA || envelope.version !== SCOPE_DRAFT_VERSION || envelope.fixtureOnly !== true) {
    throw new ScopeDraftFileError('Choose a ScopeSignal draft file saved by this page (version 1).');
  }
  return copyDraft(envelope.draft);
}
