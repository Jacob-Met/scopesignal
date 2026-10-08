from pathlib import Path
import base64,hashlib,tarfile,io,json,subprocess,os,signal,shutil,time
root=Path('/Users/me/hamon-scopesignal-draft-receiving-cd1df0f1ee24')
r=root/'workspace-boundary-candidate-v1'
archive=base64.b64decode((root/'workspace-boundary-candidate-v1.b64').read_text(),validate=True)
assert hashlib.sha256(archive).hexdigest()=='d9e5fa758c5da490e4d4adfb5d123c76d1d9d9d5a9bfe20adfae69ac0af613f0'
r.mkdir(exist_ok=False)
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
 for x in t.getmembers():
  p=Path(x.name);assert not p.is_absolute() and '..' not in p.parts and not x.issym() and not x.islnk()
 t.extractall(r,filter='data')
m=json.loads((r/'source-manifest-candidate-v1.json').read_text())
probeFiles=[]
for name in ['probe-freeze-manifest.json','review-history-probe-manifest.json']:probeFiles.extend(json.loads((r/name).read_text())['files'])
def verify():
 bad=[]
 for f in m['files']:
  d=(r/'candidate'/f['path']).read_bytes()
  if hashlib.sha256(d).hexdigest()!=f['sha256'] or hashlib.sha1(b'blob '+str(len(d)).encode()+b'\0'+d).hexdigest()!=f['git_blob']:bad.append(f['path'])
 for f in probeFiles:
  if hashlib.sha256((r/f['path']).read_bytes()).hexdigest()!=f['sha256']:bad.append(f['path'])
 return bad
assert not verify()
assert len([p for p in (r/'candidate').rglob('*') if p.is_file()])==45
free=shutil.disk_usage(root).free
if free<80_000_000:raise RuntimeError('Native receiving storage below80MB; no browser started')
env=os.environ.copy()
env.pop('SCOPESIGNAL_PUBLIC_URL',None);env.pop('SCOPESIGNAL_EXPECTED_COMMIT',None)
env.update({'SCOPESIGNAL_SOURCE':str(r/'candidate'),'SCOPESIGNAL_MANIFEST':str(r/'source-manifest-candidate-v1.json'),'SCOPESIGNAL_FIXTURES':str(r/'fixtures'),'SCOPESIGNAL_PUPPETEER':'/Users/me/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js','SCOPESIGNAL_CHROME':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','TMPDIR':str(root/'tmp')})
summary={'source_base':m['source_base'],'source_files':45,'unchanged_inherited_source_files':41,'free_before':free,'lead_freeze_manifest_sha256':m['lead_freeze_manifest_sha256'],'runs':[]}
for name,script in [('candidate-boundary-evidence','check-workspace-boundaries.mjs'),('candidate-history-evidence','check-workspace-review-history.mjs')]:
 assert not verify()
 env['SCOPESIGNAL_EVIDENCE']=str(r/name);start=time.monotonic()
 with (r/(name+'.stdout')).open('w') as out,(r/(name+'.stderr')).open('w') as err:
  p=subprocess.Popen(['/opt/homebrew/bin/node',str(r/script)],cwd=r,env=env,stdout=out,stderr=err,start_new_session=True)
  try:rc=p.wait(timeout=90)
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
   rc=124
 receipt=json.loads((r/name/'receipt.json').read_text()) if (r/name/'receipt.json').exists() else None
 item={'name':name,'script':script,'exit':rc,'seconds':time.monotonic()-start,'source_and_probe_mismatches':verify(),'receipt':receipt,'stderr':(r/(name+'.stderr')).read_text()[:2000]}
 summary['runs'].append(item)
 print(json.dumps({'name':name,'exit':rc,'seconds':item['seconds'],'source_and_probe_mismatches':item['source_and_probe_mismatches'],'counts':receipt.get('counts') if receipt else None,'fatal':receipt.get('fatal') if receipt else None,'cases':[{'name':x['name'],'passed':x['passed'],'error':x.get('error'),'checked':x.get('checked'),'after_apply_attempt':x.get('after_apply_attempt')} for x in receipt['cases']] if receipt else [],'stderr':item['stderr']}),flush=True)
summary['free_after']=shutil.disk_usage(root).free
summary['source_and_probe_mismatches']=verify()
(r/'candidate-native-driver.json').write_text(json.dumps(summary,indent=2)+'\n')

