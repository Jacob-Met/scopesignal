import base64,hashlib,json,pathlib,os,platform
root=pathlib.Path(r"D:\hamon-dcac8b3b8755-scope-package-tp8o48zo")
names=["package-receiving.json","launch-result.json","course.stdout","course.stderr","packer.stdout","packer.stderr","server.stdout","server.stderr","selected-manifest.json","ScopeSignal-Combined-Record-Viewer-86d6c39d-v1.zip"]
def identity(p):
 s=p.stat(); b=p.read_bytes()
 return {"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"git_blob":hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest(),"mode":s.st_mode,"mtime_ns":s.st_mtime_ns,"inode":s.st_ino},b
rows=[]
for n in names:
 p=root/n
 before,b=identity(p)
 after,b2=identity(p)
 if before!=after or b!=b2: raise RuntimeError("conservation")
 rows.append({"path":n,**before,"base64":base64.b64encode(b).decode("ascii")})
packet={"schema":"hamon.native-byte-transport/1","purpose":"ScopeSignal completed package course and sealed ZIP; data-only export","identity":{"node":platform.node(),"user":os.environ.get("USERNAME"),"python":platform.python_version()},"files":rows}
p=root/"publication-transport-v1.json"
with p.open("x",encoding="utf-8",newline="\n") as f: f.write(json.dumps(packet,ensure_ascii=True,indent=2)+"\n")
meta,_=identity(p)
print(json.dumps({"path":str(p),**meta,"files":[{k:v for k,v in r.items() if k!="base64"} for r in rows]},ensure_ascii=True))
