"""Prepare the finite ScopeSignal review kit from accepted immutable bodies; do not run it."""
from pathlib import Path
import hashlib,json

D=Path(__file__).resolve().parent
O=D.parent/'scopesignal-visible-events-opportunity'
SOURCE_REVISION='dcad391d11a66a43df32ae1051a48c5ebd22ff34'
SOURCE_TREE='bf8910efa55be40da9a872823f02be5195b2a6f6'
BASE_REVISION='10f6233dcc5157afdf0e31371e59eb4fccda0d35'
DEFAULT_REVISION='a8e7ab95e5b9dd4c93fd06a776391d57d81a9515'

def pin(data):
    return {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
            'git_blob':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()}

assert SOURCE_REVISION and SOURCE_TREE,'Final verified nondefault source offer is required'
assert not (D/'payload').exists() and not (D/'kit-selection.json').exists()
recovery=json.loads((D/'recovery/recovery-proof.json').read_bytes())
assert recovery['file_count']==48 and recovery['total_bytes']==265956
tree=json.loads((D/'source-offer-tree.json').read_bytes())
assert tree['sha']==SOURCE_TREE and not tree['truncated']
leaves={r['path']:r for r in tree['tree'] if r['type']=='blob'}
assert len(leaves)==835
result=json.loads((O/'root-focused-result-review.json').read_bytes())
assert result['status']=='ACCEPT_ORIGINAL_EIGHT_FOCUSED_GROUPS' and result['groups']==8
source={}
for row in recovery['files']:
    raw=(D/'recovery/source'/row['path']).read_bytes()
    assert pin(raw)=={'bytes':row['bytes'],'sha256':row['sha256'],'git_blob':row['git_blob_sha']}
    source[row['path']]=raw
source['src/record-event-filter.mjs']=(O/'source/src/record-event-filter.mjs').read_bytes()
for name in ['docs/record-event-search.md','tests/record-event-search.test.mjs','tests/record-event-disclosure-controls.test.mjs']:
    source[name]=(O/'source'/name).read_bytes()
assert len(source)==51
for name,raw in source.items():
    row=leaves[name];actual=pin(raw)
    assert row['mode']=='100644' and row['size']==actual['bytes'] and row['sha']==actual['git_blob'],name
fixture=(O/'examples/shown-events.fixture.json').read_bytes()
assert pin(fixture)['sha256']=='8639e3ac91311f7b3d50082bc7424a605f7d83fbc49b1a40b7916399cda6e942' and len(fixture)==3520
fixture_model=json.loads(fixture)
test=source['tests/record-event-disclosure-controls.test.mjs'].decode('utf-8')
literal=test.split('const MANUAL_RECORD = ',1)[1].split(';',1)[0]
assert json.loads(literal)==fixture_model and len(fixture_model['events'])==8
opening=(D/'OPEN_FIRST-draft.md').read_text(encoding='utf-8')
old_source='SOURCE_OFFER_PENDING'
new_source=(f"Source offer: [ScopeSignal {SOURCE_REVISION[:8]}](https://github.com/Jacob-Met/scopesignal/tree/{SOURCE_REVISION}), "
            f"an isolated nondefault successor to the accepted search offer {BASE_REVISION[:8]}. "
            "The new filter, new focused test and narrow maintained guide change are the only product changes. "
            "The default branch, Pages deployment and workflow configuration remain unchanged.")
old_status='FOCUSED_STATUS_PENDING'
new_status=("One original focused Node capture passed all eight groups: four new disclosure groups and four maintained literal-search groups. "
            "The original output and exact source/fixture identities were independently reviewed. "
            "The complete fictional record, hidden/open states, original node identities, no-match behavior, invalid-query last-view handling, "
            "full-record exports and the 512-event boundary are covered.")
assert opening.count(old_source)==opening.count(old_status)==1
opening=opening.replace(old_source,new_source).replace(old_status,new_status)
assert 'SOURCE_OFFER_PENDING' not in opening and 'FOCUSED_STATUS_PENDING' not in opening
bodies=dict(source)
bodies['examples/shown-events.fixture.json']=fixture
bodies['OPEN_FIRST.md']=opening.encode('utf-8')
manifest=[]
for name,raw in sorted(bodies.items()):
    role='source' if name in source else ('manual_fixture' if name.startswith('examples/') else 'opening_guide')
    manifest.append({'path':name,**pin(raw),'role':role,'source_revision':SOURCE_REVISION if name in source else None})
source_manifest={
 'schema':'scopesignal.shown-events.review-kit.source/1',
 'status':'VERIFIED_NONDEFAULT_SOURCE_PREPARED_TRANSFER_AND_BROWSER_RECEIVING_PENDING',
 'repository':'Jacob-Met/scopesignal','source_revision':SOURCE_REVISION,'source_tree':SOURCE_TREE,
 'base_revision':BASE_REVISION,'held_default_revision':DEFAULT_REVISION,
 'source_files':sorted(source),'files':manifest,
 'entrypoint':'record.html','server_command':['node','scripts/serve.mjs'],'server_cwd':'extracted kit root',
 'runtime_requirement':'Node.js >=24; no external package installation',
 'example':'examples/shown-events.fixture.json',
 'focused_result':{'groups':8,'new':4,'maintained':4,'stdout':result['stdout'],'stderr':result['stderr'],'scope':'Controlled DOM and model/export checks; no browser claim'},
 'external_references':[
  {'file':'styles.css','purpose':'Unchanged optional Google Fonts stylesheet with installed-font fallbacks'},
  {'file':'index.html','purpose':'GitHub source navigation link'}],
 'qualification':'The 51 maintained source bodies join one verified nondefault source tree. The fictional example is exactly the manual test literal. OPEN_FIRST and this manifest are package documents. Transfer and new browser receiving are pending in this preserved preparation snapshot; historical issue80 receiving remains separate. No default update, deployment, server, test or browser execution occurred during kit preparation.'
}
bodies['SOURCE.json']=(json.dumps(source_manifest,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
assert len(bodies)==54 and len(manifest)==53
payload=D/'payload'
for name,raw in sorted(bodies.items()):
    path=payload/name;path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('xb') as stream:assert stream.write(raw)==len(raw)
entries=list(payload.rglob('*'))
assert all(not p.is_symlink() for p in entries)
assert sum(p.is_file() for p in entries)==54
assert sum(p.is_dir() for p in entries)==5
selection={'schema':'scopesignal.shown-events.review-kit.selection/1',
 'status':'PREPARED_PENDING_INDEPENDENT_PACKAGE_REVIEW',
 'source_revision':SOURCE_REVISION,'source_tree':SOURCE_TREE,'base_revision':BASE_REVISION,
 'regular_files':54,'typed_entries':60,'payload_bytes':sum(map(len,bodies.values())),
 'files':[{'path':name,**pin(raw)} for name,raw in sorted(bodies.items())]}
proof={'schema':'scopesignal.shown-events.review-kit.preparation/1','status':'ACCEPT_WHOLE_SOURCE_TREE_AND_FIXED_PLAYABLE_SELECTION',
 'recovery':pin((D/'recovery/recovery-proof.json').read_bytes()),'root_focused_review':pin((O/'root-focused-result-review.json').read_bytes()),
 'source_offer':SOURCE_REVISION,'source_tree':SOURCE_TREE,'source_bodies':51,'unchanged_recovery_bodies':47,
 'new_filter':pin(source['src/record-event-filter.mjs']),'manual_fixture':pin(fixture),'manual_fixture_literal_equal':True,
 'opening_projection':[{'old':old_source,'new':new_source},{'old':old_status,'new':new_status}],
 'opening_inverse':opening.replace(new_source,old_source).replace(new_status,old_status)==(D/'OPEN_FIRST-draft.md').read_text(encoding='utf-8'),
 'selection':selection,'qualification':'Data-only source/package preparation. No server, import, test, browser, native process or network request invoked.'}
for name,value in [('kit-selection.json',selection),('kit-preparation.json',proof)]:
    with (D/name).open('x',encoding='utf-8',newline='\n') as stream:json.dump(value,stream,indent=2,ensure_ascii=False);stream.write('\n')
print(json.dumps({'status':proof['status'],'files':54,'typed_entries':60,'payload_bytes':selection['payload_bytes'],'source_revision':SOURCE_REVISION}))

