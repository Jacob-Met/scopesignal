"""Passive full Scope82 source/test/fixture peer; no candidate module execution."""
from pathlib import Path
import hashlib,json,re
P=Path(__file__).resolve().parent
def pin(path):
 raw=path.read_bytes();return dict(path=str(path),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
def short(path):return {k:v for k,v in pin(path).items() if k in ('bytes','sha256')}
delta=json.loads((P/'candidate-source-delta.json').read_bytes())
focused=json.loads((P/'focused-source.json').read_bytes())
assert delta['base']==focused['base']=='10f6233dcc5157afdf0e31371e59eb4fccda0d35'
assert focused['status']=='SOURCE_ONLY_UNRUN'
current_guide=(P/'source/docs/record-event-search.md').read_text()
intermediate=current_guide
for old,new in reversed(focused['guide_clarity_rules']):
 assert intermediate.count(new)==1;intermediate=intermediate.replace(new,old)
assert intermediate==(P/'focused-author-history/guide.before.md').read_text()
rules=0
for record in delta['paths']:
 old=(P/'original'/record['path'].replace('/','__')).read_text()
 new=(P/'source'/record['path']).read_text()
 expected=intermediate if record['path'].startswith('docs/') else new
 assert short(P/'original'/record['path'].replace('/','__'))==record['before']
 forward=old
 for row in record['rules']:
  assert forward.count(row['before'])==row['count'];forward=forward.replace(row['before'],row['after'])
 assert forward==expected
 inverse=expected
 for row in reversed(record['rules']):
  assert inverse.count(row['after'])==row['count'];inverse=inverse.replace(row['after'],row['before'])
 assert inverse==old;rules+=len(record['rules'])
for row in focused['selected']+[focused['manual_fixture'],focused['maintained_regression']]:
 assert short(P/row['path'])=={k:row[k] for k in ('bytes','sha256')}
unchanged=[]
for filename in ('source-input-pins.json','dependency-pins.json'):
 data=json.loads((P/filename).read_bytes())
 for row in data['files']:
  if row['path'] in ('src/record-event-filter.mjs','docs/record-event-search.md'):continue
  raw=(P/'source'/row['path']).read_bytes()
  assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256']
  assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==row['git_blob']
  unchanged.append(row['path'])
test=(P/'source/tests/record-event-disclosure-controls.test.mjs').read_text()
literal=test.split('const MANUAL_RECORD = ',1)[1].split(';\nconst labels',1)[0]
fixture=json.loads((P/'examples/shown-events.fixture.json').read_bytes())
assert json.loads(literal)==fixture and (literal+'\n').encode()==(P/'examples/shown-events.fixture.json').read_bytes()
assert fixture['fixtureOnly'] is True and fixture['paymentEvidence'] is False
assert fixture['summary']==dict(total=120000,approved=2,captured=40000,remaining=80000)
assert [row['seq'] for row in fixture['events']]==list(range(1,9))
assert [row['type'] for row in fixture['events']]==['checkpoint.approved','paypal.order.created','paypal.capture.requested','paypal.capture.response_lost','paypal.webhook.received','paypal.webhook.received','paypal.capture.reconciled','checkpoint.approved']
assert fixture['events'][4]['duplicate'] is False and fixture['events'][5]['duplicate'] is True
assert fixture['events'][4]['eventId']==fixture['events'][5]['eventId']=='WH-SHOWN-001'
assert [r['capture']['counted'] for r in fixture['checkpoints']]==[40000,0,0]
groups=re.findall(r"^test\('([^']+)'",test,re.M);assert len(groups)==4
old_tests=(P/'source/tests/record-event-search.test.mjs').read_text()
assert len(re.findall(r'^test\(',old_tests,re.M))==4
implementation=(P/'source/src/record-event-filter.mjs').read_text()
assert implementation.count('disclosures[index].open = open;')==1
assert 'if (button.disabled) return;' in implementation and 'if (row.hidden) return;' in implementation
assert 'expand.disabled = collapse.disabled = shown === 0;' in implementation
assert implementation.count('.focus()')==1 and 'checkpoint.focus();' in implementation
result=dict(schema='scopesignal.shown-disclosures.machine-source-review/1',status='ACCEPT_THREE_PATH_SOURCE_AND_EIGHT_FOCUSED_TEST_PLAN',
 base=focused['base'],files=[pin(P/row['path']) for row in focused['selected']],fixture=pin(P/'examples/shown-events.fixture.json'),
 existing_regression=pin(P/'source/tests/record-event-search.test.mjs'),complete_candidate_inverse_rules=rules,
 guide_qualification_rules=len(focused['guide_clarity_rules']),unchanged_dependencies=unchanged,manual_fixture_literal_exact=True,
 focused_groups=groups,existing_groups=4,findings=[],
 reviewed_behavior=['Only existing last-applied visible details.open properties change; hidden state and node/event identity remain.',
 'Invalid overlength query leaves the previous visible set actionable without clearing error or count; zero/empty actions are disabled and guarded.',
 'Reset/repeat/detached panel ownership, reference conservation, full JSON and complete exporter equality are explicit controls.',
 'Manual eight-event fixture has consistent approval/lost-response/duplicate/reconciliation totals; 512-event duplicate boundary retains all rows.',
 'No focus change from new handlers; declared DOM harness cannot establish actual keyboard/layout/accessibility. Historical issue80 receiving is explicitly separate.'],
 qualification='Complete implementation, new test, fixture, guide and relevant unchanged view/search/ledger/download/CSS source read. Passive byte/Git joins and whole forward/inverses only; no candidate, test, browser, native, provider or workflow invocation. Default/Pages/Actions hold remains. Root controls the single local focused run and later publication.')
with (P/'machine-source-review.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(dict(status=result['status'],proof=pin(P/'machine-source-review.json'),focused_groups=8)))
