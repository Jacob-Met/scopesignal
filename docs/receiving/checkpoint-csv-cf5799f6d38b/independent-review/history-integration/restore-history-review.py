#!/usr/bin/env python3
"""Restore the original independent packet plus this additive integration packet."""
import hashlib,json,pathlib,shutil,subprocess,sys
here=pathlib.Path(__file__).resolve().parent
original=pathlib.Path(sys.argv[1]).resolve();target=pathlib.Path(sys.argv[2]).resolve()
if target.exists():raise SystemExit('Choose a new private destination.')
subprocess.run([sys.executable,str(original/'unpack-review.py'),str(target)],check=True)
for name in ['scope-v1.json','candidate-source-manifest.json']:
    (target/name).rename(target/('prior-csv-'+name))
for name in ['scope-v1.json','history-browser-v1.mjs','make-history-fixture-v1.mjs','history-native-fixture-v1.json','final-integration-proof.json']:
    shutil.copy2(here/name,target/name)
restored=5
for name in ['source-contract-archive.json','raw-receipts-archive.json']:
    for row in json.loads((here/name).read_text())['files']:
        rel=pathlib.PurePosixPath(row['path'])
        if rel.is_absolute() or '..' in rel.parts:raise SystemExit('Unsafe archive path')
        data=row['content'].encode()
        assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['git_blob']
        dest=target/rel
        if dest.exists():raise SystemExit('Duplicate archive path: '+str(rel))
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        dest.chmod(0o755 if row['mode']=='100755' else 0o644);restored+=1
print(json.dumps({'additional_restored_files':restored,'target':str(target)}))
