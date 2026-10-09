import { parseDollars, dollars, draftBudget, validateScopeDraft } from './scope-plan.mjs';
import { decodeScopeWorkspace, encodeScopeWorkspace, MAX_WORKSPACE_BYTES } from './scope-workspace-record.mjs';

export const COMBINE_FILENAME = 'scopesignal-combined-draft-v1.json';

function describeValidation(draft) {
  const { ok, errors } = validateScopeDraft(draft);
  return { ok, errors };
}

// Reject review files before the native decoder's private history replay.
// Draft admission itself remains entirely the existing workspace codec's job.
export function readCombineWorkspace(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_WORKSPACE_BYTES) {
    throw new Error('Choose a UTF-8 workspace JSON file no larger than 1 MiB.');
  }
  let contents;
  try { contents = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('The selected workspace must contain valid UTF-8 text.'); }
  let envelope;
  try { envelope = JSON.parse(contents); }
  catch { throw new Error('The selected file is not valid workspace JSON.'); }
  if (envelope?.stage === 'review') {
    throw new Error('Combine planned checkpoints accepts editable draft files only. Use an explicitly created revision draft for reviewed work.');
  }
  const restored = decodeScopeWorkspace(contents);
  if (restored.summary.stage !== 'draft' || restored.review !== null
    || restored.summary.events !== 0 || restored.evidenceDrafts.size !== 0) {
    throw new Error('An editable draft without review history is required.');
  }
  return {
    draft: restored.draft,
    budget: draftBudget(restored.draft),
    validation: describeValidation(restored.draft)
  };
}

export function prepareCheckpointCombine(bytes, selection, replacement) {
  const source = readCombineWorkspace(bytes);
  if (!Array.isArray(selection) || selection.length !== 2
    || Array.from(selection).some(index => !Number.isInteger(index)
      || index < 0 || index >= source.draft.checkpoints.length)
    || selection[0] === selection[1]) {
    throw new Error('Choose exactly two distinct checkpoint positions.');
  }
  if (!replacement || typeof replacement !== 'object' || Array.isArray(replacement)
    || Object.keys(replacement).length !== 2
    || !Object.hasOwn(replacement, 'title') || !Object.hasOwn(replacement, 'evidence')) {
    throw new Error('Enter an explicit replacement deliverable and planned evidence.');
  }

  const selected = selection.toSorted((a, b) => a - b);
  const selectedCents = selected.map(index => parseDollars(source.draft.checkpoints[index].amount));
  if (selectedCents.some(amount => amount === null)) {
    throw new Error('Each selected checkpoint must have a positive native USD amount with no more than two decimal places.');
  }
  const combinedCents = selectedCents[0] + selectedCents[1];
  if (!Number.isSafeInteger(combinedCents)) {
    throw new Error('The combined checkpoint amount is too large for safe integer cents.');
  }

  const draft = structuredClone(source.draft);
  const row = { title: replacement.title, amount: dollars(combinedCents), evidence: replacement.evidence };
  draft.checkpoints[selected[0]] = row;
  draft.checkpoints.splice(selected[1], 1);
  const validation = describeValidation(draft);
  const textFields = new Set([`checkpoints.${selected[0]}.title`, `checkpoints.${selected[0]}.evidence`]);
  const textErrors = validation.errors.filter(error => textFields.has(error.field));
  if (textErrors.length) throw new Error(textErrors.map(error => error.message).join(' '));

  // Encoding preserves the exact draft strings and applies native field/line
  // admission. Do not replace this draft with the review validator's trimmed seed.
  const contents = encodeScopeWorkspace({ draft });
  return {
    source, selected, selectedCents, combinedCents,
    draft, budget: draftBudget(draft), validation, contents,
    record: JSON.parse(contents)
  };
}
