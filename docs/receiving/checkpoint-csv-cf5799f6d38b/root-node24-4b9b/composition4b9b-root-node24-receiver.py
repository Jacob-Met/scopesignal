import pathlib,json,hashlib,base64,gzip,subprocess,os,datetime,time,sys
p=pathlib.Path('/dev/shm/scopesignal-node24-cf5799f6d38b-bn07ey3c/composition-4b9b-v1')
expected=json.loads(sys.argv[1]); em={f['path']:f for f in expected}
t=json.loads(gzip.decompress(base64.b64decode(''.join(json.loads((p/f'part-{n:02}.json').read_bytes())['base64_chunk'] for n in (1,2,3)))))
assert len(t['files'])==67 and set(em)=={f['path'] for f in t['files']}
def verify():
 result=[]
 for f in t['files']:
  b=(p/f['path']).read_bytes(); sha=hashlib.sha256(b).hexdigest(); blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(); mode='100755' if (p/f['path']).stat().st_mode & 0o111 else '100644'
  assert len(b)==f['bytes'] and sha==f['sha256'] and blob==f['git_blob'] and mode==f['mode']
  assert em[f['path']]['git_blob']==blob and em[f['path']]['mode']==mode
  result.append({'path':f['path'],'bytes':len(b),'sha256':sha,'git_blob':blob,'mode':mode})
 return result
before=verify()
node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
version=subprocess.check_output([node,'--version'],text=True).strip(); assert version.startswith('v24.')
rp=p/'root-node24-receipt.json'; assert not rp.exists()
receipt={'schema':'scopesignal.root-supported-node24-receiving.v1','source_tree':'4b9b2580dc31811bdac98109a2763fc34c91a6cd','base_commit':'fb6d8771db190fc6499db0c63644ef8a016fe7b7','base_tree':'48f0cdfd20f79ab96893de6d0adb5d23cdcab5a6','full_candidate_leaves':576,'closure_count':67,'closure_bytes':sum(x['bytes'] for x in before),'closure_policy':'All top-level runtime files, src/, scripts/, tests/; omitted docs/out contain no discovered Node test files. Every closure Git blob independently matches official baseline plus exact verified8-file contribution.','source_transfer_sha256':'f8d26cc3018c2d1ace2fe17da8fcd4e22d47634fd9341ef4708fc9e0660386cd','node':node,'node_version':version,'command':[node,'--test'],'cwd':str(p),'dependency_installs':False,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'before':before}
rp.write_text(json.dumps(receipt,indent=2)+'\n')
started=time.monotonic()
with (p/'root-node24.stdout.log').open('xb') as out,(p/'root-node24.stderr.log').open('xb') as err:
 run=subprocess.run([node,'--test'],cwd=str(p),stdout=out,stderr=err,timeout=90)
receipt.update({'exit_code':run.returncode,'elapsed_seconds':round(time.monotonic()-started,6),'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'after':verify()})
prior_raw=(p.parent/'root-node24-receipt.json').read_bytes()
assert hashlib.sha256(prior_raw).hexdigest()=='50e2277171777c403e248e12e436ba4f2b46521a2af089a804d9d059a352d72b'
for f in json.loads(prior_raw)['before']:
 b=(p.parent/f['path']).read_bytes(); assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
receipt.update({'prior_3146_source_files_retained_exact':61,'prior_root_receipt_sha256':hashlib.sha256(prior_raw).hexdigest(),'materialization':'58 identical files linked read-only in use;9 current/new files separately written. Both qualified source sets remain exact.'})
for name in ('stdout','stderr'):
 a=p/f'root-node24.{name}.log'; b=a.read_bytes(); receipt[name]={'path':str(a),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
rp.write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ('before','after')},indent=2))
print((p/'root-node24.stdout.log').read_text()[-2200:])
print((p/'root-node24.stderr.log').read_text()[-1000:])
sys.exit(run.returncode)
