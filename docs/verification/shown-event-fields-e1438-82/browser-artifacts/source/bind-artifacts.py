"""Bind the accepted R2 root and three exact original artifact tuples."""
from pathlib import Path
import ast,difflib,hashlib,json
D=Path(__file__).resolve().parent
N=D.parent/'scopesignal-visible-events-native'
ROOT=N/'browser-received-v2'
def pin(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def load(p):return json.loads(p.read_bytes())
def write(name,raw):
 with (D/name).open('xb') as stream:assert stream.write(raw)==len(raw)
source=(D/'receive-artifacts.py').read_bytes()
assert pin(source)=={'bytes':2372,'sha256':'310d38220bc8ac53ecc53e6b39dc4f17767743f76d03155badc216aa80312595'}
root=load(N/'root-v2-original-review.json');peer=load(N/'machine-v2-original-review.json')
assert root['status']=='PASS' and peer['status']=='ACCEPT_COMPLETE_EIGHT_STATE_REVIEW_DOWNLOAD_AND_OBSERVED_NORMAL_CLOSE'
items=[('desktop_png','image/png','events-desktop.png','fresh-scopesignal-events-desktop.png'),
 ('narrow_png','image/png','events-narrow.png','fresh-scopesignal-events-narrow.png'),
 ('review_html','text/html','downloads/scopesignal-record-review.html','fresh-scopesignal-record-review.html')]
accepted={r['path']:{k:r[k] for k in ('bytes','sha256')} for r in peer['originals']}
rules=[('ORIGINAL_ROOT = None','ORIGINAL_ROOT = Path('+repr(str(ROOT))+')')]
originals=[]
for label,mime,rel,destination in items:
 path=ROOT/'browser-v2'/rel;observed=pin(path.read_bytes());assert observed==accepted[str(path)]
 before=f"('{label}',ids['{label}'],'{mime}',None,None,ORIGINAL_ROOT/'browser-v1/{rel}','{destination}')"
 after=f"('{label}',ids['{label}'],'{mime}',{observed['bytes']},'{observed['sha256']}',ORIGINAL_ROOT/'browser-v2/{rel}','{destination}')"
 rules.append((before,after));originals.append({'label':label,'path':str(path),'mime_type':mime,**observed})
current=source.decode()
for before,after in rules:
 assert current.count(before)==1
 current=current.replace(before,after)
inverse=current
for before,after in reversed(rules):
 assert inverse.count(after)==1
 inverse=inverse.replace(after,before)
assert inverse.encode()==source;ast.parse(current)
write('receive-artifacts.unbound.py',source)
write('artifact-binding.patch',''.join(difflib.unified_diff(source.decode().splitlines(True),current.splitlines(True),fromfile='receive-artifacts.unbound.py',tofile='receive-artifacts.py')).encode())
(D/'receive-artifacts.py').write_bytes(current.encode())
proof={'schema':'scopesignal.shown-events.artifact-binding/1','status':'BOUND_THREE_ACCEPTED_R2_ORIGINAL_ARTIFACTS',
 'before':pin(source),'after':pin(current.encode()),'root_review':pin((N/'root-v2-original-review.json').read_bytes()),
 'independent_review':pin((N/'machine-v2-original-review.json').read_bytes()),'originals':originals,
 'rules':[{'before':a,'after':b,'count':1} for a,b in rules],'whole_inverse':True,
 'qualification':'Only accepted root and three complete file tuples bound, including browser-v2 original paths. Existing ordinary receiving logic unchanged; R1 incomplete course remains separate. No upload, fetch or product execution in this source binding.'}
write('artifact-binding.json',(json.dumps(proof,indent=2)+'\n').encode())
print(json.dumps({k:v for k,v in proof.items() if k!='rules'}))
