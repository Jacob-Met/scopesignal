import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureTimeline } from '../src/fixture-timeline.mjs';
import { replayFixture, reduce } from '../src/ledger.mjs';

test('the timeline exposes every real fixture prefix and counts only after reconciliation', () => {
  const timeline = createFixtureTimeline();
  const events = replayFixture().events;
  const expected = ['not_started', 'not_started', 'ready', 'pending', 'unknown', 'unknown', 'unknown', 'captured'];
  assert.equal(timeline.eventCount, 7);
  assert.equal(timeline.steps.length, 8);
  for (let index = 0; index <= timeline.eventCount; index += 1) {
    const step = timeline.step(index);
    assert.deepEqual(step.snapshot, reduce(events.slice(0, index)));
    assert.equal(step.capture.state, expected[index]);
    assert.equal(step.snapshot.captured, index === 7 ? 40000 : 0);
    assert.equal(step.snapshot.remaining, index === 7 ? 80000 : 120000);
    assert.equal(step.snapshot.approved, index === 0 ? 0 : 1);
    assert.deepEqual(step.event, index === 0 ? null : events[index - 1]);
  }
  assert.equal(timeline.step(5).label, 'Webhook received');
  assert.equal(timeline.step(6).label, 'Duplicate webhook received');
  assert.match(timeline.step(6).capture.guidance, /unknown|lost/);
  assert.equal(timeline.step(7).checkpoint.captureId, 'CAP-FIXTURE-001');
});

test('backward, repeated and out-of-order inspection never changes the fixture or another ledger', () => {
  const workspace = replayFixture();
  workspace.approve('accessibility', 'Human-reviewed evidence in the current workspace.');
  const before = structuredClone({ events: workspace.events, snapshot: workspace.snapshot() });
  const timeline = createFixtureTimeline();
  for (const index of [7, 4, 6, 0, 3, 7, 7, 1, 0]) {
    assert.equal(timeline.step(index).index, index);
  }
  assert.deepEqual({ events: workspace.events, snapshot: workspace.snapshot() }, before);
  assert.equal(timeline.step(7).snapshot.approved, 1);
  assert.equal(replayFixture().events.length, 7);
});

test('returned event and state objects cannot rewrite later timeline inspection', () => {
  const timeline = createFixtureTimeline();
  const accepted = timeline.step(1);
  const finished = timeline.step(7);
  const expectedAccepted = structuredClone(accepted);
  const expectedFinished = structuredClone(finished);
  accepted.event.acceptedEvidence = 'Changed by a caller';
  accepted.snapshot.checkpoints.journey.amount = 1;
  finished.snapshot.checkpoints.journey.captureId = 'Wrong capture';
  finished.snapshot.captured = 80000;
  assert.deepEqual(timeline.step(1), expectedAccepted);
  assert.deepEqual(timeline.step(7), expectedFinished);
  assert.throws(() => { timeline.steps[0].label = 'Changed'; }, TypeError);
});

test('invalid navigation refuses the index without losing valid timeline state', () => {
  const timeline = createFixtureTimeline();
  const before = timeline.step(4);
  for (const index of [-1, 8, 1.5, NaN, Infinity, '4', null, undefined, {}, Symbol('event')]) {
    assert.throws(() => timeline.step(index), RangeError);
  }
  assert.deepEqual(timeline.step(4), before);
});
