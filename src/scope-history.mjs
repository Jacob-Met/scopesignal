import { decodeScopeWorkspace } from './scope-workspace-record.mjs';
import { reduce } from './ledger.mjs';
import { capturePresentation } from './payment-status.mjs';

const labels = Object.freeze({
  'checkpoint.approved': 'Evidence approved',
  'paypal.order.created': 'Fixture order created',
  'paypal.capture.requested': 'Capture requested',
  'paypal.capture.response_lost': 'Response lost',
  'paypal.webhook.received': 'Webhook received',
  'paypal.capture.reconciled': 'Capture reconciled'
});

function label(event) {
  if (!event) return 'Before any recorded decision';
  if (event.type === 'paypal.webhook.received' && event.duplicate) return 'Duplicate webhook received';
  return labels[event.type];
}

function description(event, checkpoint) {
  if (!event) return 'The plan is ready for review. No approval, order or capture has been recorded at this point.';
  switch (event.type) {
    case 'checkpoint.approved':
      return 'This recorded decision accepts the evidence shown below. Approval itself does not create an order or request capture.';
    case 'paypal.order.created':
      return 'The approved checkpoint now has its recorded fixture order. No capture has been requested for it yet.';
    case 'paypal.capture.requested':
      return 'The capture request is recorded. Its outcome is pending and its amount is not counted as captured.';
    case 'paypal.capture.response_lost':
      return 'The response was lost. The capture outcome remains unknown and its amount is not counted.';
    case 'paypal.webhook.received':
      if (event.duplicate) return 'This repeats the recorded webhook. The duplicate stays in the history without increasing the captured amount.';
      return checkpoint.captureStatus === 'unknown'
        ? 'The webhook is recorded, but the earlier unknown outcome remains unresolved. This checkpoint is not counted as captured yet.'
        : 'The webhook records this checkpoint as captured. Its amount is counted once.';
    case 'paypal.capture.reconciled':
      return 'The simulated lookup resolves the existing unknown capture. This checkpoint is counted once.';
  }
}

// Admit the complete ordinary workspace before exposing any prefix. Its
// private native replay preserves the existing event and plan contract.
export function createScopeHistory(contents) {
  const opened = decodeScopeWorkspace(contents);
  if (!opened.review) throw new Error('Review this scope before inspecting its history.');
  const current = opened.review.snapshot();
  const plan = structuredClone(current.plan);
  const events = structuredClone(current.events);
  const steps = Object.freeze(Array.from({ length: events.length + 1 }, (_, index) => {
    const event = events[index - 1];
    const checkpointIndex = event ? plan.checkpoints.findIndex(cp => cp.id === event.checkpointId) : -1;
    return Object.freeze({
      index, label: label(event),
      checkpoint: checkpointIndex < 0 ? null : checkpointIndex + 1,
      checkpointTitle: checkpointIndex < 0 ? null : plan.checkpoints[checkpointIndex].title
    });
  }));

  return Object.freeze({
    eventCount: events.length,
    checkpointCount: plan.checkpoints.length,
    label: plan.label,
    steps,
    step(index) {
      if (!Number.isInteger(index) || index < 0 || index > events.length) {
        throw new RangeError('Choose an existing recorded event.');
      }
      const prefix = events.slice(0, index);
      const snapshot = reduce(prefix, plan);
      const event = index === 0 ? null : structuredClone(events[index - 1]);
      const checkpoints = plan.checkpoints.map(definition => {
        const checkpoint = snapshot.checkpoints[definition.id];
        const approval = prefix.find(item => item.type === 'checkpoint.approved' && item.checkpointId === definition.id);
        return {
          ...checkpoint,
          acceptedEvidence: approval?.acceptedEvidence ?? null,
          capture: capturePresentation(checkpoint)
        };
      });
      return {
        index, eventCount: events.length,
        label: label(event),
        description: description(event, event ? snapshot.checkpoints[event.checkpointId] : null),
        event, plan: structuredClone(plan), snapshot, checkpoints,
        unallocated: plan.amount - snapshot.total
      };
    }
  });
}
