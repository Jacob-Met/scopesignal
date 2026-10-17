import { createSavedEventTextMatcher, MAX_EVENT_QUERY_LENGTH } from './record-event-search.mjs';

// Only receives an already admitted record and its existing ordered event rows.
// Filtering changes row visibility; it never rebuilds disclosures or reduces history.
export function createRecordEventFilter(record, list, labels) {
  const node = (tag, text) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const panel = node('div');
  panel.className = 'record-event-filter';
  const controls = node('div');
  controls.className = 'record-event-filter-controls';
  const select = (id, caption, all, choices) => {
    const label = node('label', caption);
    const field = node('select');
    field.id = id;
    label.htmlFor = id;
    for (const [value, text] of [['', all], ...choices]) {
      const option = node('option', text);
      option.value = value;
      field.append(option);
    }
    field.disabled = record.events.length === 0;
    label.append(field);
    controls.append(label);
    return field;
  };
  const checkpoint = select('record-event-checkpoint', 'Checkpoint', 'All checkpoints',
    record.checkpoints.map(item => [item.id, item.title]));
  const present = new Set(record.events.map(event => event.type));
  const type = select('record-event-type', 'Event type', 'All event types',
    Object.entries(labels).filter(([value]) => present.has(value)));
  const searchLabel = node('label', 'Search saved event values');
  const query = node('input');
  query.type = 'search';
  query.id = 'record-event-query';
  query.maxLength = MAX_EVENT_QUERY_LENGTH;
  query.autocomplete = 'off';
  query.spellcheck = false;
  query.placeholder = 'Evidence phrase or identifier';
  query.disabled = record.events.length === 0;
  query.setAttribute('aria-describedby', 'record-event-search-help record-event-search-error');
  searchLabel.htmlFor = query.id;
  searchLabel.append(query);
  controls.append(searchLabel);
  const reset = node('button', 'Show all events');
  reset.type = 'button';
  controls.append(reset);
  const expand = node('button', 'Expand shown events');
  expand.id = 'record-events-expand-shown';
  expand.type = 'button';
  const collapse = node('button', 'Collapse shown events');
  collapse.id = 'record-events-collapse-shown';
  collapse.type = 'button';
  controls.append(expand, collapse);
  const disclosureStatus = node('p');
  disclosureStatus.id = 'record-event-disclosure-status';
  disclosureStatus.setAttribute('role', 'status');
  disclosureStatus.setAttribute('aria-live', 'polite');
  disclosureStatus.setAttribute('aria-atomic', 'true');
  const count = node('p');
  count.id = 'record-event-count';
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const help = node('p', 'Filters change only this list. Totals and checkpoint outcomes above describe the full record. Original sequence numbers and saved fields are retained.');
  const searchHelp = node('p', 'Search matches literal saved values, ignoring case. Spaces and accents are not normalized; field names and display labels are not searched. Downloads still include the full record.');
  searchHelp.id = 'record-event-search-help';
  const searchError = node('p');
  searchError.id = 'record-event-search-error';
  searchError.className = 'record-event-search-error';
  searchError.setAttribute('role', 'alert');
  searchError.hidden = true;
  const empty = node('p', 'No recorded events match these filters. Change a filter or show all events.');
  empty.className = 'record-event-empty';
  const rows = [...list.children];
  const disclosures = rows.map(row => row.children[0]);
  const setShownExpanded = (open, button) => {
    if (button.disabled) return;
    let shown = 0;
    rows.forEach((row, index) => {
      if (row.hidden) return;
      disclosures[index].open = open;
      shown += 1;
    });
    if (shown) disclosureStatus.textContent = (open ? 'Expanded ' : 'Collapsed ')
      + shown + ' shown event' + (shown === 1 ? '' : 's') + '.';
  };
  expand.addEventListener('click', () => setShownExpanded(true, expand));
  collapse.addEventListener('click', () => setShownExpanded(false, collapse));
  const update = () => {
    let matchesText;
    try {
      matchesText = createSavedEventTextMatcher(query.value);
    } catch (failure) {
      searchError.textContent = failure.message + ' The last applied event view is unchanged.';
      searchError.hidden = false;
      query.setAttribute('aria-invalid', 'true');
      reset.disabled = false;
      return;
    }
    disclosureStatus.textContent = '';
    searchError.textContent = '';
    searchError.hidden = true;
    query.removeAttribute('aria-invalid');
    let shown = 0;
    record.events.forEach((event, index) => {
      const matches = (!checkpoint.value || event.checkpointId === checkpoint.value)
        && (!type.value || event.type === type.value) && matchesText(event);
      rows[index].hidden = !matches;
      if (matches) shown += 1;
    });
    count.textContent = 'Showing ' + shown + ' of ' + record.events.length + ' recorded events. '
      + checkpoint.selectedOptions[0].textContent + ' · ' + type.selectedOptions[0].textContent
      + (query.value ? ' · Search: “' + query.value + '”' : '') + '.';
    reset.disabled = !checkpoint.value && !type.value && !query.value;
    expand.disabled = collapse.disabled = shown === 0;
    empty.hidden = shown > 0 || record.events.length === 0;
    list.hidden = shown === 0;
  };
  checkpoint.addEventListener('change', update);
  type.addEventListener('change', update);
  query.addEventListener('input', update);
  reset.addEventListener('click', () => {
    checkpoint.value = '';
    type.value = '';
    query.value = '';
    update();
    checkpoint.focus();
  });
  panel.append(controls, count, help, searchHelp, searchError, empty, disclosureStatus);
  update();
  return panel;
}
