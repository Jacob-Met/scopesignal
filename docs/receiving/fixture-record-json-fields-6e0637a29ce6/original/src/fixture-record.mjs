import { FIXTURE, SPEC_VERSION, reduce } from './ledger.mjs';

export const FIXTURE_RECORD_FILENAME = 'scopesignal-fixture-record-v1.json';

export function createFixtureRecord(events) {
  const recordedEvents = structuredClone(events);
  const state = reduce(recordedEvents);
  return {
    schema: 'scopesignal.fixture-record',
    version: 1,
    ledgerSpecVersion: SPEC_VERSION,
    fixtureOnly: true,
    paymentEvidence: false,
    notice: 'Synthetic ScopeSignal fixture. This is not a payment receipt or evidence of a real transaction.',
    fixture: { id: FIXTURE.id, label: FIXTURE.label, currency: FIXTURE.currency, amount: FIXTURE.amount },
    summary: { total: state.total, approved: state.approved, captured: state.captured, remaining: state.remaining },
    checkpoints: FIXTURE.checkpoints.map(checkpoint => {
      const current = state.checkpoints[checkpoint.id];
      const acceptance = recordedEvents.find(event => event.type === 'checkpoint.approved' && event.checkpointId === checkpoint.id);
      return {
        id: checkpoint.id,
        title: checkpoint.title,
        amount: checkpoint.amount,
        approval: acceptance ? { source: 'checkpoint.approved', eventSequence: acceptance.seq, approver: acceptance.approver, acceptedEvidence: acceptance.acceptedEvidence } : null,
        capture: { status: current.captureStatus, orderId: current.orderId, captureId: current.captureId, counted: current.counted },
      };
    }),
    events: recordedEvents,
  };
}

export function serializeFixtureRecord(events) {
  return JSON.stringify(createFixtureRecord(events), null, 2) + '\n';
}
