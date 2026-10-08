import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopeReview } from '../src/scope-plan.mjs';
import { encodeScopeWorkspace } from '../src/scope-workspace-record.mjs';
import { createScopeHistory } from '../src/scope-history.mjs';

function makeDraft() {
  return {
    label: 'Authored Ω scope', brief: 'Two independent deliverables.', cap: '700.00',
    checkpoints: [
      { title: 'Alpha <literal>', amount: '125.50', evidence: 'Planned Alpha' },
      { title: 'Beta <literal>', amount: '225.75', evidence: 'Planned Beta' }
    ]
  };
}
function serialize(draft, review, evidenceDrafts = new Map()) {
  return encodeScopeWorkspace({ draft, review, evidenceDrafts });
}
function mixed() {
  const draft = makeDraft(), review = createScopeReview(draft);
  for (const action of ['approve','order','request','lose','receipt','duplicate','reconcile']) {
    review.act('scope-1', action, 'Accepted Alpha\nLiteral </textarea> & Ω');
  }
  for (const action of ['approve','order','request','receipt']) review.act('scope-2', action, 'Accepted Beta');
  return { draft, review };
}

test('a reviewed scope before approval exposes a real zero-event state', () => {
  const draft = makeDraft(), review = createScopeReview(draft);
  const history = createScopeHistory(serialize(draft, review));
  assert.equal(history.eventCount, 0);
  assert.equal(history.steps.length, 1);
  const first = history.step(0);
  assert.equal(first.event, null);
  assert.equal(first.snapshot.approved, 0);
  assert.equal(first.snapshot.captured, 0);
  assert.equal(first.snapshot.total, 35125);
  assert.equal(first.snapshot.remaining, 35125);
  assert.equal(first.unallocated, 34875);
  assert.deepEqual(first.checkpoints.map(cp => [cp.id, cp.capture.state, cp.acceptedEvidence]),
    [['scope-1','not_started',null],['scope-2','not_started',null]]);
});

test('authored mixed capture paths retain every exact event and the count-at-that-point', () => {
  const {draft,review} = mixed(), before = serialize(draft, review);
  const history = createScopeHistory(before), events = review.snapshot().events;
  assert.equal(history.eventCount, 11);
  assert.deepEqual(history.steps.map(step => step.index), Array.from({length:12},(_,i)=>i));
  for (const [index,approved,captured,alpha,beta] of [
    [0,0,0,'not_started','not_started'],
    [1,1,0,'not_started','not_started'],
    [2,1,0,'ready','not_started'],
    [3,1,0,'pending','not_started'],
    [4,1,0,'unknown','not_started'],
    [5,1,0,'unknown','not_started'],
    [6,1,0,'unknown','not_started'],
    [7,1,12550,'captured','not_started'],
    [8,2,12550,'captured','not_started'],
    [9,2,12550,'captured','ready'],
    [10,2,12550,'captured','pending'],
    [11,2,35125,'captured','captured']
  ]) {
    const step = history.step(index);
    assert.equal(step.snapshot.approved, approved);
    assert.equal(step.snapshot.captured, captured);
    assert.equal(step.snapshot.remaining, 35125-captured);
    assert.deepEqual(step.checkpoints.map(cp=>cp.capture.state), [alpha,beta]);
    assert.deepEqual(step.event, index ? events[index-1] : null);
  }
  assert.match(history.step(5).description,/unknown.*unresolved/);
  assert.match(history.step(6).description,/without increasing/);
  assert.match(history.step(11).description,/counted once/);
  assert.equal(serialize(draft,review),before);
});

test('accepted evidence starts at its own approval, with unrecorded editor notes excluded', () => {
  const draft = makeDraft(), review = createScopeReview(draft);
  review.act('scope-1','approve','  Accepted Alpha\nLiteral <script> Ω  ');
  const pending = new Map([['scope-2','Pending marker is not history']]);
  const history = createScopeHistory(serialize(draft,review,pending));
  assert.equal(history.step(0).checkpoints[0].acceptedEvidence,null);
  assert.equal(history.step(1).checkpoints[0].acceptedEvidence,'Accepted Alpha\nLiteral <script> Ω');
  assert.equal(history.step(1).checkpoints[1].acceptedEvidence,null);
  assert.equal(history.step(1).checkpoints[0].evidence,'Planned Alpha');
  assert.equal(JSON.stringify(history.step(1)).includes('Pending marker'),false);
  assert.equal(pending.get('scope-2'),'Pending marker is not history');
});

test('captured history and returned steps cannot mutate the current review or another step', () => {
  const {draft,review} = mixed(), before = serialize(draft,review);
  const history = createScopeHistory(before), selected = history.step(7);
  selected.plan.label='Changed';
  selected.plan.checkpoints[0].amount=1;
  selected.event.acceptedEvidence='Changed';
  selected.snapshot.checkpoints['scope-1'].captureStatus='unknown';
  selected.checkpoints[0].acceptedEvidence='Changed';
  const again = history.step(7);
  assert.equal(again.plan.label,'Authored Ω scope');
  assert.equal(again.snapshot.captured,12550);
  assert.equal(again.checkpoints[0].capture.state,'captured');
  assert.equal(again.checkpoints[0].acceptedEvidence,'Accepted Alpha\nLiteral </textarea> & Ω');
  assert.equal(serialize(draft,review),before);
  assert.equal(Object.isFrozen(history),true);
  assert.equal(Object.isFrozen(history.steps),true);
  assert.equal(Object.isFrozen(history.steps[0]),true);
});

test('complete workspace admission refuses a later corrupted event before exposing history', () => {
  const {draft,review} = mixed(), valid = serialize(draft,review);
  const record = JSON.parse(valid);
  record.events.at(-1).amount += 1;
  const invalid = JSON.stringify(record);
  assert.throws(()=>createScopeHistory(invalid),/does not match|amount/i);
  assert.equal(JSON.stringify(record),invalid);
  assert.equal(createScopeHistory(valid).step(11).snapshot.captured,35125);
});

test('drafts, mismatched stage and malformed inputs remain unavailable rather than fabricated history', () => {
  const draft = makeDraft();
  assert.throws(()=>createScopeHistory(encodeScopeWorkspace({draft})),/Review this scope/);
  for (const contents of [null,undefined,{},'', '{bad', '[]']) assert.throws(()=>createScopeHistory(contents),Error);
  const review = createScopeReview(draft);
  review.act('scope-1','approve','Proof');
  const record=JSON.parse(serialize(draft,review));
  record.stage='draft';
  assert.throws(()=>createScopeHistory(JSON.stringify(record)),/draft cannot contain/);
});

test('invalid positions do not alias a real event or change future reads', () => {
  const {draft,review} = mixed(), history = createScopeHistory(serialize(draft,review));
  const current = history.step(11);
  for(const index of [-1,12,0.5,NaN,Infinity,'1',null,true,{},undefined]) {
    assert.throws(()=>history.step(index),RangeError);
  }
  assert.deepEqual(history.step(11),current);
});

test('twelve authored checkpoints and their full recovered histories keep exact identities and totals', () => {
  const draft={label:'Twelve checkpoints',brief:'Bounded fictional review',cap:'1200.00',
    checkpoints:Array.from({length:12},(_,i)=>({title:'Repeated title',amount:String(i+1)+'.01',evidence:'Plan '+i}))};
  const review=createScopeReview(draft);
  for(let i=1;i<=12;i++)for(const action of ['approve','order','request','lose','receipt','duplicate','reconcile'])review.act('scope-'+i,action,'Accepted '+i);
  const history=createScopeHistory(serialize(draft,review));
  assert.equal(history.eventCount,84);
  assert.equal(history.steps.length,85);
  const final=history.step(84);
  assert.deepEqual(final.checkpoints.map(cp=>cp.id),Array.from({length:12},(_,i)=>'scope-'+(i+1)));
  assert.equal(final.snapshot.captured,7812);
  assert.equal(final.snapshot.approved,12);
  assert.equal(final.snapshot.remaining,0);
  assert.equal(final.unallocated,112188);
  assert.equal(history.step(83).checkpoints[11].capture.state,'unknown');
});

test('maximum safe cent values remain integers at historical points', () => {
  const draft={label:'Exact large amount',brief:'Synthetic bound',cap:'90071992547409.91',
    checkpoints:[{title:'Large',amount:'90071992547409.91',evidence:'Proof'}]};
  const review=createScopeReview(draft);
  for(const action of ['approve','order','request','receipt'])review.act('scope-1',action,'Accepted');
  const history=createScopeHistory(serialize(draft,review));
  assert.equal(history.step(3).snapshot.captured,0);
  assert.equal(history.step(3).snapshot.remaining,Number.MAX_SAFE_INTEGER);
  assert.equal(history.step(4).snapshot.captured,Number.MAX_SAFE_INTEGER);
  assert.equal(history.step(4).snapshot.remaining,0);
});
