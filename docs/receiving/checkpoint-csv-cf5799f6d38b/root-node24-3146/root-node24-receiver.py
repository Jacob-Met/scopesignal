import pathlib,json,hashlib,base64,gzip,subprocess,os,datetime,time,sys
p=pathlib.Path('/dev/shm/scopesignal-node24-cf5799f6d38b-bn07ey3c')
expected=json.loads(sys.argv[1]); em={f['path']:f for f in expected}
t=json.loads(gzip.decompress(base64.b64decode(''.join(json.loads((p/f'part-{n:02}.json').read_bytes())['base64_chunk'] for n in (1,2)))))
assert len(t['files'])==61 and set(em)=={f['path'] for f in t['files']}
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
receipt={'schema':'scopesignal.root-supported-node24-receiving.v1','source_tree':'3146dd1d196d0d0545bcdd2d3db3244c0b0bf7d5','base_commit':'847505d2fe9f8295110fc13a3fb9e05ec71f6644','base_tree':'cac1d2bbdd38e2e4c2aed7249c2593ec174c0eaa','full_candidate_leaves':527,'closure_count':61,'closure_bytes':sum(x['bytes'] for x in before),'closure_policy':'All top-level runtime files, src/, scripts/, tests/; omitted docs/out contain no discovered Node test files. Every closure Git blob independently matches official baseline plus exact verified8-file contribution.','source_transfer_sha256':'89c216bac96af50db1d6cc721a1de78c708221767f6e70254f37eb5626e71c56','node':node,'node_version':version,'command':[node,'--test'],'cwd':str(p),'dependency_installs':False,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'before':before}
rp.write_text(json.dumps(receipt,indent=2)+'\n')
started=time.monotonic()
with (p/'root-node24.stdout.log').open('xb') as out,(p/'root-node24.stderr.log').open('xb') as err:
 run=subprocess.run([node,'--test'],cwd=str(p),stdout=out,stderr=err,timeout=90)
receipt.update({'exit_code':run.returncode,'elapsed_seconds':round(time.monotonic()-started,6),'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'after':verify()})
for name in ('stdout','stderr'):
 a=p/f'root-node24.{name}.log'; b=a.read_bytes(); receipt[name]={'path':str(a),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
rp.write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ('before','after')},indent=2))
print((p/'root-node24.stdout.log').read_text()[-2200:])
print((p/'root-node24.stderr.log').read_text()[-1000:])
sys.exit(run.returncode)
