from pathlib import Path
import base64,hashlib,tarfile,io,json,subprocess,os,signal,shutil,time,concurrent.futures,urllib.parse
root=Path('/Users/me/hamon-scopesignal-draft-receiving-cd1df0f1ee24')
r=root/'workspace-repair-public-65d'
archive=base64.b64decode((root/'workspace-repair-public-65d.b64').read_text(),validate=True)
expected_archive=os.environ.get('SCOPESIGNAL_ARCHIVE_SHA256')
assert expected_archive and hashlib.sha256(archive).hexdigest()==expected_archive
r.mkdir(exist_ok=False)
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
 for member in t.getmembers():
  p=Path(member.name);assert not p.is_absolute() and '..' not in p.parts and not member.issym() and not member.islnk()
 t.extractall(r,filter='data')
freeze=json.loads((r/'input-freeze.json').read_text())
def verify():
 return [f['path'] for f in freeze['files'] if hashlib.sha256((r/f['path']).read_bytes()).hexdigest()!=f['sha256']]
assert not verify()
m=json.loads((r/'source-manifest.json').read_text())
release=json.loads((r/'release-input.json').read_text())
assert m['commit']==release['commit']=='65d47f90e609c36f51648c303e06f74a1d95f856'
assert m['tree']==release['tree']=='88073a0984b05b629d85563ae2e113e6c932e8ec'
assert release['pages']['id']==37781938930 and release['pages']['head_sha']==m['commit'] and release['pages']['status']=='completed' and release['pages']['conclusion']=='success'
pins={f['path']:f for f in m['files']}
free=shutil.disk_usage(root).free
if free<80_000_000:raise RuntimeError('Native receiving storage below80MB; no public fetch started')
base='https://jacobmetoyer.com/scopesignal/'
def fetch(path):
 url=base+path
 target=r/'preflight-served'/path;target.parent.mkdir(parents=True,exist_ok=True)
 args=['/usr/bin/curl','--fail','--silent','--show-error','--location','--proto','=https','--proto-redir','=https','--connect-timeout','10','--max-time','20','--max-filesize','1048576','--header','Cache-Control: no-cache','--output',str(target),'--write-out','%{http_code}\\n%{url_effective}\\n',url]
 started=time.monotonic()
 try:
  result=subprocess.run(args,capture_output=True,text=True,timeout=25)
  lines=result.stdout.splitlines()
  data=target.read_bytes() if target.exists() else b''
  actual={'path':path,'url':url,'curl_exit':result.returncode,'http_status':lines[0] if lines else None,'effective_url':lines[1] if len(lines)>1 else None,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_blob':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),'stderr':result.stderr[:1500],'seconds':time.monotonic()-started}
  expected=pins[path]
  actual['passed']=result.returncode==0 and actual['http_status']=='200' and actual['effective_url']==url and actual['sha256']==expected['sha256'] and actual['git_blob']==expected['git_blob']
 except Exception as error:actual={'path':path,'url':url,'passed':False,'error':str(error),'seconds':time.monotonic()-started}
 return actual
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
 preflight=list(executor.map(fetch,m['required_runtime_assets']))
summary={'source_commit':m['commit'],'source_tree':m['tree'],'pages_run':37781938930,'public_url':base,'normal_tls':True,'free_before':free,'preflight':preflight,'preflight_passed':len(preflight)==8 and all(f['passed'] for f in preflight),'browser_started':False,'input_mismatches':verify()}
(r/'preflight-receipt.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'preflight_passed':summary['preflight_passed'],'files':preflight}),flush=True)
if summary['preflight_passed']:
 release['deployed_runtime_preflight']={'passed':True,'commit':m['commit'],'normal_tls':True,'files':preflight}
 (r/'release-verified.json').write_text(json.dumps(release,indent=2)+'\n')
 env=os.environ.copy()
 env.update({'SCOPESIGNAL_MANIFEST':str(r/'source-manifest.json'),'SCOPESIGNAL_EVIDENCE':str(r/'browser-evidence'),'SCOPESIGNAL_PUBLIC_URL':base,'SCOPESIGNAL_EXPECTED_COMMIT':m['commit'],'SCOPESIGNAL_RELEASE_RECEIPT':str(r/'release-verified.json'),'SCOPESIGNAL_PUPPETEER':'/Users/me/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js','SCOPESIGNAL_CHROME':'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','TMPDIR':str(root/'tmp')})
 summary['browser_started']=True;started=time.monotonic()
 with (r/'browser.stdout').open('w') as out,(r/'browser.stderr').open('w') as err:
  p=subprocess.Popen(['/opt/homebrew/bin/node',str(r/'check-workspace-public-positive.mjs')],cwd=r,env=env,stdout=out,stderr=err,start_new_session=True)
  try:code=p.wait(timeout=90)
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
   code=124
 summary['browser_exit']=code;summary['browser_seconds']=time.monotonic()-started
 summary['browser_receipt']=json.loads((r/'browser-evidence/receipt.json').read_text()) if (r/'browser-evidence/receipt.json').exists() else None
 summary['browser_stderr']=(r/'browser.stderr').read_text()[:2000]
 receipt=summary['browser_receipt']
 print(json.dumps({'browser_exit':code,'seconds':summary['browser_seconds'],'counts':receipt.get('counts') if receipt else None,'fatal':receipt.get('fatal') if receipt else None,'cases':[{'name':f['name'],'passed':f['passed'],'error':f.get('error')} for f in receipt['cases']] if receipt else [],'stderr':summary['browser_stderr']}),flush=True)
summary['input_mismatches']=verify();summary['free_after']=shutil.disk_usage(root).free
(r/'public-native-driver.json').write_text(json.dumps(summary,indent=2)+'\n')

