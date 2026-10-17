from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse
import json,hashlib
D=Path(__file__).resolve().parent
ORIGINAL_ROOT = Path('/workspace/scratch/e1438c9d058f/scopesignal-visible-events-native/browser-received-v2')
assert isinstance(ORIGINAL_ROOT, Path) and ORIGINAL_ROOT.is_absolute(), 'Accepted local original root must be bound'
ids=json.loads((D/'artifact-upload-ids.json').read_text())
assert set(ids)=={'desktop_png', 'narrow_png', 'review_html'} and all(isinstance(v,str) and v for v in ids.values())
assert len(set(ids.values()))==3
items=[
 ('desktop_png',ids['desktop_png'],'image/png',58217,'7d2d77085bd4a0fcea080dce4cdc9c3444124d73fbe4692d3aa377e3a4fa43f9',ORIGINAL_ROOT/'browser-v2/events-desktop.png','fresh-scopesignal-events-desktop.png'),
 ('narrow_png',ids['narrow_png'],'image/png',40351,'02000859b760342c763fbb1c45560e6252c2118c245f9b6c44f5e7295f579857',ORIGINAL_ROOT/'browser-v2/events-narrow.png','fresh-scopesignal-events-narrow.png'),
 ('review_html',ids['review_html'],'text/html',13519,'414e1212721e42d8cd827167090cf446ed5dd2f039f1538d636392bf4c7e52f4',ORIGINAL_ROOT/'browser-v2/downloads/scopesignal-record-review.html','fresh-scopesignal-record-review.html')]
rows=[]
for label,file_id,mime,size,sha,original,name in items:
 info=json.loads((D/(label+'-fetch.private.json')).read_text())['response']['structuredContent']
 assert (info['id'],info['mime_type'],info['file_size_bytes'])==(file_id,mime,size)
 assert info['parent_ids']==['1Fa24MIEeJuKgF2jLjEjwvpqY4PDOInp8']
 url=info['file_uri']['download_url'];u=urlparse(url);assert u.scheme=='https' and u.hostname.endswith('.oaiusercontent.com')
 dest=D/name;assert not dest.exists()
 with urlopen(url,timeout=30) as response:
  status=response.status;body=response.read(size+1);assert status==200
 assert len(body)==size and hashlib.sha256(body).hexdigest()==sha and body==original.read_bytes()
 with dest.open('xb') as f:f.write(body)
 rows.append({'label':label,'id':file_id,'url':info['url'],'mime_type':mime,'parent_ids':info['parent_ids'],'bytes':size,'sha256':sha,'http_status':status,'fresh_path':str(dest),'original_path':str(original),'whole_bytes_equal':True})
proof={'schema':'scopesignal.shown-events.original-artifact-delivery/1','status':'ACCEPT_THREE_ORIGINAL_ARTIFACTS_AND_ORDINARY_FRESH_RECEIVING','files':rows,'qualification':'One upload and one ordinary fresh raw-file fetch for each of two original PNGs and the original complete downloaded HTML review; exact whole bytes, no conversion or browser replay.'}
(D/'artifact-delivery.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))

