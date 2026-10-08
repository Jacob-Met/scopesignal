import { decodeScopeWorkspace, encodeScopeWorkspace } from './scope-workspace-record.mjs';

export const SCOPE_REVISION_FILENAME = 'scopesignal-revision-draft-v1.json';

// Admit the complete current review before deriving a new, unapproved copy.
// Keep the original entered terms, not accepted or pending review evidence.
export function createScopeRevisionDraft(workspace) {
  const current = decodeScopeWorkspace(encodeScopeWorkspace(workspace));
  if (!current.review || current.summary.approved === 0) {
    throw new Error('A revision draft is available after the first checkpoint is approved.');
  }
  return encodeScopeWorkspace({ draft: current.draft });
}
