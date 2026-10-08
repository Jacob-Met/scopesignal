#!/usr/bin/env python3
"""Restore this exact compact receiving packet into a new private directory."""
import hashlib, json, pathlib, shutil, sys
here=pathlib.Path(__file__).resolve().parent
target=pathlib.Path(sys.argv[1]).resolve()
if target.exists(): raise SystemExit('Choose a new output directory; existing files are never overwritten.')
target.mkdir(parents=True)
direct=['scope-v1.json','make-baseline-fixtures-v1.mjs','native-independent-v1.mjs','browser-independent-v1.mjs','browser-independent-v1-diagnostic.mjs','browser-independent-v2.mjs','native-browser-diagnostic-v1.mjs','baseline-native-fixtures-v1.json','final-custody-and-receiver-proof.json']
for name in direct: shutil.copy2(here/name,target/name)
count=len(direct)
for name in ['source-contract-archive.json','raw-receipts-archive.json']:
    archive=json.loads((here/name).read_text())
    for row in archive['files']:
        rel=pathlib.PurePosixPath(row['path'])
        if rel.is_absolute() or '..' in rel.parts: raise SystemExit('Unsafe archive path')
        data=row['content'].encode('utf-8')
        assert len(data)==row['bytes']
        assert hashlib.sha256(data).hexdigest()==row['sha256']
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['git_blob']
        path=target/rel
        if path.exists(): raise SystemExit('Duplicate archive path: '+str(rel))
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        path.chmod(0o755 if row['mode']=='100755' else 0o644);count+=1
print(json.dumps({'restored_files':count,'target':str(target)}))
