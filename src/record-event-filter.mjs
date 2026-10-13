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
  const reset = node('button', 'Show all events');
  reset.type = 'button';
  controls.append(reset);
  const count = node('p');
  count.id = 'record-event-count';
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const help = node('p', 'Filters change only this list. Totals and checkpoint outcomes above describe the full record. Original sequence numbers and saved fields are retained.');
  const empty = node('p', 'No recorded events match both filters. Choose another filter or show all events.');
  empty.className = 'record-event-empty';
  const rows = [...list.children];
  const update = () => {
    let shown = 0;
    record.events.forEach((event, index) => {
      const matches = (!checkpoint.value || event.checkpointId === checkpoint.value)
        && (!type.value || event.type === type.value);
      rows[index].hidden = !matches;
      if (matches) shown += 1;
    });
    count.textContent = 'Showing ' + shown + ' of ' + record.events.length + ' recorded events. '
      + checkpoint.selectedOptions[0].textContent + ' · ' + type.selectedOptions[0].textContent + '.';
    reset.disabled = !checkpoint.value && !type.value;
    empty.hidden = shown > 0 || record.events.length === 0;
    list.hidden = shown === 0;
  };
  checkpoint.addEventListener('change', update);
  type.addEventListener('change', update);
  reset.addEventListener('click', () => {
    checkpoint.value = '';
    type.value = '';
    update();
    checkpoint.focus();
  });
  panel.append(controls, count, help, empty);
  update();
  return panel;
}
