"""Pack and receive the exact combined ScopeSignal viewer; no browser or payment execution."""
import base64,datetime,getpass,hashlib,json,os,pathlib,re,socket,subprocess,sys,tempfile,time,traceback,urllib.error,urllib.request,zipfile
root=pathlib.Path(__file__).resolve().parent
def gid(b):return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def identity(p):
    b=p.read_bytes();s=p.stat()
    return {"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"git_blob":gid(b),"mode":str(s.st_mode),"mtime_ns":str(s.st_mtime_ns),"inode":str(s.st_ino)}
def snapshot(p):return {x.relative_to(p).as_posix():identity(x) for x in sorted(p.rglob("*")) if x.is_file()}
receipt={"schema":"scopesignal.combined-viewer-package-receiving/1","started":datetime.datetime.now(datetime.timezone.utc).isoformat(),"passed":False,"checks":[],"http":[]}
def check(name,actual,expected):
    ok=actual==expected;receipt["checks"].append({"name":name,"actual":actual,"expected":expected,"passed":ok})
    if not ok:raise RuntimeError(name)
node=None;handles=[];watched={};payload=None;extracted=None;zip_path=None
try:
    check("selected Windows account",[os.name,getpass.getuser()],["nt","Veria"])
    os.environ["TEMP"]=str(root/"temporary");os.environ["TMP"]=os.environ["TEMP"];tempfile.tempdir=os.environ["TEMP"]
    pathlib.Path(tempfile.tempdir).mkdir()
    packet_path=root/"payload-packet.json"
    check("frozen package input",identity(packet_path)["git_blob"],"aa83f8f1c2cbd1ef362e22a69d1aa7e29fcc7b56")
    packet=json.loads(packet_path.read_text(encoding="utf-8"));receipt["source"]=packet["source"]
    watched={str(p):identity(p) for p in (packet_path,pathlib.Path(__file__),root/"stop_owned_console.py")}
    receipt["watched_before"]=watched
    payload=root/"payload";payload.mkdir()
    for item in packet["files"]:
        rel=pathlib.PurePosixPath(item["path"])
        if rel.is_absolute() or ".." in rel.parts or "\\" in item["path"] or ":" in item["path"]:raise RuntimeError("Invalid selected path")
        body=item["content"].encode("utf-8");check("text "+item["path"],gid(body),item["git_blob"])
        path=payload.joinpath(*rel.parts);path.parent.mkdir(parents=True,exist_ok=True)
        with path.open("xb") as f:f.write(body)
    receipt["image_sources_before"]={}
    for item in packet["images"]:
        source=pathlib.Path(item["source"]);before=identity(source);receipt["image_sources_before"][str(source)]=before
        expected={k:item["git"] if k=="git_blob" else item[k] for k in before}
        check("native image "+item["path"],before,expected)
        path=payload/item["path"];path.parent.mkdir(parents=True,exist_ok=True)
        with path.open("xb") as f:f.write(source.read_bytes())
    packer=root/"make_delivery_zip.py";body=packet["packer"]["content"].encode("utf-8")
    check("unchanged maintained packer",gid(body),packet["packer"]["git_blob"])
    with packer.open("xb") as f:f.write(body)
    watched[str(packer)]=identity(packer)
    receipt["watched_before"]=watched
    receipt["payload_before"]=snapshot(payload)
    rows=[{"path":name,"bytes":value["bytes"],"sha256":value["sha256"]} for name,value in receipt["payload_before"].items()]
    manifest=root/"selected-manifest.json";raw=(json.dumps({"schema":"hamon.delivery-zip/1","files":rows},indent=2)+"\n").encode("utf-8")
    manifest.write_bytes(raw);watched[str(manifest)]=identity(manifest)
    receipt["watched_before"]=watched
    zip_path=root/"ScopeSignal-Combined-Record-Viewer-86d6c39d-v1.zip"
    argv=[sys.executable,"-I","-B",str(packer),str(payload),str(manifest),str(zip_path),"--manifest-sha256",hashlib.sha256(raw).hexdigest()]
    with (root/"packer.stdout").open("xb") as stdout,(root/"packer.stderr").open("xb") as stderr:
        process=subprocess.Popen(argv,stdout=stdout,stderr=stderr,stdin=subprocess.DEVNULL,env=os.environ.copy())
        receipt["packer"]={"argv":argv,"pid":process.pid}
        try:receipt["packer"]["exit"]=process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            process.kill();receipt["packer"]["exit"]=process.wait(timeout=10);raise RuntimeError("Packer timed out")
    check("packer exit",receipt["packer"]["exit"],0)
    check("packer stderr",(root/"packer.stderr").read_text(encoding="utf-8"),"")
    report=json.loads((root/"packer.stdout").read_text(encoding="utf-8"));receipt["packer"]["report"]=report
    receipt["zip_before"]=identity(zip_path);check("sealed ZIP SHA256",receipt["zip_before"]["sha256"],report["zip_sha256"])
    extracted=root/"received";extracted.mkdir()
    expected={**{name:(payload/name).read_bytes() for name in receipt["payload_before"]},"MANIFEST.json":raw}
    with zipfile.ZipFile(zip_path) as z:
        check("exact member names",z.namelist(),sorted(expected))
        check("ZIP CRC",z.testzip(),None)
        for name in z.namelist():
            body=z.read(name);check("ZIP member "+name,body==expected[name],True)
            target=extracted/name;target.parent.mkdir(parents=True,exist_ok=True)
            with target.open("xb") as f:f.write(body)
    receipt["received_before"]=snapshot(extracted)
    node_path=pathlib.Path(r"C:\Program Files\nodejs\node.exe")
    version=subprocess.run([str(node_path),"--version"],capture_output=True,text=True,timeout=10)
    check("Node version command exit",version.returncode,0);check("received Node version",version.stdout.strip(),"v24.19.0")
    receipt["runtime"]={"node":str(node_path),"node_version":version.stdout.strip(),"python":sys.version,"user":getpass.getuser(),"host":os.environ.get("COMPUTERNAME")}
    foreign=root/"foreign-working-directory";foreign.mkdir()
    out=(root/"server.stdout").open("xb");err=(root/"server.stderr").open("xb");handles.extend([out,err])
    startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
    argv=[str(node_path),str(extracted/"open-record.mjs")]
    node=subprocess.Popen(argv,cwd=foreign,stdout=out,stderr=err,stdin=subprocess.DEVNULL,creationflags=subprocess.CREATE_NEW_CONSOLE,startupinfo=startup,env=os.environ.copy())
    receipt["server"]={"argv":argv,"pid":node.pid,"cwd":str(foreign),"new_console":True}
    deadline=time.monotonic()+15;match=None
    while time.monotonic()<deadline:
        match=re.search(rb"ScopeSignal saved-record companion: http://127\.0\.0\.1:(\d+)/record\.html", (root/"server.stdout").read_bytes())
        if match:break
        if node.poll() is not None:raise RuntimeError("Owned opener exited before readiness")
        time.sleep(0.05)
    if not match:raise RuntimeError("No owned opener readiness")
    port=int(match.group(1));receipt["server"]["port"]=port
    if node.poll() is not None:raise RuntimeError("Owned opener is no longer running")
    client=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    pins=json.loads((extracted/"RUNTIME-PINS.json").read_text(encoding="utf-8"))
    for name,pin in pins["files"].items():
        with client.open("http://127.0.0.1:"+str(port)+"/"+name,timeout=5) as response:
            body=response.read();status=response.status;headers=dict(response.headers)
        expected_body=(extracted/"source"/"candidate"/name).read_bytes()
        check("HTTP "+name,[status,body==expected_body],[200,True])
        expected_type="text/html; charset=utf-8" if name.endswith(".html") else "text/css; charset=utf-8" if name.endswith(".css") else "text/javascript; charset=utf-8"
        check("MIME "+name,headers.get("Content-Type"),expected_type)
        receipt["http"].append({"path":name,"status":status,"bytes":len(body),"sha256":hashlib.sha256(body).hexdigest(),"git_blob":gid(body),"content_type":headers.get("Content-Type")})
    try:client.open("http://127.0.0.1:"+str(port)+"/index.html",timeout=5);raise RuntimeError("Outside page unexpectedly served")
    except urllib.error.HTTPError as error:
        body=error.read().decode("utf-8");check("full demo outside package",[error.code,"outside this packet" in body],[404,True])
        receipt["outside_page"]={"status":error.code,"body":body}
    stop=[sys.executable,"-I","-B",str(root/"stop_owned_console.py"),str(node.pid)]
    result=subprocess.run(stop,capture_output=True,text=True,timeout=10,creationflags=subprocess.CREATE_NO_WINDOW)
    receipt["stop"]={"argv":stop,"exit":result.returncode,"stdout":result.stdout,"stderr":result.stderr}
    check("owned console Ctrl+C request",result.returncode,0)
    receipt["server"]["exit"]=node.wait(timeout=10);check("owned opener exit",receipt["server"]["exit"],0)
    for handle in handles:handle.close()
    handles=[]
    check("opener stderr",(root/"server.stderr").read_text(encoding="utf-8"),"")
    with socket.socket() as sock:
        sock.settimeout(1);closed=sock.connect_ex(("127.0.0.1",port))!=0
    check("owned listener closed",closed,True);receipt["listener_closed"]=closed
    receipt["passed"]=True
except BaseException:
    receipt["error"]=traceback.format_exc()
finally:
    if node is not None and node.poll() is None:
        node.kill();receipt["forced_cleanup_exit"]=node.wait(timeout=10);receipt["passed"]=False
    for handle in handles:handle.close()
    try:
        if payload is not None and "payload_before" in receipt:
            receipt["payload_after"]=snapshot(payload);check("source payload conservation",receipt["payload_after"],receipt["payload_before"])
        if extracted is not None and "received_before" in receipt:
            receipt["received_after"]=snapshot(extracted);check("extracted artifact conservation",receipt["received_after"],receipt["received_before"])
        if zip_path is not None and "zip_before" in receipt:
            receipt["zip_after"]=identity(zip_path);check("sealed ZIP conservation",receipt["zip_after"],receipt["zip_before"])
        if "image_sources_before" in receipt:
            receipt["image_sources_after"]={p:identity(pathlib.Path(p)) for p in receipt["image_sources_before"]};check("original PNG conservation",receipt["image_sources_after"],receipt["image_sources_before"])
        if watched:
            receipt["watched_after"]={p:identity(pathlib.Path(p)) for p in watched};check("observer input and tool conservation",receipt["watched_after"],watched)
    except BaseException:receipt["passed"]=False;receipt["conservation_error"]=traceback.format_exc()
    receipt["finished"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (root/"package-receiving.json").open("xb") as f:f.write((json.dumps(receipt,ensure_ascii=False,indent=2)+"\n").encode("utf-8"))
    print(json.dumps({"passed":receipt["passed"],"checks":len(receipt["checks"]),"http":len(receipt["http"]),"zip":receipt.get("zip_after",receipt.get("zip_before")),"receipt":identity(root/"package-receiving.json"),"error":receipt.get("error")}))
raise SystemExit(0 if receipt["passed"] else 1)
