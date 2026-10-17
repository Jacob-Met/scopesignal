"""Prepare a fixed three-original ordinary receiver without invoking it."""
from pathlib import Path
import ast, difflib, hashlib, json
D=Path(__file__).resolve().parent
donor=D.parent/'replay-forge-studio-clip-context-delivery/receive-artifacts.py'
old=donor.read_text()
old_items=old[old.index('items=['):old.index('\nrows=[]')]
new_items="""items=[
 ('desktop_png',ids['desktop_png'],'image/png',None,None,ORIGINAL_ROOT/'browser-v1/events-desktop.png','fresh-scopesignal-events-desktop.png'),
 ('narrow_png',ids['narrow_png'],'image/png',None,None,ORIGINAL_ROOT/'browser-v1/events-narrow.png','fresh-scopesignal-events-narrow.png'),
 ('review_html',ids['review_html'],'text/html',None,None,ORIGINAL_ROOT/'browser-v1/downloads/scopesignal-record-review.html','fresh-scopesignal-record-review.html')]"""
rules=[
 ("D=Path(__file__).resolve().parent\n", "D=Path(__file__).resolve().parent\nORIGINAL_ROOT = None\nassert isinstance(ORIGINAL_ROOT, Path) and ORIGINAL_ROOT.is_absolute(), 'Accepted local original root must be bound'\n"),
 ("{'containing_png', 'retained_json', 'containing_json', 'retained_png', 'fallback_json', 'fallback_png'}", "{'desktop_png', 'narrow_png', 'review_html'}"),
 ('len(set(ids.values()))==6','len(set(ids.values()))==3'),
 (old_items,new_items),
 ('replay-forge.studio-clip-context.original-artifact-delivery/1','scopesignal.shown-events.original-artifact-delivery/1'),
 ('ACCEPT_SIX_ORIGINAL_ARTIFACTS_AND_ORDINARY_FRESH_RECEIVING','ACCEPT_THREE_ORIGINAL_ARTIFACTS_AND_ORDINARY_FRESH_RECEIVING'),
 ('One upload and one ordinary fresh raw-file fetch for each of three original PNGs and three original exported session JSON bodies; exact whole bytes, no conversion or browser replay.','One upload and one ordinary fresh raw-file fetch for each of two original PNGs and the original complete downloaded HTML review; exact whole bytes, no conversion or browser replay.')]
new=old
for a,b in rules:
 assert new.count(a)==1
 new=new.replace(a,b)
inverse=new
for a,b in reversed(rules):
 assert inverse.count(b)==1
 inverse=inverse.replace(b,a)
assert inverse==old
ast.parse(new)
def pin(s):
 raw=s.encode();return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
proof={'schema':'scopesignal.shown-events.artifact-receiver-source/1','status':'UNBOUND_THREE_ORIGINALS_SOURCE_ONLY','donor_path':str(donor),'donor':pin(old),'current':pin(new),'rules':[{'before':a,'after':b,'count':1} for a,b in rules],'whole_inverse':True,'original_root':None,'original_names':['browser-v1/events-desktop.png','browser-v1/events-narrow.png','browser-v1/downloads/scopesignal-record-review.html'],'actual_tuples':[None,None,None],'eyes_parent':'1Fa24MIEeJuKgF2jLjEjwvpqY4PDOInp8','qualification':'The accepted finite ordinary receiving loop is unchanged. Exact extraction root and three byte/hash pairs remain unset pending original custody, semantics and visual acceptance. Maintained 30-second timeout is per socket request, not a combined wall-clock bound. No receiver, network, upload, native or browser invocation.'}
for name,body in [('receive-artifacts.py',new),('artifact-receiver-donor.py',old),('artifact-receiver.patch',''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='accepted-studio-receiver',tofile='scope-three-unbound'))),('artifact-receiver-source.json',json.dumps(proof,indent=2)+'\n')]:
 with (D/name).open('x',encoding='utf-8',newline='\n') as f:f.write(body)
print(json.dumps({k:v for k,v in proof.items() if k!='rules'}))
