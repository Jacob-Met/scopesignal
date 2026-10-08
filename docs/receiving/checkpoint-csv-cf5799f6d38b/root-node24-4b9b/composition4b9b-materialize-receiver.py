import pathlib,json,hashlib,base64,gzip,os,sys,difflib
p=pathlib.Path('/dev/shm/scopesignal-node24-cf5799f6d38b-bn07ey3c/composition-4b9b-v1'); prior=p.parent
i=json.loads((p/'index.json').read_bytes())
compressed=base64.b64decode(''.join(json.loads((p/f'part-{n:02}.json').read_bytes())['base64_chunk'] for n in (1,2,3)),validate=True)
assert len(compressed)==i['gzip_bytes'] and hashlib.sha256(compressed).hexdigest()==i['gzip_sha256']
raw=gzip.decompress(compressed); assert len(raw)==i['json_bytes'] and hashlib.sha256(raw).hexdigest()==i['json_sha256']
t=json.loads(raw); expected={f['path']:f for f in json.loads(sys.argv[1])}
assert len(t['files'])==67 and set(expected)=={f['path'] for f in t['files']}
linked=0; created=0
for f in t['files']:
 b=f['content'].encode(); blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(); e=expected[f['path']]
 assert len(b)==f['bytes']==e['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']==e['sha256'] and blob==f['git_blob']==e['git_blob'] and f['mode']==e['mode']
 dest=p/f['path']; assert not dest.exists(); dest.parent.mkdir(parents=True,exist_ok=True); old=prior/f['path']
 if old.is_file() and old.read_bytes()==b and ('100755' if old.stat().st_mode&0o111 else '100644')==f['mode']:
  os.link(old,dest); linked+=1
 else:
  dest.write_bytes(b); dest.chmod(0o755 if f['mode']=='100755' else 0o644); created+=1
print(json.dumps({'verified_source_files':len(t['files']),'bytes':sum(f['bytes'] for f in t['files']),'transport_sha256':hashlib.sha256(raw).hexdigest(),'unchanged_file_links':linked,'separate_new_files':created,'free':os.statvfs(str(p)).f_bavail*os.statvfs(str(p)).f_frsize}))
for path in ('README.md','scope.html','src/scope-workspace.mjs'):
 print(json.dumps({'path':path,'incoming_diff':''.join(difflib.unified_diff((prior/path).read_text().splitlines(True),(p/path).read_text().splitlines(True),fromfile='3146/'+path,tofile='4b9b/'+path))}))
