import { createFixtureTimeline } from './fixture-timeline.mjs';

const root = document.getElementById('fixture-timeline');

if (root) {
  const find = id => root.querySelector('#' + id);
  const status = find('timeline-status');
  const previous = find('timeline-previous');
  const next = find('timeline-next');
  const select = find('timeline-event');
  const display = find('timeline-display');

  try {
    const timeline = createFixtureTimeline();
    const money = cents => new Intl.NumberFormat('en-US', {
      style: 'currency', currency: timeline.step(0).currency,
    }).format(cents / 100);
    let position = 0;

    select.replaceChildren(...timeline.steps.map(step => {
      const option = document.createElement('option');
      option.value = String(step.index);
      option.textContent = String(step.index).padStart(2, '0') + ' · ' + step.label;
      return option;
    }));

    function render(index) {
      // Resolve the requested prefix before changing the visible cursor.
      const step = timeline.step(index);
      const stateName = step.capture.state === 'not_started' ? 'Not started' : step.capture.state;
      find('timeline-position').textContent = 'Event ' + step.index + ' of ' + step.eventCount;
      find('timeline-title').textContent = step.label;
      find('timeline-description').textContent = step.description;
      find('timeline-event-type').textContent = step.event?.type ?? 'No event recorded';
      find('timeline-checkpoint').textContent = step.checkpoint.title;
      find('timeline-capture-state').textContent = stateName;
      find('timeline-counted').textContent = money(step.snapshot.captured);
      find('timeline-remaining').textContent = money(step.snapshot.remaining);
      find('timeline-approved').textContent = step.snapshot.approved + ' / ' + step.checkpointCount;
      find('timeline-order').textContent = step.checkpoint.orderId ?? 'No order';
      find('timeline-capture-id').textContent = step.checkpoint.captureId ?? 'No confirmed capture';
      find('timeline-guidance').textContent = step.capture.guidance;
      root.dataset.captureState = step.capture.state;
      previous.disabled = index === 0;
      next.disabled = index === timeline.eventCount;
      select.value = String(index);
      display.hidden = false;
      status.textContent = 'Event ' + step.index + ' of ' + step.eventCount + '. ' + step.label
        + '. Capture state: ' + stateName + '. Counted: ' + money(step.snapshot.captured) + '.';
      position = index;
    }

    previous.addEventListener('click', () => { if (position > 0) render(position - 1); });
    next.addEventListener('click', () => { if (position < timeline.eventCount) render(position + 1); });
    select.addEventListener('change', () => {
      const index = Number(select.value);
      if (!/^\d+$/.test(select.value) || !Number.isInteger(index) || index < 0 || index > timeline.eventCount) {
        select.value = String(position);
        return;
      }
      render(index);
    });
    select.disabled = false;
    render(0);
  } catch {
    previous.disabled = true;
    next.disabled = true;
    select.disabled = true;
    display.hidden = true;
    status.classList.remove('sr-only');
    status.textContent = 'The recovery timeline could not load. You can still explore the fixture above.';
  }
}
