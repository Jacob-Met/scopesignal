import { createScopeHistory } from './scope-history.mjs';
import { formatUSD } from './scope-plan.mjs';

export function mountScopeHistory(root) {
  if (!root) return Object.freeze({ clear() {}, update() {} });
  const find = id => root.querySelector('#scope-history-' + id);
  const controls = {
    previous: find('previous'), next: find('next'), select: find('event'),
    latest: find('latest'), status: find('status'), display: find('display')
  };
  let history = null;
  let position = 0;

  function node(tag, text, className) {
    const element = root.ownerDocument.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function reset() {
    history = null;
    position = 0;
    controls.select.replaceChildren();
    for (const element of [controls.previous, controls.next, controls.select, controls.latest]) element.disabled = true;
    controls.display.hidden = true;
    controls.status.textContent = '';
    find('checkpoints').replaceChildren();
    for (const id of ['source','current','position','title','description','approved','captured','remaining','unallocated','event-json']) find(id).textContent = '';
  }

  function clear() {
    reset();
    root.hidden = true;
    root.open = false;
  }

  function render(index) {
    // Resolve the requested state before moving the visible cursor.
    const step = history.step(index);
    find('position').textContent = index === 0 ? 'Before the first event' : 'After event ' + index + ' of ' + history.eventCount;
    find('title').textContent = step.label;
    find('description').textContent = step.description;
    find('approved').textContent = step.snapshot.approved + ' / ' + history.checkpointCount;
    find('captured').textContent = formatUSD(step.snapshot.captured);
    find('remaining').textContent = formatUSD(step.snapshot.remaining);
    find('unallocated').textContent = formatUSD(step.unallocated);
    find('event-json').textContent = step.event ? JSON.stringify(step.event, null, 2) : 'No event has been recorded at this point.';
    const cards = step.checkpoints.map((checkpoint, index) => {
      const card = node('article', undefined, 'scope-history-checkpoint');
      card.dataset.historyCheckpoint = checkpoint.id;
      card.dataset.captureState = checkpoint.capture.state;
      card.dataset.active = String(checkpoint.id === step.event?.checkpointId);
      const heading = node('h4', 'Checkpoint ' + (index + 1) + ' · ' + checkpoint.title);
      card.append(heading, node('p', formatUSD(checkpoint.amount) + ' · ' + checkpoint.capture.title, 'scope-history-state'));
      const evidence = node('dl');
      evidence.append(node('dt','Planned acceptance evidence'),node('dd',checkpoint.evidence));
      evidence.append(node('dt','Accepted evidence at this point'),
        node('dd',checkpoint.approved ? checkpoint.acceptedEvidence : 'Not approved at this point.',
          checkpoint.approved ? 'scope-history-accepted' : 'scope-history-unapproved'));
      card.append(evidence);
      return card;
    });
    find('checkpoints').replaceChildren(...cards);
    controls.previous.disabled = index === 0;
    controls.next.disabled = index === history.eventCount;
    controls.latest.disabled = index === history.eventCount;
    controls.select.value = String(index);
    controls.display.hidden = false;
    controls.status.textContent = (index === history.eventCount ? 'Latest recorded point. ' : 'Historical point. ')
      + find('position').textContent + '. ' + step.label + '. Simulated captured: '
      + formatUSD(step.snapshot.captured) + '. Your workspace is unchanged.';
    position = index;
  }

  controls.previous.addEventListener('click', () => { if (history && position > 0) render(position - 1); });
  controls.next.addEventListener('click', () => { if (history && position < history.eventCount) render(position + 1); });
  controls.latest.addEventListener('click', () => { if (history) render(history.eventCount); });
  controls.select.addEventListener('change', () => {
    const value = controls.select.value;
    const index = Number(value);
    if (!history || !/^(0|[1-9]\d*)$/.test(value) || !Number.isInteger(index) || index > history.eventCount) {
      controls.select.value = String(position);
      return;
    }
    render(index);
  });

  clear();
  return Object.freeze({
    clear,
    update(readWorkspace) {
      try {
        // Capture once at the native review render boundary. Navigation never
        // rereads or calls methods on the active review.
        const next = createScopeHistory(readWorkspace());
        history = next;
        controls.select.replaceChildren(...next.steps.map(step => {
          const option = node('option', step.index + ' · ' + step.label
            + (step.checkpoint ? ' · Checkpoint ' + step.checkpoint + ': ' + step.checkpointTitle : ''));
          option.value = String(step.index);
          return option;
        }));
        const current = next.step(next.eventCount);
        find('source').textContent = next.label;
        find('current').textContent = 'Your current workspace has ' + next.eventCount + ' recorded events and '
          + formatUSD(current.snapshot.captured) + ' simulated captured. New recorded decisions refresh this panel to the latest point.';
        root.hidden = false;
        controls.select.disabled = false;
        render(next.eventCount);
      } catch (error) {
        reset();
        root.hidden = false;
        root.open = true;
        controls.status.textContent = 'This history is unavailable. ' + error.message
          + ' Your workspace remains available above.';
      }
    }
  });
}
