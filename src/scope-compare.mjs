import { decodeScopeWorkspace } from './scope-workspace-record.mjs';
import { draftBudget, parseDollars } from './scope-plan.mjs';

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const definitionKey = row => JSON.stringify([row.title, row.amountText, row.plannedEvidence]);
const field = (key, label, left, right, kind = 'text') => ({
  key, label, left, right, kind, changed: !Object.is(left, right)
});

// The existing codec validates and replays privately. This reader keeps only
// immutable values; it never exposes a live review or its action methods.
export function readComparisonWorkspace(contents) {
  const admitted = decodeScopeWorkspace(contents);
  const snapshot = admitted.review?.snapshot();
  const budget = draftBudget(admitted.draft);
  const rows = admitted.draft.checkpoints.map((row, index) => {
    const checkpoint = snapshot?.checkpoints[index];
    return {
      index, title: row.title, amountText: row.amount,
      amountCents: parseDollars(row.amount), plannedEvidence: row.evidence,
      approved: checkpoint ? checkpoint.approved : null,
      acceptedEvidence: checkpoint?.approved ? checkpoint.acceptedEvidence : null,
      pendingEvidence: checkpoint && !checkpoint.approved
        ? admitted.evidenceDrafts.get(checkpoint.id) ?? checkpoint.evidence : null,
      captureStatus: checkpoint?.captureStatus ?? null,
      orderId: checkpoint?.orderId ?? null,
      captureId: checkpoint?.captureId ?? null,
      counted: checkpoint?.counted ?? null
    };
  });
  return freeze({
    stage: admitted.summary.stage,
    draft: structuredClone(admitted.draft), rows,
    plan: snapshot ? structuredClone(snapshot.plan) : null,
    events: snapshot ? structuredClone(snapshot.events) : [],
    totals: {
      cap: budget.cap, allocated: budget.allocated, unallocated: budget.unallocated,
      approved: snapshot?.approved ?? null,
      captured: snapshot?.captured ?? null,
      remaining: snapshot?.remaining ?? null
    }
  });
}

// Equal definitions suggest a useful comparison, not historical identity.
// Repeated definitions on either side remain unpaired.
export function sameDefinitionPairs(left, right) {
  const groups = workspace => {
    const result = new Map();
    for (const row of workspace.rows) {
      const key = definitionKey(row);
      result.set(key, [...(result.get(key) ?? []), row.index]);
    }
    return result;
  };
  const a = groups(left), b = groups(right), pairs = [];
  for (const [key, indices] of a) {
    const other = b.get(key);
    if (indices.length === 1 && other?.length === 1) pairs.push([indices[0], other[0]]);
  }
  return pairs.sort((x, y) => x[0] - y[0]);
}

export function validatePairing(left, right, pairs) {
  if (!Array.isArray(pairs)) throw new Error('Checkpoint pairing must be a list.');
  const usedLeft = new Set(), usedRight = new Set();
  const copy = Array.from(pairs, pair => {
    if (!Array.isArray(pair) || pair.length !== 2
      || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1])
      || pair[0] < 0 || pair[0] >= left.rows.length
      || pair[1] < 0 || pair[1] >= right.rows.length) {
      throw new Error('Each pairing must name an existing checkpoint on each side.');
    }
    if (usedLeft.has(pair[0]) || usedRight.has(pair[1])) {
      throw new Error('Each checkpoint can be paired only once.');
    }
    usedLeft.add(pair[0]); usedRight.add(pair[1]);
    return [...pair];
  });
  return copy.sort((a, b) => a[0] - b[0]);
}

export function pairCheckpoint(left, right, pairs, leftIndex, rightIndex) {
  validatePairing(left, right, [[leftIndex, rightIndex ?? 0]]);
  const next = validatePairing(left, right, pairs).filter(pair => pair[0] !== leftIndex);
  if (rightIndex !== null) next.push([leftIndex, rightIndex]);
  return validatePairing(left, right, next);
}

function compareHistory(left, right) {
  const counts = { leftEvents: left.events.length, rightEvents: right.events.length };
  if (left.stage !== 'review' || right.stage !== 'review') {
    return { kind: 'not-reviewed', commonEvents: null, ...counts };
  }
  if (!same(left.plan, right.plan)) {
    return { kind: 'different-plans', commonEvents: null, ...counts };
  }
  let commonEvents = 0;
  while (commonEvents < Math.min(left.events.length, right.events.length)
    && same(left.events[commonEvents], right.events[commonEvents])) commonEvents += 1;
  const kind = commonEvents === left.events.length && commonEvents === right.events.length
    ? 'equal' : commonEvents === left.events.length ? 'a-prefix'
      : commonEvents === right.events.length ? 'b-prefix' : 'divergent';
  return { kind, commonEvents, ...counts };
}

const rowFields = (a, b) => [
  field('title', 'Deliverable', a.title, b.title),
  field('amountText', 'Saved amount text (USD)', a.amountText, b.amountText),
  field('amountCents', 'Parsed milestone amount', a.amountCents, b.amountCents, 'money'),
  field('plannedEvidence', 'Planned acceptance evidence', a.plannedEvidence, b.plannedEvidence),
  field('approved', 'Recorded fixture approval', a.approved, b.approved, 'approval'),
  field('acceptedEvidence', 'Accepted evidence', a.acceptedEvidence, b.acceptedEvidence),
  field('pendingEvidence', 'Pending review evidence', a.pendingEvidence, b.pendingEvidence),
  field('captureStatus', 'Simulated capture state', a.captureStatus, b.captureStatus, 'capture'),
  field('orderId', 'Fixture order ID', a.orderId, b.orderId),
  field('captureId', 'Counted fixture capture ID', a.captureId, b.captureId),
  field('counted', 'Simulated amount counted', a.counted, b.counted, 'money')
];

export function compareWorkspaces(left, right, requestedPairs = sameDefinitionPairs(left, right)) {
  const pairs = validatePairing(left, right, requestedPairs);
  const pairedLeft = new Set(pairs.map(pair => pair[0]));
  const pairedRight = new Set(pairs.map(pair => pair[1]));
  return freeze({
    project: [
      field('stage', 'Saved stage', left.stage, right.stage, 'stage'),
      field('label', 'Project name', left.draft.label, right.draft.label),
      field('brief', 'Creative brief', left.draft.brief, right.draft.brief),
      field('capText', 'Saved project cap text (USD)', left.draft.cap, right.draft.cap)
    ],
    totals: [
      field('cap', 'Parsed project cap', left.totals.cap, right.totals.cap, 'money'),
      field('allocated', 'Allocated to milestones', left.totals.allocated, right.totals.allocated, 'money'),
      field('unallocated', 'Unallocated within cap', left.totals.unallocated, right.totals.unallocated, 'money'),
      field('approved', 'Recorded fixture approvals', left.totals.approved, right.totals.approved, 'count'),
      field('captured', 'Simulated captured total', left.totals.captured, right.totals.captured, 'money'),
      field('remaining', 'Allocated remaining', left.totals.remaining, right.totals.remaining, 'money')
    ],
    rows: pairs.map(([leftIndex, rightIndex]) => {
      const a = left.rows[leftIndex], b = right.rows[rightIndex], fields = rowFields(a, b);
      return {
        leftIndex, rightIndex, sameDefinition: definitionKey(a) === definitionKey(b),
        differentRowNumbers: leftIndex !== rightIndex,
        changed: fields.some(item => item.changed), fields
      };
    }),
    unpairedLeft: left.rows.filter(row => !pairedLeft.has(row.index)),
    unpairedRight: right.rows.filter(row => !pairedRight.has(row.index)),
    history: compareHistory(left, right)
  });
}

export function checkpointFields(row) {
  return rowFields(row, row).map(({ key, label, left, kind }) => ({ key, label, value: left, kind }));
}

