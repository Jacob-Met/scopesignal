from pathlib import Path
import base64,hashlib,tarfile,io,json,subprocess,os,signal,shutil,time
root=Path('/Users/me/hamon-scopesignal-draft-receiving-cd1df0f1ee24')
r=root/'workspace-boundary-8a'
archive=base64.b64decode((root/'workspace-boundary-8a.b64').read_text(),validate=True)
assert hashlib.sha256(archive).hexdigest()=='4b88b1cadf9cd9ce430d2233ec8ab1113cabfac9439f1f75bbd4edf6a07721fc'
r.mkdir(exist_ok=False)
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
 for x in t.getmembers():
  p=Path(x.name)
  assert not p.is_absolute() and '..' not in p.parts and not x.issym() and not x.islnk()
 t.extractall(r,filter='data')
m=json.loads((r/'source-manifest-8a.json').read_text())
probes=json.loads((r/'probe-freeze-manifest.json').read_text())
def verify():
 bad=[]
 for f in m['files']:
  d=(r/'baseline-8a'/f['path']).read_bytes()
  if hashlib.sha256(d).hexdigest()!=f['sha256'] or hashlib.sha1(b'blob '+str(len(d)).encode()+b'\0'+d).hexdigest()!=f['sha']:bad.append(f['path'])
 for f in probes['files']:
  d=(r/f['path']).read_bytes()
  if hashlib.sha256(d).hexdigest()!=f['sha256']:bad.append(f['path'])
 return bad
assert not verify()
assert len([p for p in (r/'baseline-8a').rglob('*') if p.is_file()])==44
free=shutil.disk_usage(root).free
if free<80_000_000:raise RuntimeError('Native receiving storage below80MB; no browser started')
env=os.environ.copy()
env.pop('SCOPESIGNAL_PUBLIC_URL',None);env.pop('SCOPESIGNAL_EXPECTED_COMMIT',None)
env.update({'SCOPESIGNAL_SOURCE':str(r/'baseline-8a'),'SCOPESIGNAL_MANIFEST':str(r/'source-manifest-8a.json'),'SCOPESIGNAL_EVIDENCE':str(r/'baseline-evidence'),'SCOPESIGNAL_FIXTURES':str(r/'fixtures'),'SCOPESIGNAL_PUPPETEER':'/Users/me/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js','SCOPESIGNAL_CHROME':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','TMPDIR':str(root/'tmp')})
start=time.monotonic()
with (r/'native-driver.stdout').open('w') as out,(r/'native-driver.stderr').open('w') as err:
 p=subprocess.Popen(['/opt/homebrew/bin/node',str(r/'check-workspace-boundaries.mjs')],cwd=r,env=env,stdout=out,stderr=err,start_new_session=True)
 try:rc=p.wait(timeout=90)
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
  rc=124
receipt=json.loads((r/'baseline-evidence/receipt.json').read_text()) if (r/'baseline-evidence/receipt.json').exists() else None
summary={'exit':rc,'seconds':time.monotonic()-start,'source_and_probe_mismatches':verify(),'source_files':len(m['files']),'free_before':free,'free_after':shutil.disk_usage(root).free,'receipt':receipt,'stderr':(r/'native-driver.stderr').read_text()[:2000]}
(r/'native-driver.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'exit':rc,'seconds':summary['seconds'],'source_and_probe_mismatches':summary['source_and_probe_mismatches'],'counts':receipt.get('counts') if receipt else None,'fatal':receipt.get('fatal') if receipt else None,'cases':[{'name':x['name'],'passed':x['passed'],'error':x.get('error'),'checked':x.get('checked'),'applied':x.get('applied'),'after_selection':x.get('after_selection'),'after_apply_attempt':x.get('after_apply_attempt')} for x in receipt['cases']] if receipt else [],'stderr':summary['stderr']}))

