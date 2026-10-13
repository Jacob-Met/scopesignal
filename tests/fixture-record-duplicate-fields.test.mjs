import test from 'node:test';
import assert from 'node:assert/strict';
import { replayFixture } from '../src/ledger.mjs';
import { createFixtureRecord, serializeFixtureRecord } from '../src/fixture-record.mjs';
import { FixtureRecordError, readFixtureRecord } from '../src/record-reader.mjs';

// Generate ambiguous text from real fixture facts. The native parser must
// produce the same valid record, so another schema/history error cannot pass.
function withRepeatedField(record, selected, earlier, escapedFirst = false) {
  const encode = (value, path = []) => {
    if (Array.isArray(value)) return '[' + value.map((item, i) => encode(item, [...path, i])).join(',') + ']';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    return '{' + Object.entries(value).map(([key, item]) => {
      const target = [...path, key];
      const literal = JSON.stringify(key);
      const encoded = '"\\u' + key.charCodeAt(0).toString(16).padStart(4, '0') + key.slice(1) + '"';
      const field = (escapedFirst ? literal : encoded) + ':' + encode(item, target);
      return JSON.stringify(target) === JSON.stringify(selected)
        ? (escapedFirst ? encoded : literal) + ':' + JSON.stringify(earlier) + ',' + field
        : literal + ':' + encode(item, target);
    }).join(',') + '}';
  };
  return encode(record);
}

test('repeated decoded fields are refused before accepting otherwise valid facts', () => {
  const expected = createFixtureRecord(replayFixture().events);
  const paths = [
    ['version'], ['paymentEvidence'], ['summary', 'captured'],
    ['fixture', 'amount'], ['events', 0, 'acceptedEvidence'],
    ['checkpoints', 0, 'approval', 'approver'], ['checkpoints', 0, 'capture', 'counted'],
  ];
  for (const path of paths) {
    const current = path.reduce((value, key) => value[key], expected);
    for (const earlier of [current, null]) {
      for (const escapedFirst of [false, true]) {
        const raw = withRepeatedField(expected, path, earlier, escapedFirst);
        assert.deepEqual(JSON.parse(raw), expected, 'native last-field parsing would conceal ambiguity');
        assert.throws(() => readFixtureRecord(raw), error => error instanceof FixtureRecordError && error.code === 'format');
      }
    }
  }
  const raw = JSON.stringify(expected).replace('"version":1', '"version":1,"version":1');
  assert.deepEqual(JSON.parse(raw), expected);
  assert.throws(() => readFixtureRecord(raw), error => error instanceof FixtureRecordError && error.code === 'format');
});

test('repeated names in separate objects and all actual recovery prefixes remain valid', () => {
  const events = replayFixture().events;
  for (let count = 0; count <= events.length; count++) {
    const record = readFixtureRecord(serializeFixtureRecord(events.slice(0, count)));
    assert.deepEqual(record, createFixtureRecord(events.slice(0, count)));
    assert(Object.isFrozen(record.events));
    assert(Object.isFrozen(record.summary));
  }
});

test('quoted braces, escaped quotes, Unicode and field-like evidence remain literal', () => {
  const ledger = replayFixture();
  const evidence = 'café 雪 😀 { "version": 1, "version": 2 } [ ] \\ "acceptedEvidence": null\n\tkept';
  ledger.approve('accessibility', evidence);
  const expected = createFixtureRecord(ledger.events);
  const raw = JSON.stringify(expected, null, 2).replace('"version":', '"ver\\u0073ion" \r\n\t :');
  assert.deepEqual(readFixtureRecord(raw), expected);
  assert.equal(readFixtureRecord(raw).events.at(-1).acceptedEvidence, evidence);
});

test('deep valid JSON with the wrong format still receives a typed refusal', () => {
  const raw = '{"child":'.repeat(12000) + '0' + '}'.repeat(12000);
  assert.doesNotThrow(() => JSON.parse(raw));
  assert.throws(() => readFixtureRecord(raw), error => error instanceof FixtureRecordError && error.code === 'format');
});

test('native syntax refusal keeps priority over repeated-field admission', () => {
  assert.throws(() => readFixtureRecord('{"version":1,"version":1,}'),
    error => error instanceof FixtureRecordError && error.code === 'syntax');
});
