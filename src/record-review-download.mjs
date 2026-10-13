import { createRecordReviewDocument, RECORD_REVIEW_FILENAME } from './record-review-export.mjs';

// Each control belongs to exactly one admitted rendered record. Opening or
// clearing a record removes it with that record; pending reads cannot retarget it.
export function createRecordReviewDownload(record, filename) {
  const group = document.createElement('div');
  group.className = 'record-review-download';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Download record review';
  const status = document.createElement('p');
  status.className = 'record-review-download-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  group.append(button, status);
  button.addEventListener('click', () => {
    let url;
    let link;
    status.textContent = '';
    try {
      const html = createRecordReviewDocument(record, filename);
      url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = RECORD_REVIEW_FILENAME;
      link.hidden = true;
      document.body.append(link);
      link.click();
      status.textContent = 'Record review download prepared. Keep the original JSON to reopen the interactive viewer.';
    } catch (failure) {
      status.textContent = 'The record review could not be prepared. Your opened record and original JSON are unchanged. '
        + (failure instanceof Error ? failure.message : 'Try again.');
    } finally {
      link?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  });
  return group;
}
