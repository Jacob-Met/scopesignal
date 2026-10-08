import {
  MAX_SCOPE_DRAFT_BYTES, SCOPE_DRAFT_FILENAME, ScopeDraftFileError,
  serializeScopeDraft, parseScopeDraftFile
} from './scope-draft-file.mjs';
import { validateScopeDraft } from './scope-plan.mjs';

export function mountScopeDraftFiles({ readDraft, replaceDraft, isEditing }) {
  const $ = selector => document.querySelector(selector);
  const input = $('#scope-draft-file');
  const status = $('#scope-file-status');
  const preview = $('#scope-file-preview');
  let revision = 0;
  let selection = 0;
  let intent = null;
  let pending = null;
  let savedRevision = null;

  function say(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function clearSelection() {
    selection++;
    intent = null;
    pending = null;
    preview.hidden = true;
    input.value = '';
  }

  function current(request) {
    return request && isEditing() && request.selection === selection
      && request.revision === revision && request.value === JSON.stringify(readDraft());
  }

  function changed() {
    const opening = intent !== null || pending !== null;
    revision++;
    clearSelection();
    if (opening) say('Your draft changed. Open the file again to preview it beside the latest draft.');
    else if (savedRevision !== null && savedRevision !== revision) say('Draft changed. Save again to keep your latest edits.');
  }

  $('#scope-draft-save').addEventListener('click', () => {
    if (!isEditing()) return;
    let url;
    let link;
    try {
      const text = serializeScopeDraft(readDraft());
      url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = SCOPE_DRAFT_FILENAME;
      document.body.append(link);
      link.click();
      savedRevision = revision;
      say('Draft download prepared. Keep the JSON file to reopen it later.');
    } catch (error) {
      say(error instanceof ScopeDraftFileError ? error.message : 'The draft could not be downloaded. Your edits are still here.', true);
    } finally {
      link?.remove();
      // Give the browser its own turn to consume the download URL.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  $('#scope-draft-open').addEventListener('click', () => {
    if (!isEditing()) return;
    clearSelection();
    intent = { selection, revision, value: JSON.stringify(readDraft()) };
    say('Choose a saved draft. Your current plan stays in place until you replace it.');
    input.click();
  });

  input.addEventListener('cancel', () => {
    if (!intent) return;
    clearSelection();
    say('Open canceled. Your current draft is unchanged.');
  });

  input.addEventListener('change', async () => {
    const chosen = intent;
    const file = input.files?.[0];
    if (!file || !current(chosen)) return;
    const request = { ...chosen, selection: ++selection };
    intent = request;
    say(`Reading ${file.name}…`);
    try {
      if (file.size > MAX_SCOPE_DRAFT_BYTES) throw new ScopeDraftFileError('Draft files must be 1 MiB or smaller.');
      const bytes = await file.arrayBuffer();
      if (!current(request)) return;
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new ScopeDraftFileError('Choose a UTF-8 JSON draft file. This file could not be decoded.'); }
      const next = parseScopeDraftFile(text);
      if (!current(request)) return;
      pending = { request, draft: next };
      $('#scope-file-name').textContent = file.name;
      $('#scope-file-label').textContent = next.label.trim() || 'Untitled draft';
      $('#scope-file-summary').textContent = `${next.checkpoints.length} ${next.checkpoints.length === 1 ? 'checkpoint' : 'checkpoints'} · ${validateScopeDraft(next).ok ? 'Ready for review' : 'Unfinished draft — keep editing after opening'}`;
      $('#scope-file-brief').textContent = next.brief || 'No brief entered yet.';
      $('#scope-file-cap').textContent = `Project cap (USD): ${next.cap || 'Not entered yet'}`;
      const rows = $('#scope-file-checkpoints');
      rows.replaceChildren();
      for (const checkpoint of next.checkpoints) {
        const row = document.createElement('li');
        row.textContent = `${checkpoint.title || 'Untitled checkpoint'}\nAmount (USD): ${checkpoint.amount || 'Not entered yet'}\nPlanned evidence: ${checkpoint.evidence || 'Not entered yet'}`;
        rows.append(row);
      }
      $('#scope-file-details').open = false;
      preview.hidden = false;
      say('Preview ready. Replace the current draft or cancel to keep it.');
      $('#scope-file-preview-title').focus();
    } catch (error) {
      if (!current(request)) return;
      pending = null;
      preview.hidden = true;
      intent = null;
      say(error instanceof ScopeDraftFileError ? error.message : 'The file could not be read. Your current draft is unchanged.', true);
      $('#scope-draft-open').focus();
    }
  });

  $('#scope-file-cancel').addEventListener('click', () => {
    clearSelection();
    say('Open canceled. Your current draft is unchanged.');
    $('#scope-draft-open').focus();
  });

  $('#scope-file-replace').addEventListener('click', () => {
    if (!pending || !current(pending.request)) {
      clearSelection();
      say('Your draft changed. Open the file again before replacing it.', true);
      return;
    }
    const next = pending.draft;
    clearSelection();
    revision++;
    savedRevision = null;
    replaceDraft(next);
    say('Draft opened. Review it when ready; every checkpoint still needs its own approval.');
  });

  return Object.freeze({
    changed,
    leave() { revision++; clearSelection(); say(''); }
  });
}
