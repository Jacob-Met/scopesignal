import { FIXTURE, createLedger } from './ledger.mjs';

export const MAX_CHECKPOINTS = 12;
const wholeDollars = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatUSD(cents) {
  if (!Number.isSafeInteger(cents)) throw new Error('USD display requires safe integer cents.');
  const magnitude = Math.abs(cents);
  // Dividing a large safe cent integer into a floating dollar value can change
  // its cents. Group the whole-dollar integer and append the exact remainder.
  return `${cents < 0 ? '-' : ''}$${wholeDollars.format(Math.floor(magnitude / 100))}.${String(magnitude % 100).padStart(2, '0')}`;
}

export function dollars(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function parseDollars(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function draftFromFixture() {
  return {
    label: FIXTURE.label,
    brief: FIXTURE.brief,
    cap: dollars(FIXTURE.amount),
    checkpoints: FIXTURE.checkpoints.map(cp => ({
      title: cp.title, amount: dollars(cp.amount), evidence: cp.evidence
    }))
  };
}

export function draftBudget(draft) {
  const cap = parseDollars(draft.cap);
  const amounts = Array.from(draft.checkpoints, cp => parseDollars(cp?.amount));
  const sum = amounts.reduce((total, amount) => total + (amount ?? 0), 0);
  const allocated = amounts.includes(null) || !Number.isSafeInteger(sum) ? null : sum;
  return { cap, allocated, unallocated: cap === null || allocated === null ? null : cap - allocated };
}

export function validateScopeDraft(draft) {
  const errors = [];
  const text = (value, field, label, max) => {
    if (typeof value !== 'string' || !value.trim()) {
      errors.push({ field, message: `${label} is required.` });
      return '';
    }
    if (value.length > max) errors.push({ field, message: `${label} must be ${max} characters or fewer.` });
    return value.trim();
  };
  const label = text(draft?.label, 'label', 'Project name', 120);
  const brief = text(draft?.brief, 'brief', 'Creative brief', 8000);
  const cap = parseDollars(draft?.cap);
  if (cap === null) errors.push({ field: 'cap', message: 'Enter a positive project cap in USD with no more than two decimal places.' });
  if (typeof draft?.cap === 'string' && draft.cap.length > 64) errors.push({ field: 'cap', message: 'Project cap must be 64 characters or fewer, including spaces and leading zeros.' });
  const rows = Array.isArray(draft?.checkpoints) ? draft.checkpoints : [];
  if (rows.length < 1 || rows.length > MAX_CHECKPOINTS) {
    errors.push({ field: 'checkpoints', message: `Use between 1 and ${MAX_CHECKPOINTS} checkpoints.` });
  }
  const checkpoints = Array.from(rows.slice(0, MAX_CHECKPOINTS), (cp, index) => {
    const prefix = `checkpoints.${index}`;
    const title = text(cp?.title, `${prefix}.title`, `Checkpoint ${index + 1} title`, 160);
    const evidence = text(cp?.evidence, `${prefix}.evidence`, `Checkpoint ${index + 1} acceptance evidence`, 5000);
    const amount = parseDollars(cp?.amount);
    if (amount === null) errors.push({ field: `${prefix}.amount`, message: `Enter a positive USD amount for checkpoint ${index + 1}, with no more than two decimal places.` });
    if (typeof cp?.amount === 'string' && cp.amount.length > 64) errors.push({ field: `${prefix}.amount`, message: `Checkpoint ${index + 1} amount must be 64 characters or fewer, including spaces and leading zeros.` });
    // Identifiers belong to this draft, never to user-entered titles or receipts.
    return { id: `scope-${index + 1}`, title, amount, evidence };
  });
  const allocated = checkpoints.reduce((sum, cp) => sum + (cp.amount ?? 0), 0);
  if (!Number.isSafeInteger(allocated)) errors.push({ field: 'cap', message: 'The checkpoint total is too large.' });
  else if (cap !== null && allocated > cap) errors.push({ field: 'cap', message: 'Checkpoint amounts exceed the project cap. Increase the cap or reduce a checkpoint amount.' });
  if (errors.length) return { ok: false, errors, seed: null };
  const seed = {
    id: 'authored-scope-fixture', label, brief, currency: 'USD', amount: cap,
    buyer: 'Fictional fixture reviewer', seller: 'Fictional fixture creator', checkpoints
  };
  return { ok: true, errors: [], seed };
}

function availableActions(cp, events) {
  if (!cp.approved) return ['approve'];
  const receipts = events.filter(e => e.checkpointId === cp.id && e.type === 'paypal.webhook.received');
  switch (cp.captureStatus) {
    case 'not_started': return ['order'];
    case 'ready': return ['request'];
    case 'pending': return ['receipt', 'lose'];
    case 'unknown': return [...(receipts.length === 0 ? ['receipt'] : receipts.length === 1 ? ['duplicate'] : []), 'reconcile'];
    case 'captured': return receipts.length === 1 ? ['duplicate'] : [];
    default: return [];
  }
}

// A local fixture session, built on the product's ledger. It exposes only the
// explicit next-step controls used by the authoring page, never an append API.
export function createScopeReview(draft) {
  const validation = validateScopeDraft(draft);
  if (!validation.ok) throw new Error(validation.errors.map(error => error.message).join(' '));
  const seed = structuredClone(validation.seed);
  const ledger = createLedger(seed);
  const snapshot = () => {
    const events = structuredClone(ledger.events);
    const state = ledger.snapshot();
    return {
      plan: structuredClone(seed), ...state, events,
      unallocated: seed.amount - state.total,
      checkpoints: seed.checkpoints.map(cp => ({
        ...state.checkpoints[cp.id],
        acceptedEvidence: events.find(e => e.type === 'checkpoint.approved' && e.checkpointId === cp.id)?.acceptedEvidence ?? null,
        actions: availableActions(state.checkpoints[cp.id], events)
      }))
    };
  };
  const act = (checkpointId, action, evidence) => {
    const current = snapshot().checkpoints.find(cp => cp.id === checkpointId);
    if (!current) throw new Error('Unknown checkpoint.');
    if (!current.actions.includes(action)) throw new Error('That action is not available in the current checkpoint state.');
    const captureId = `CAP-${checkpointId.toUpperCase()}`;
    const eventId = `WH-${checkpointId.toUpperCase()}`;
    switch (action) {
      case 'approve':
        if (typeof evidence !== 'string' || evidence.length > 5000) throw new Error('Acceptance evidence must be 5000 characters or fewer.');
        ledger.approve(checkpointId, evidence);
        break;
      case 'order': ledger.createOrder(checkpointId); break;
      case 'request': ledger.recordCaptureAttempt(checkpointId); break;
      case 'lose': ledger.recordLostCaptureResponse(checkpointId); break;
      case 'receipt':
      case 'duplicate': ledger.recordWebhook(checkpointId, eventId, captureId); break;
      case 'reconcile': ledger.reconcile(checkpointId, captureId); break;
    }
    return snapshot();
  };
  return Object.freeze({ snapshot, act });
}
