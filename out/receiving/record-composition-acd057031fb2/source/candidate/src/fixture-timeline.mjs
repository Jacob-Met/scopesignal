import { FIXTURE, replayFixture, reduce } from './ledger.mjs';
import { capturePresentation } from './payment-status.mjs';

function eventLabel(event) {
  if (!event) return 'Before human approval';
  switch (event.type) {
    case 'checkpoint.approved': return 'Human approves the checkpoint';
    case 'paypal.order.created': return 'Fixture order created';
    case 'paypal.capture.requested': return 'Capture requested';
    case 'paypal.capture.response_lost': return 'Capture response lost';
    case 'paypal.webhook.received': return event.duplicate ? 'Duplicate webhook received' : 'Webhook received';
    case 'paypal.capture.reconciled': return 'Capture reconciled';
    default: return event.type;
  }
}

function eventDescription(event) {
  if (!event) return 'The checkpoint has not been approved. No order or capture is recorded.';
  switch (event.type) {
    case 'checkpoint.approved': return 'A human accepts the evidence. Approval itself does not request a capture.';
    case 'paypal.order.created': return 'The approved checkpoint now has an order. No capture has been requested.';
    case 'paypal.capture.requested': return 'The capture request is recorded, but its outcome has not arrived.';
    case 'paypal.capture.response_lost': return 'The response is missing. The ledger keeps the capture outcome unknown.';
    case 'paypal.webhook.received': return event.duplicate
      ? 'The repeated receipt stays in the event log. It does not increase the captured amount.'
      : 'The webhook is recorded. Receiving it does not settle the earlier unknown capture.';
    case 'paypal.capture.reconciled': return 'Reconciliation confirms the existing capture, which is counted once.';
    default: return 'Inspect the recorded event and the resulting checkpoint state.';
  }
}

// This timeline owns a separate copy of the original fixture. It never receives
// the workspace ledger or its approve/append methods.
export function createFixtureTimeline() {
  const seed = structuredClone(FIXTURE);
  const events = structuredClone(replayFixture().events);
  const eventCount = events.length;
  const steps = Object.freeze(Array.from({ length: eventCount + 1 }, (_, index) =>
    Object.freeze({ index, label: eventLabel(events[index - 1]) })));

  return Object.freeze({
    eventCount,
    steps,
    step(index) {
      if (!Number.isInteger(index) || index < 0 || index > eventCount) {
        throw new RangeError('Choose an existing fixture event.');
      }
      const event = index === 0 ? null : structuredClone(events[index - 1]);
      const snapshot = reduce(events.slice(0, index), seed);
      const checkpoint = snapshot.checkpoints[event?.checkpointId ?? seed.checkpoints[0].id];
      return {
        index,
        eventCount,
        label: eventLabel(event),
        description: eventDescription(event),
        event,
        snapshot,
        checkpoint,
        capture: capturePresentation(checkpoint),
        currency: seed.currency,
        checkpointCount: seed.checkpoints.length,
      };
    },
  });
}
