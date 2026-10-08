import { MAX_WORKSPACE_BYTES, decodeScopeWorkspace } from './scope-workspace-record.mjs';
import { createScopeReviewDocument } from './scope-review-export.mjs';

export const MAX_LIBRARY_FILES = 16;
export const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;

export function validateLibrarySelection(files) {
  if (files.length > MAX_LIBRARY_FILES) throw new Error('Choose at most 16 files. The previous batch is unchanged.');
  let total = 0;
  for (const file of files) {
    if (!Number.isSafeInteger(file?.size) || file.size < 0) throw new Error('A selected file has an unavailable size. The previous batch is unchanged.');
    total += file.size;
  }
  if (total > MAX_LIBRARY_BYTES) throw new Error('Choose at most 8 MiB in total. The previous batch is unchanged.');
}

export async function readLibraryFile(file, index) {
  const row = { index, filename: String(file.name ?? ''), bytes: file.size };
  try {
    if (file.size > MAX_WORKSPACE_BYTES) throw new Error('Choose a workspace JSON file no larger than 1 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size || bytes.byteLength > MAX_WORKSPACE_BYTES) {
      throw new Error('The file size changed or exceeds 1 MiB. Choose the file again.');
    }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('The selected file is not valid UTF-8.'); }
    return { ...row, status: 'admitted', workspace: decodeScopeWorkspace(text) };
  } catch (error) {
    return { ...row, status: 'refused', error: error instanceof Error ? error.message : 'The selected file could not be read.' };
  }
}

export function exportLibraryRow(row) {
  if (row?.status !== 'admitted') throw new Error('Select an admitted workspace first.');
  return {
    filename: 'scopesignal-review-' + String(row.index + 1).padStart(2, '0') + '.html',
    html: createScopeReviewDocument(row.workspace)
  };
}

// New selection/Clear retires older asynchronous work. The last complete batch
// stays usable until its successor is fully read; no authoring state is owned.
export function createScopeLibrary(onChange = () => {}) {
  let generation = 0;
  let state = { rows: [], selected: null, busy: false, message: 'Choose saved workspace JSON files to begin.' };
  const publish = changes => { state = { ...state, ...changes }; onChange(state); return state; };
  return {
    snapshot: () => state,
    async load(input) {
      const files = Array.from(input);
      if (!files.length) return state;
      const ticket = ++generation;
      try { validateLibrarySelection(files); }
      catch (error) { return publish({ busy: false, message: error.message }); }
      publish({ busy: true, message: 'Reading ' + files.length + ' files. The previous batch stays available.' });
      const rows = await Promise.all(files.map(readLibraryFile));
      if (ticket !== generation) return state;
      const admitted = rows.filter(row => row.status === 'admitted').length;
      return publish({ rows, selected: rows.find(row => row.status === 'admitted')?.index ?? null, busy: false,
        message: admitted + ' admitted · ' + (rows.length - admitted) + ' refused. Selection order retained.' });
    },
    select(index) {
      if (!Number.isInteger(index) || !state.rows[index]) return state;
      return publish({ selected: index });
    },
    clear() {
      ++generation;
      return publish({ rows: [], selected: null, busy: false, message: 'Batch cleared. Choose files to begin again.' });
    }
  };
}
