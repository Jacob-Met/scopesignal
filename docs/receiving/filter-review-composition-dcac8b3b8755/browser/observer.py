#!/usr/bin/env python3
"""Receive the composed event-filter/full-review workflow; never run payment actions."""
import argparse, hashlib, http.server, json, os, platform, shutil, socket, sys, tempfile, threading, traceback
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

def identity(path):
    b=path.read_bytes(); s=path.stat()
    return {"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),
            "git":hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest(),
            "mode":str(s.st_mode),"mtime_ns":str(s.st_mtime_ns),"inode":str(s.st_ino)}
def inventory(root):
    found={}
    for p in sorted(root.rglob("*")):
        if p.is_symlink(): raise RuntimeError("Unexpected staged symlink")
        if p.is_file(): found[p.relative_to(root).as_posix()]=identity(p)
    return found
def text_value(value):
    if value is None:return "null"
    if value is True:return "true"
    if value is False:return "false"
    return str(value)
def expected_fields(record,filename):
    fields={"filename":filename}
    for k,v in record.items():
        if k not in {"fixture","summary","checkpoints","events"}:fields["record."+k]=text_value(v)
    for group in ("fixture","summary"):
        for k,v in record[group].items():fields[group+"."+k]=text_value(v)
    for i,cp in enumerate(record["checkpoints"]):
        prefix="checkpoints."+str(i)
        for k in ("id","title","amount"):fields[prefix+"."+k]=text_value(cp[k])
        if cp["approval"] is None:fields[prefix+".approval"]="null"
        else:
            for k,v in cp["approval"].items():fields[prefix+".approval."+k]=text_value(v)
        for k,v in cp["capture"].items():fields[prefix+".capture."+k]=text_value(v)
    for i,event in enumerate(record["events"]):
        for k,v in event.items():fields["events."+str(i)+"."+k]=text_value(v)
    return fields

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--packet",type=Path,required=True);ap.add_argument("--fixture",type=Path,required=True)
    ap.add_argument("--criteria",type=Path,required=True);ap.add_argument("--output",type=Path,required=True)
    ap.add_argument("--mode",choices=["original","candidate"],required=True)
    ap.add_argument("--baseline-download",type=Path);ap.add_argument("--baseline-sha256");ap.add_argument("--chrome",required=True)
    args=ap.parse_args()
    out=args.output.resolve();out.mkdir()
    process_temp=out.parent/(out.name+"-process-temp");process_temp.mkdir()
    os.environ["TEMP"]=str(process_temp);os.environ["TMP"]=str(process_temp);tempfile.tempdir=str(process_temp)
    packet=json.loads(args.packet.read_text(encoding="utf-8"));criteria=json.loads(args.criteria.read_text(encoding="utf-8"))
    raw=args.fixture.read_bytes();record=json.loads(raw.decode("utf-8"))
    watched=[args.packet,args.fixture,args.criteria,Path(__file__).resolve()]
    if args.baseline_download:watched.append(args.baseline_download)
    before={str(p):identity(p) for p in watched}
    receipt={"schema":"hamon.scopesignal.filter-download-browser.v1","mode":args.mode,
      "device":{"node":platform.node(),"user":os.environ.get("USERNAME"),"python":sys.version},
      "source":packet["source"],"criteria":before[str(args.criteria)],"checks":[],"downloads":[],
      "requests":[],"external_requests":[],"page_errors":[],"console_errors":[],"passed":False,
      "browser_os_exit":"not measured","before":before}
    def check(name,actual,expected):
        passed=actual==expected;receipt["checks"].append({"name":name,"actual":actual,"expected":expected,"passed":passed})
        if not passed:raise RuntimeError(name)
    staged=out/"intake";stage=staged/"source";stage.mkdir(parents=True)
    allowed={"record.html","record-view.css","src/record-view.mjs","src/record-reader.mjs",
        "src/record-review-download.mjs","src/ledger.mjs","src/fixture-record.mjs","src/record-review-export.mjs"}
    if args.mode=="candidate":allowed.add("src/record-event-filter.mjs")
    check("exact runtime path set",{f["path"] for f in packet["files"]}==allowed,True)
    for f in packet["files"]:
        b=f["content"].encode("utf-8");git=hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
        check("admit "+f["path"],git,f["git_blob"])
        p=stage/f["path"];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    fp=staged/"mixed.json";fp.write_bytes(raw)
    fi=identity(fp);check("fixture bytes",fi["bytes"],criteria["fixture"]["bytes"])
    check("fixture SHA256",fi["sha256"],criteria["fixture"]["sha256"]);check("fixture Git",fi["git"],criteria["fixture"]["git"])
    if args.mode=="candidate":
        if not args.baseline_download or not args.baseline_sha256:raise RuntimeError("Candidate requires pinned original download")
        check("admit original download SHA256",identity(args.baseline_download)["sha256"],args.baseline_sha256)
    staged_before=inventory(staged);receipt["staged_before"]=staged_before
    pw=browser=context=server=thread=None;server_port=None
    try:
        class Handler(http.server.SimpleHTTPRequestHandler):
            extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,".mjs":"text/javascript"}
            def __init__(self,*a,**kw):super().__init__(*a,directory=str(stage),**kw)
            def log_message(self,fmt,*a):pass
        server=http.server.ThreadingHTTPServer(("127.0.0.1",0),Handler)
        server.daemon_threads=True;server_port=server.server_address[1]
        thread=threading.Thread(target=server.serve_forever,name="owned-scope-loopback",daemon=True);thread.start()
        origin="http://127.0.0.1:"+str(server_port);receipt["origin"]=origin
        pw=sync_playwright().start()
        browser=pw.chromium.launch(executable_path=args.chrome,headless=True)
        receipt["chrome"]=browser.version
        context=browser.new_context(viewport={"width":1280,"height":900},accept_downloads=True,service_workers="block")
        def route(request_route):
            u=urlsplit(request_route.request.url)
            if u.scheme in ("http","https") and (u.scheme!="http" or u.hostname!="127.0.0.1" or u.port!=server_port):
                receipt["external_requests"].append(request_route.request.url);request_route.abort()
            else:request_route.continue_()
        context.route("http://**/*",route)
        context.route("https://**/*",route)
        context.on("request",lambda request:receipt["requests"].append({"method":request.method,"url":request.url}))
        context.on("page",lambda p:(p.on("pageerror",lambda e:receipt["page_errors"].append(str(e))),
            p.on("console",lambda m:receipt["console_errors"].append(m.text) if m.type=="error" else None)))
        page=context.new_page();page.set_default_timeout(15000)
        page.goto(origin+"/record.html",wait_until="networkidle")
        page.locator("#record-file").set_input_files(str(fp))
        page.locator("#record-display").wait_for(state="visible")
        check("all event rows",page.locator(".saved-event").count(),13)
        check("opened notice",page.locator(".record-notice").text_content(),"Synthetic fixture · Not payment evidence")
        check("literal original row JSON",page.locator(".event-json").evaluate_all("(xs)=>xs.map(x=>JSON.parse(x.textContent))"),record["events"])
        check("literal accepted evidence",page.locator(".accepted-evidence").all_text_contents(),[c["approval"]["acceptedEvidence"] for c in record["checkpoints"]])
        check("inert input markup",page.locator("#record-display img").count(),0)
        summary=page.locator(".record-totals").text_content()
        check("full summary",page.locator(".record-totals dd").all_text_contents(),["$1,200.00","3 / 3","$800.00","$400.00"])
        checkpoints=page.locator(".record-checkpoints").inner_html()
        check("pending handoff",page.locator('[data-checkpoint-id="handoff"] .capture-state').text_content(),"Capture pending")
        def visible_seqs():
            return page.locator(".event-list > li").evaluate_all("(xs)=>xs.filter(x=>!x.hidden).map(x=>Number(x.querySelector('.event-sequence').textContent))")
        def stable(label):
            check(label+" totals",page.locator(".record-totals").text_content(),summary)
            check(label+" checkpoints",page.locator(".record-checkpoints").inner_html(),checkpoints)
            check(label+" all literal row JSON",page.locator(".event-json").evaluate_all("(xs)=>xs.map(x=>JSON.parse(x.textContent))"),record["events"])
        def download(label):
            with page.expect_download() as info:page.get_by_role("button",name="Download record review",exact=True).click()
            dl=info.value;check(label+" filename",dl.suggested_filename,"scopesignal-record-review.html")
            path=out/(label+".html");dl.save_as(str(path));entry={"name":label,"identity":identity(path)}
            receipt["downloads"].append(entry)
            if args.baseline_download:check(label+" exact original full download",path.read_bytes()==args.baseline_download.read_bytes(),True)
            read=context.new_page();read.goto(path.as_uri(),wait_until="load")
            pairs=read.locator("[data-field]").evaluate_all("(xs)=>xs.map(x=>[x.dataset.field,x.textContent])")
            check(label+" no duplicate fields",len(pairs),len({x[0] for x in pairs}))
            check(label+" exact complete scalar map",dict(pairs),expected_fields(record,"mixed.json"))
            check(label+" complete event order",read.locator(".events h3").all_text_contents(),["Event "+str(e["seq"])+" · "+e["type"] for e in record["events"]])
            check(label+" script-free",read.locator("script").count(),0)
            check(label+" no external asset attributes",read.locator("[src],link[href]").count(),0)
            check(label+" complete notice","Synthetic fixture · Not payment evidence." in read.locator(".notice").text_content(),True)
            read.close();return path
        check("initial order",visible_seqs(),criteria["expected"]["all"])
        page.set_viewport_size({"width":390,"height":844})
        check("390px document width",page.evaluate("document.documentElement.scrollWidth"),390)
        if args.mode=="original":
            check("original missing checkpoint filter",page.locator("#record-event-checkpoint").count(),0)
            check("original missing event-type filter",page.locator("#record-event-type").count(),0)
            download("original-full")
            stable("original after download")
            page.locator(".record-history").scroll_into_view_if_needed()
            page.screenshot(path=str(out/"original-390.png"))
        else:
            if not args.baseline_download:raise RuntimeError("Candidate requires frozen original actual download")
            cp=page.locator("#record-event-checkpoint");et=page.locator("#record-event-type")
            check("initial count",page.locator("#record-event-count").text_content().startswith("Showing 13 of 13 recorded events."),True)
            detail=page.locator(".saved-event").nth(7)
            detail.locator("summary").click();check("seq8 initially opened",detail.evaluate("(x)=>x.open"),True)
            cp.focus();cp.press("Home");cp.press("ArrowDown")
            check("keyboard checkpoint value",cp.input_value(),"journey")
            check("journey subset",visible_seqs(),criteria["expected"]["journey"]);stable("journey")
            et.focus();et.press("End");et.press("ArrowUp")
            check("keyboard event type",et.input_value(),"paypal.webhook.received")
            check("intersection subset",visible_seqs(),criteria["expected"]["journey_webhook"])
            check("intersection count",page.locator("#record-event-count").text_content().startswith("Showing 2 of 13 recorded events."),True)
            check("seq8 survives filters",detail.evaluate("(x)=>x.open"),True)
            check("duplicate labels",[page.locator(".saved-event").nth(i).locator(".event-description strong").text_content() for i in [7,8]],["Webhook received","Duplicate webhook recorded"])
            check("duplicate values",[json.loads(page.locator(".event-json").nth(i).text_content())["duplicate"] for i in [7,8]],[False,True])
            stable("intersection");download("filtered-full")
            check("390px filtered document width",page.evaluate("document.documentElement.scrollWidth"),390)
            cp.scroll_into_view_if_needed();page.screenshot(path=str(out/"filtered-390.png"))
            cp.select_option(criteria["expected"]["no_match_pair"]["checkpoint"])
            check("no-match subset",visible_seqs(),[])
            check("no-match count",page.locator("#record-event-count").text_content().startswith("Showing 0 of 13 recorded events."),True)
            check("no-match message",page.locator(".record-event-empty").is_visible(),True)
            check("no-match history hidden",page.locator(".event-list").is_hidden(),True)
            stable("no-match");download("no-match-full")
            reset=page.get_by_role("button",name="Show all events",exact=True);reset.focus();reset.press("Enter")
            check("reset all13",visible_seqs(),criteria["expected"]["all"])
            check("reset checkpoint focus",page.evaluate("document.activeElement.id"),"record-event-checkpoint")
            check("reset select values",[cp.input_value(),et.input_value()],["",""])
            check("reset retains seq8 disclosure",detail.evaluate("(x)=>x.open"),True)
            stable("reset")
            page.set_viewport_size({"width":1280,"height":900});cp.scroll_into_view_if_needed()
            page.screenshot(path=str(out/"reset-desktop.png"))
        check("storage unchanged",page.evaluate("({local:localStorage.length,session:sessionStorage.length})"),{"local":0,"session":0})
        check("context cookies",context.cookies(),[]);check("storage origins",context.storage_state()["origins"],[])
        check("no external requests",receipt["external_requests"],[])
        check("no page errors",receipt["page_errors"],[]);check("no console errors",receipt["console_errors"],[])
        receipt["passed"]=True
    except BaseException:
        receipt["error"]=traceback.format_exc()
    finally:
        if context:
            try:context.close();receipt["context_closed"]=True
            except BaseException:receipt["passed"]=False;receipt["context_close_error"]=traceback.format_exc()
        if browser:
            try:
                browser.close();receipt["managed_disconnect"]=not browser.is_connected()
                if not receipt["managed_disconnect"]:receipt["passed"]=False
            except BaseException:receipt["passed"]=False;receipt["browser_close_error"]=traceback.format_exc()
        if pw:
            try:pw.stop();receipt["playwright_stopped"]=True
            except BaseException:receipt["passed"]=False;receipt["playwright_stop_error"]=traceback.format_exc()
        if server:
            try:
                server.shutdown();server.server_close();thread.join(timeout=5)
                receipt["server_thread_closed"]=not thread.is_alive()
                with socket.socket() as sock:
                    sock.settimeout(1);receipt["listener_closed"]=sock.connect_ex(("127.0.0.1",server_port))!=0
                if not receipt["server_thread_closed"] or not receipt["listener_closed"]:receipt["passed"]=False
            except BaseException:receipt["passed"]=False;receipt["server_close_error"]=traceback.format_exc()
        try:
            receipt["after"]={str(p):identity(p) for p in watched}
            receipt["staged_after"]=inventory(staged)
            receipt["inputs_preserved"]=receipt["before"]==receipt["after"]
            receipt["staged_preserved"]=staged_before==receipt["staged_after"]
            if not receipt["inputs_preserved"] or not receipt["staged_preserved"]:receipt["passed"]=False
        except BaseException:receipt["passed"]=False;receipt["conservation_error"]=traceback.format_exc()
        receipt["artifacts"]={p.name:identity(p) for p in out.iterdir() if p.is_file()}
        raw_receipt=(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n").encode("utf-8")
        with (out/"receiving.json").open("xb") as handle:handle.write(raw_receipt)
    print(json.dumps({"passed":receipt["passed"],"checks":len(receipt["checks"]),"downloads":len(receipt["downloads"]),
        "managed_disconnect":receipt.get("managed_disconnect"),"listener_closed":receipt.get("listener_closed"),
        "receipt":identity(out/"receiving.json")},ensure_ascii=False))
    return 0 if receipt["passed"] else 1
if __name__=="__main__":raise SystemExit(main())
