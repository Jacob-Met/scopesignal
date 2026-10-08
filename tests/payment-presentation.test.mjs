import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, replayFixture, reduce } from '../src/ledger.mjs';
import { capturePresentation } from '../src/payment-status.mjs';

test('every shipped replay prefix presents its current reduced capture state', () => {
  const events = replayFixture().events;
  const expected = ['not_started', 'not_started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
  for (let length = 0; length <= events.length; length++) {
    const state = reduce(events.slice(0, length));
    const before = JSON.stringify(state);
    const display = capturePresentation(state.checkpoints.journey);
    assert.equal(display.state, expected[length], `prefix ${length}`);
    assert.equal(display.title, `Capture state: ${expected[length].replace('_', ' ')}`);
    assert.equal(JSON.stringify(state), before);
    if (length >= 4 && length <= 6) {
      assert.match(display.guidance, /Do not retry blindly/);
      assert.equal(state.captured, 0);
    }
    if (length === 7) {
      assert.match(display.guidance, /counts this checkpoint once/);
      assert.doesNotMatch(display.guidance, /response was lost/);
      assert.equal(state.captured, 40000);
    }
  }
});

test('ordinary webhook capture does not invent a reconciliation', () => {
  const ledger = createLedger();
  ledger.approve('journey');
  ledger.createOrder('journey');
  ledger.recordCaptureAttempt('journey');
  ledger.recordWebhook('journey', 'WH-ORDINARY', 'CAP-ORDINARY');
  const display = capturePresentation(ledger.snapshot().checkpoints.journey);
  assert.equal(display.state, 'captured');
  assert.doesNotMatch(display.guidance, /reconcil|lost/);
});

test('missing and unrecognized states do not become captured or safe-to-retry labels', () => {
  for (const state of [null, {}, { captureStatus: 'future-state' }]) {
    const display = capturePresentation(state);
    assert.equal(display.state, 'unavailable');
    assert.match(display.guidance, /Review the ledger before acting/);
  }
});
