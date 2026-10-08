import { FIXTURE, reduce } from './ledger.mjs';
import { recoveryGuidance } from './payment-status.mjs';

// Clearly separated deterministic, local-only role previews. These are rules,
// not model outputs and never make payment decisions or approvals.
export const roles = Object.freeze({
  briefInterpreter(brief = FIXTURE.brief) {
    const lower = brief.toLowerCase();
    return { role: 'Brief interpreter', mode: 'local rule preview', summary: 'A responsive onboarding refresh with a checklist, billing setup, and handoff.', tags: ['onboarding', ...(lower.includes('accessible') ? ['accessibility'] : []), ...(lower.includes('responsive') ? ['responsive'] : [])] };
  },
  evidenceMapper(checkpoint) {
    return { role: 'Evidence mapper', mode: 'local rule preview', checkpoint: checkpoint.title, suggestedEvidence: checkpoint.evidence, note: 'Suggestions require human editing and acceptance.' };
  },
  paymentPolicy(checkpoint) {
    return { role: 'Payment policy', mode: 'local rule preview', checkpoint: checkpoint.title, rule: `No order before human approval; release only ${new Intl.NumberFormat('en-US', { style: 'currency', currency: FIXTURE.currency }).format(checkpoint.amount / 100)} after accepted evidence.`, executable: false };
  },
  recoveryReview(events) {
    const dup = events.some(e => e.type === 'paypal.webhook.received' && e.duplicate);
    return { role: 'Recovery reviewer', mode: 'local rule preview', guidance: recoveryGuidance(reduce(events)), duplicateWebhook: dup ? 'Duplicate event ignored by idempotency key.' : 'No duplicate webhook observed.' };
  }
});
