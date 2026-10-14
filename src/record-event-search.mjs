// Receives the flat scalar fields of an already admitted saved fixture event.
// The record reader continues to own saved-file and ledger admission.
export const MAX_EVENT_QUERY_LENGTH = 256;

export function createSavedEventTextMatcher(query) {
  if (typeof query !== 'string') throw new TypeError('The event search must be text.');
  if (query.length > MAX_EVENT_QUERY_LENGTH) {
    throw new RangeError('Use at most 256 characters in the event search.');
  }
  const needle = query.toLowerCase();
  if (needle === '') return () => true;
  return event => Object.values(event).some(value =>
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      && String(value).toLowerCase().includes(needle));
}
