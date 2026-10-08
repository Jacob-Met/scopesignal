import { MAX_CHECKPOINTS } from './scope-plan.mjs';
import { decodeScopeWorkspace } from './scope-workspace-record.mjs';

// Admission remains the existing workspace codec's responsibility. Only the
// original definition strings cross from that private admission into the editor.
export function readCheckpointSource(contents) {
  const admitted = decodeScopeWorkspace(contents);
  return Object.freeze({
    label: admitted.draft.label,
    stage: admitted.summary.stage,
    checkpoints: Object.freeze(admitted.draft.checkpoints.map(({ title, amount, evidence }) =>
      Object.freeze({ title, amount, evidence })))
  });
}

export function selectCheckpointDefinitions(source, selections, existingCount) {
  if (!Number.isInteger(existingCount) || existingCount < 1 || existingCount > MAX_CHECKPOINTS) {
    throw new Error('The current draft must contain 1–12 checkpoints.');
  }
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('Choose at least one checkpoint to add.');
  }
  const selected = new Set();
  for (const index of selections) {
    if (!Number.isInteger(index) || index < 0 || index >= source.checkpoints.length || selected.has(index)) {
      throw new Error('Choose each saved checkpoint at most once.');
    }
    selected.add(index);
  }
  if (existingCount + selected.size > MAX_CHECKPOINTS) {
    throw new Error('The draft can contain at most 12 checkpoints. Choose fewer saved checkpoints.');
  }
  // Source order remains authoritative even when boxes are selected out of order.
  // Equal definitions at different positions are intentionally separate choices.
  return source.checkpoints.filter((_, index) => selected.has(index))
    .map(({ title, amount, evidence }) => ({ title, amount, evidence }));
}
