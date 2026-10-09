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

const EVENT_FIELDS = Object.freeze({
  'checkpoint.revision_requested': ['checkpointId', 'reviewer', 'reason', 'reviewedEvidence'],
  'checkpoint.approved': ['checkpointId', 'approver', 'acceptedEvidence'],
  'paypal.order.created': ['checkpointId', 'orderId', 'amount', 'currency', 'environment'],
  'paypal.capture.requested': ['checkpointId', 'orderId', 'environment'],
  'paypal.capture.response_lost': ['checkpointId', 'orderId', 'outcome'],
  'paypal.webhook.received': ['checkpointId', 'eventId', 'captureId', 'duplicate', 'amount', 'currency'],
  'paypal.capture.reconciled': ['checkpointId', 'captureId', 'outcome', 'source'],
});

function requireId(value, label) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(`${label} must be a nonempty string without surrounding whitespace`);
  }
}

function requireCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be nonnegative safe integer cents`);
}

function requireRevisionText(value, label, nonblank = false) {
  if (typeof value !== 'string' || value.length > 5000 || (nonblank && !value.trim())) {
    throw new Error(label + (nonblank
      ? ' must be nonblank text of at most 5000 characters'
      : ' must be text of at most 5000 characters'));
  }
  if (value.includes('\r')) throw new Error(label + ' must use LF line breaks');
}

const fixtureOrderId = checkpointId => `SANDBOX-${checkpointId.toUpperCase()}`;

function copySeed(seed) {
  const copy = structuredClone(seed);
  if (!copy || !Array.isArray(copy.checkpoints)) throw new Error('Checkpoint seed is required');
  requireId(copy.currency, 'Currency');
  requireCents(copy.amount, 'Project cap');
  const ids = new Set();
  const orderIds = new Set();
  let total = 0;
  for (const cp of copy.checkpoints) {
    requireId(cp?.id, 'Checkpoint ID');
    if (ids.has(cp.id)) throw new Error('Checkpoint IDs must be unique');
    ids.add(cp.id);
    const orderId = fixtureOrderId(cp.id);
    if (orderIds.has(orderId)) throw new Error('Checkpoint IDs must produce unique fixture order IDs');
    orderIds.add(orderId);
    requireCents(cp.amount, 'Checkpoint amount');
    total += cp.amount;
    requireCents(total, 'Checkpoint total');
  }
  if (total > copy.amount) throw new Error('Checkpoint total exceeds the project cap');
  return copy;
}

function checkpoint(checkpoints, id) {
  if (typeof id !== 'string' || !Object.hasOwn(checkpoints, id)) throw new Error('Unknown checkpoint');
  return checkpoints[id];
}

function validateEnvelope(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string' || !Object.hasOwn(EVENT_FIELDS, event.type)) {
    throw new Error('Unsupported ledger event');
  }
  const allowed = ['seq', 'type', 'at', ...EVENT_FIELDS[event.type]];
  if (Object.keys(event).some(key => !allowed.includes(key))) throw new Error('Unsupported ledger event field');
  if (Object.hasOwn(event, 'seq') && (!Number.isSafeInteger(event.seq) || event.seq < 1)) throw new Error('Invalid event sequence');
  if (Object.hasOwn(event, 'at')) requireId(event.at, 'Event time');
}

function requireOrder(event, cp) {
  requireId(event.orderId, 'Order ID');
  if (event.orderId !== cp.orderId) throw new Error('Order identity conflict');
}

function requireAmount(event, cp, currency) {
  if (event.amount !== cp.amount || event.currency !== currency) throw new Error('Order amount or currency conflict');
}

export function createLedger(seed = FIXTURE) {
  const initialSeed = copySeed(seed);
  const events = [];
  const append = (type, data = {}) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Event data must be an object');
    const descriptors = Object.getOwnPropertyDescriptors(data);
    if (Object.values(descriptors).some(descriptor => !Object.hasOwn(descriptor, 'value'))) throw new Error('Event data must not contain accessors');
    if (['seq', 'type', 'at'].some(key => Object.hasOwn(descriptors, key))) throw new Error('Reserved event metadata');
    const payload = Object.fromEntries(Object.entries(descriptors).filter(([, descriptor]) => descriptor.enumerable).map(([key, descriptor]) => [key, descriptor.value]));
    const event = Object.freeze({ seq: events.length + 1, type, at: `T+${String(events.length + 1).padStart(3, '0')}`, ...payload });
    // Admission and replay use the same state machine. A refusal cannot alter
    // either the existing journal or the next logical sequence number.
    reduce([...events, event], initialSeed);
    events.push(event);
    return event;
  };
  const snapshot = () => reduce(events, initialSeed);
  const current = id => checkpoint(snapshot().checkpoints, id);
  return {
    get events() { return Object.freeze([...events]); },
    append,
    snapshot,
    requestRevision: (checkpointId, reason, reviewedEvidence) => {
      current(checkpointId);
      append('checkpoint.revision_requested', { checkpointId, reviewer: 'human-reviewer', reason, reviewedEvidence });
    },
    approve: (checkpointId, evidence = initialSeed.checkpoints.find(cp => cp.id === checkpointId)?.evidence) => {
      current(checkpointId);
      if (typeof evidence !== 'string' || !evidence.trim()) throw new Error('Acceptance evidence is required for human approval');
      append('checkpoint.approved', { checkpointId, approver: 'human-reviewer', acceptedEvidence: evidence.trim() });
    },
    createOrder: (checkpointId) => {
      const cp = current(checkpointId);
      append('paypal.order.created', { checkpointId, orderId: fixtureOrderId(checkpointId), amount: cp.amount, currency: initialSeed.currency, environment: 'sandbox' });
    },
    recordCaptureAttempt: (checkpointId) => {
      const cp = current(checkpointId);
      append('paypal.capture.requested', { checkpointId, orderId: cp.orderId, environment: 'sandbox' });
    },
    recordLostCaptureResponse: (checkpointId) => {
      const cp = current(checkpointId);
      append('paypal.capture.response_lost', { checkpointId, orderId: cp.orderId, outcome: 'unknown' });
    },
    recordWebhook: (checkpointId, eventId, captureId) => {
      const cp = current(checkpointId);
      const duplicate = events.some(e => e.type === 'paypal.webhook.received' && e.eventId === eventId);
      append('paypal.webhook.received', { checkpointId, eventId, captureId, duplicate, amount: cp.amount, currency: initialSeed.currency });
    },
    reconcile: (checkpointId, captureId) => {
      current(checkpointId);
      append('paypal.capture.reconciled', { checkpointId, captureId, outcome: 'captured', source: 'sandbox-transaction-lookup' });
    }
  };
}

export function reduce(events, seed = FIXTURE) {
  if (!Array.isArray(events)) throw new Error('Ledger events must be an array');
  const initialSeed = copySeed(seed);
  const checkpoints = Object.fromEntries(initialSeed.checkpoints.map(cp => [cp.id, { ...cp, approved: false, orderId: null, captureStatus: 'not_started', captureId: null, counted: 0 }]));
  const revisionRequests = new Set();
  const orders = new Map();
  const webhooks = new Map();
  const captures = new Map();
  const checkpointCaptures = new Map();
  const bindCapture = event => {
    requireId(event.captureId, 'Capture ID');
    if ((captures.has(event.captureId) && captures.get(event.captureId) !== event.checkpointId)
      || (checkpointCaptures.has(event.checkpointId) && checkpointCaptures.get(event.checkpointId) !== event.captureId)) {
      throw new Error('Capture identity conflict');
    }
    captures.set(event.captureId, event.checkpointId);
    checkpointCaptures.set(event.checkpointId, event.captureId);
  };
  for (const event of events) {
    validateEnvelope(event);
    const cp = checkpoint(checkpoints, event.checkpointId);
    switch (event.type) {
      case 'checkpoint.revision_requested':
        if (cp.approved) throw new Error('Revision requests are only available before approval');
        if (revisionRequests.has(cp.id)) throw new Error('A revision request is already recorded for this checkpoint');
        if (event.reviewer !== 'human-reviewer') throw new Error('Explicit fixture human review required');
        requireRevisionText(event.reason, 'Revision reason', true);
        requireRevisionText(event.reviewedEvidence, 'Reviewed evidence');
        revisionRequests.add(cp.id);
        break;
      case 'checkpoint.approved':
        if (cp.approved) throw new Error('Checkpoint already approved');
        if (event.approver !== 'human-reviewer') throw new Error('Explicit fixture human approval required');
        if (typeof event.acceptedEvidence !== 'string' || !event.acceptedEvidence.trim()) throw new Error('Acceptance evidence is required for human approval');
        cp.approved = true;
        break;
      case 'paypal.order.created':
        if (!cp.approved) throw new Error('Human approval required before order creation');
        if (cp.orderId) throw new Error('Order already exists');
        requireId(event.orderId, 'Order ID');
        if (orders.has(event.orderId)) throw new Error('Order identity conflict');
        requireAmount(event, cp, initialSeed.currency);
        if (event.environment !== 'sandbox') throw new Error('Only the sandbox fixture environment is supported');
        orders.set(event.orderId, event.checkpointId);
        cp.orderId = event.orderId;
        cp.captureStatus = 'ready';
        break;
      case 'paypal.capture.requested':
        if (!cp.orderId) throw new Error('Approved PayPal order required before capture');
        if (cp.captureStatus === 'pending') throw new Error('Capture is already pending; do not retry before its outcome is recorded');
        if (cp.captureStatus === 'unknown') throw new Error('Capture is not safe to retry; reconcile first');
        if (cp.captureStatus === 'captured') throw new Error('Capture already completed; do not retry');
        requireOrder(event, cp);
        if (event.environment !== 'sandbox') throw new Error('Only the sandbox fixture environment is supported');
        cp.captureStatus = 'pending';
        cp.captureRequested = true;
        break;
      case 'paypal.capture.response_lost':
        if (cp.captureStatus !== 'pending') throw new Error('Only a pending capture can lose its response');
        requireOrder(event, cp);
        if (event.outcome !== 'unknown') throw new Error('A lost capture response has an unknown outcome');
        cp.captureStatus = 'unknown';
        break;
      case 'paypal.webhook.received': {
        if (!cp.orderId) throw new Error('Order required before webhook');
        requireId(event.eventId, 'Webhook event ID');
        requireId(event.captureId, 'Capture ID');
        const prior = webhooks.get(event.eventId);
        if (prior && (prior.checkpointId !== event.checkpointId || prior.captureId !== event.captureId
          || prior.amount !== event.amount || prior.currency !== event.currency)) throw new Error('Webhook event identity conflict');
        requireAmount(event, cp, initialSeed.currency);
        if (event.duplicate !== Boolean(prior)) throw new Error('Webhook duplicate marker conflicts with event history');
        bindCapture(event);
        webhooks.set(event.eventId, event);
        // Receipt identity is retained during an unknown outcome, but receiving
        // a webhook does not replace the fixture's explicit reconciliation.
        if (!prior && cp.captureStatus !== 'captured' && cp.captureStatus !== 'unknown') {
          cp.captureStatus = 'captured'; cp.captureId = event.captureId; cp.counted = cp.amount;
        }
        break;
      }
      case 'paypal.capture.reconciled':
        if (cp.captureStatus !== 'unknown') throw new Error('Only an unknown capture can be reconciled');
        if (event.outcome !== 'captured' || event.source !== 'sandbox-transaction-lookup') throw new Error('Sandbox lookup evidence required for reconciliation');
        bindCapture(event);
        cp.captureStatus = 'captured'; cp.captureId = event.captureId; cp.counted = cp.amount;
        break;
    }
  }
  const total = initialSeed.checkpoints.reduce((sum, cp) => sum + cp.amount, 0);
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
