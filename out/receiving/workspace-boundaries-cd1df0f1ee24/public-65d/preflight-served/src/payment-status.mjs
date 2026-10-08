// Presentation follows the existing reduced ledger. Historical response loss
// remains in the event log, but does not override a later reconciliation.
const guidance = Object.freeze({
  not_started: 'No capture has been requested for this checkpoint.',
  ready: 'A fixture order exists; no capture has been requested.',
  pending: 'A capture was requested. Its outcome has not been recorded.',
  unknown: 'The capture response was lost. Do not retry blindly; look up the existing transaction and reconcile once.',
  captured: 'The current fixture ledger counts this checkpoint once. No new capture is needed.',
});

export function capturePresentation(checkpoint) {
  const state = checkpoint?.captureStatus;
  if (!Object.hasOwn(guidance, state)) {
    return { state: 'unavailable', title: 'Capture state: unavailable', guidance: 'The current capture state is unavailable. Review the ledger before acting.' };
  }
  return { state, title: `Capture state: ${state === 'not_started' ? 'not started' : state}`, guidance: guidance[state] };
}

export function recoveryGuidance(snapshot) {
  const states = Object.values(snapshot.checkpoints).map(checkpoint => checkpoint.captureStatus);
  if (states.includes('unknown')) return 'Keep unresolved capture outcomes unknown. Do not retry blindly; look up each existing Sandbox transaction and reconcile once.';
  if (states.includes('pending')) return 'A capture is pending. Its outcome has not been recorded; review that request before starting another capture.';
  if (states.some(state => !Object.hasOwn(guidance, state))) return 'The current capture state is unavailable. Review the ledger before acting.';
  if (states.includes('captured')) return 'The fixture ledger counts completed captures once; no uncertain capture remains. Do not request another capture for a captured checkpoint.';
  return 'No capture has been requested in this fixture. Human approval and an order are required before capture.';
}
