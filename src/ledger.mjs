export const SPEC_VERSION = 1;

export const FIXTURE = Object.freeze({
  id: 'fixture-signal-studio',
  label: 'Northstar onboarding refresh',
  currency: 'USD',
  amount: 120000,
  buyer: 'Northstar Studio (fictional fixture)',
  seller: 'Signal Works (fictional fixture)',
  brief: 'Refresh the onboarding flow for a small-business invoicing app. Deliver an accessible first-run checklist, responsive billing setup, and a documented handoff.',
  checkpoints: [
    { id: 'journey', title: 'First-run checklist', amount: 40000, evidence: 'A screen recording shows the checklist completion path and reset behavior.' },
    { id: 'accessibility', title: 'Accessible billing setup', amount: 40000, evidence: 'Keyboard-only walkthrough and automated accessibility report for the billing setup.' },
    { id: 'handoff', title: 'Responsive handoff', amount: 40000, evidence: 'Desktop and mobile handoff files plus implementation notes.' }
  ]
});

export function createLedger(seed = FIXTURE) {
  const events = [];
  const append = (type, data = {}) => {
    const event = Object.freeze({ seq: events.length + 1, type, at: `T+${String(events.length + 1).padStart(3, '0')}`, ...data });
    events.push(event);
    return event;
  };
  const snapshot = () => reduce(events, seed);
  return {
    events,
    append,
    snapshot,
    approve: (checkpointId, evidence = seed.checkpoints.find(cp => cp.id === checkpointId)?.evidence) => {
      const state = snapshot();
      if (!state.checkpoints[checkpointId]) throw new Error('Unknown checkpoint');
      if (state.checkpoints[checkpointId].approved) throw new Error('Checkpoint already approved');
      if (typeof evidence !== 'string' || !evidence.trim()) throw new Error('Acceptance evidence is required for human approval');
      append('checkpoint.approved', { checkpointId, approver: 'human-reviewer', acceptedEvidence: evidence.trim() });
    },
    createOrder: (checkpointId) => {
      const state = snapshot();
      const cp = state.checkpoints[checkpointId];
      if (!cp?.approved) throw new Error('Human approval required before order creation');
      if (cp.orderId) throw new Error('Order already exists');
      append('paypal.order.created', { checkpointId, orderId: `SANDBOX-${checkpointId.toUpperCase()}`, amount: cp.amount, currency: seed.currency, environment: 'sandbox' });
    },
    recordCaptureAttempt: (checkpointId) => {
      const cp = snapshot().checkpoints[checkpointId];
      if (!cp?.orderId) throw new Error('Approved PayPal order required before capture');
      if (cp.captureStatus === 'unknown' || cp.captureStatus === 'captured') throw new Error('Capture is not safe to retry; reconcile first');
      append('paypal.capture.requested', { checkpointId, orderId: cp.orderId, environment: 'sandbox' });
    },
    recordLostCaptureResponse: (checkpointId) => {
      const cp = snapshot().checkpoints[checkpointId];
      if (!cp?.captureRequested) throw new Error('Capture attempt required');
      append('paypal.capture.response_lost', { checkpointId, orderId: cp.orderId, outcome: 'unknown' });
    },
    recordWebhook: (checkpointId, eventId, captureId) => {
      const cp = snapshot().checkpoints[checkpointId];
      if (!cp?.orderId) throw new Error('Order required before webhook');
      const duplicate = events.some(e => e.type === 'paypal.webhook.received' && e.eventId === eventId);
      append('paypal.webhook.received', { checkpointId, eventId, captureId, duplicate, amount: cp.amount, currency: seed.currency });
    },
    reconcile: (checkpointId, captureId) => {
      const cp = snapshot().checkpoints[checkpointId];
      if (cp?.captureStatus !== 'unknown') throw new Error('Only an unknown capture can be reconciled');
      append('paypal.capture.reconciled', { checkpointId, captureId, outcome: 'captured', source: 'sandbox-transaction-lookup' });
    }
  };
}

export function reduce(events, seed = FIXTURE) {
  const checkpoints = Object.fromEntries(seed.checkpoints.map(cp => [cp.id, { ...cp, approved: false, orderId: null, captureStatus: 'not_started', captureId: null, counted: 0 }]));
  for (const event of events) {
    const cp = checkpoints[event.checkpointId];
    if (!cp) continue;
    switch (event.type) {
      case 'checkpoint.approved': cp.approved = true; break;
      case 'paypal.order.created': cp.orderId = event.orderId; cp.captureStatus = 'ready'; break;
      case 'paypal.capture.requested': cp.captureStatus = 'pending'; cp.captureRequested = true; break;
      case 'paypal.capture.response_lost': cp.captureStatus = 'unknown'; break;
      case 'paypal.webhook.received':
        if (!event.duplicate && cp.captureStatus !== 'captured' && cp.captureStatus !== 'unknown') { cp.captureStatus = 'captured'; cp.captureId = event.captureId; cp.counted = cp.amount; }
        break;
      case 'paypal.capture.reconciled':
        if (cp.captureStatus === 'unknown') { cp.captureStatus = 'captured'; cp.captureId = event.captureId; cp.counted = cp.amount; }
        break;
    }
  }
  const total = seed.checkpoints.reduce((sum, cp) => sum + cp.amount, 0);
  const approved = Object.values(checkpoints).filter(cp => cp.approved).length;
  const captured = Object.values(checkpoints).reduce((sum, cp) => sum + cp.counted, 0);
  return { checkpoints, total, approved, captured, remaining: total - captured };
}

export function replayFixture() {
  const ledger = createLedger();
  // Gate all payment action on explicit human acceptance; the first checkpoint
  // demonstrates a lost response, duplicated webhook, then read-only reconcile.
  ledger.approve('journey');
  ledger.createOrder('journey');
  ledger.recordCaptureAttempt('journey');
  ledger.recordLostCaptureResponse('journey');
  ledger.recordWebhook('journey', 'WH-EVT-FIXTURE-001', 'CAP-FIXTURE-001');
  ledger.recordWebhook('journey', 'WH-EVT-FIXTURE-001', 'CAP-FIXTURE-001');
  ledger.reconcile('journey', 'CAP-FIXTURE-001');
  return ledger;
}
