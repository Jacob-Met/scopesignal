import { MAX_CHECKPOINTS } from './scope-plan.mjs';

// Recovery belongs to one unchanged draft row order. The controller clears it
// on other structural actions, successful review and workspace replacement.
export function createDraftRemovalRecovery() {
  let pending = null;
  const validRows = rows => Array.isArray(rows)
    && rows.length >= 1 && rows.length <= MAX_CHECKPOINTS
    && rows.every(row => row && ['title', 'amount', 'evidence'].every(key => typeof row[key] === 'string'));
  const copyRows = rows => rows.map(row => ({ ...row }));

  return {
    get available() { return pending !== null; },
    clear() { pending = null; },

    remove(rows, index) {
      if (!validRows(rows) || rows.length < 2 || !Number.isInteger(index)
        || index < 0 || index >= rows.length) return null;
      const checkpoints = copyRows(rows);
      const [removed] = checkpoints.splice(index, 1);
      pending = { index, checkpoint: { ...removed }, remaining: checkpoints.length };
      return { checkpoints, index };
    },

    restore(rows) {
      if (!pending || !validRows(rows) || rows.length !== pending.remaining
        || rows.length >= MAX_CHECKPOINTS) return null;
      const { index, checkpoint } = pending;
      const checkpoints = copyRows(rows);
      checkpoints.splice(index, 0, { ...checkpoint });
      pending = null;
      return { checkpoints, index };
    }
  };
}
