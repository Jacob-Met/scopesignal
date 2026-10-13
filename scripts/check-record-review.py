"""Receive ScopeSignal saved-record HTML with installed Playwright and Chrome.
All data is fictional. No packages, browser, provider or payment is installed/called.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse,functools,hashlib,http.server,json,os,platform,sys,threading,traceback
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source",required=True,type=Path)
parser.add_argument("--output",required=True,type=Path)
parser.add_argument("--chrome",required=True,type=Path)
parser.add_argument("--fixtures",type=Path,help="Optional frozen original fixture directory")
parser.add_argument("--baseline",action="store_true")
args=parser.parse_args()
source=args.source.resolve(strict=True); chrome=args.chrome.resolve(strict=True); out=args.output.absolute()
if not source.is_dir() or not chrome.is_file(): parser.error("Existing source directory and Chrome executable required.")
if out.exists() or out.is_symlink(): parser.error("Output must be new.")
resolved_out=out.resolve()
if source==resolved_out or source in resolved_out.parents or resolved_out in source.parents: parser.error("Output and source must be separate.")
if args.fixtures:
    fixture_root=args.fixtures.resolve(strict=True)
    if not fixture_root.is_dir() or fixture_root==resolved_out or resolved_out in fixture_root.parents: parser.error("Existing separate fixture directory required.")
else: fixture_root=out/"fixtures"
names=["record.html","record-view.css","src/record-view.mjs","src/record-reader.mjs","src/fixture-record.mjs","src/ledger.mjs"]
if not args.baseline:names+=["src/record-review-export.mjs","src/record-review-download.mjs"]
def identity(path):
    data=path.read_bytes()
    return {"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"git_blob":hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest(),"mtime_ns":path.stat().st_mtime_ns}
before={name:identity(source/name) for name in names}
out.mkdir(parents=False)
receipt={"observed_at":datetime.now(timezone.utc).isoformat(),"pid":os.getpid(),"host":platform.node(),"python":sys.version,"source":str(source),"source_before":before,"baseline":args.baseline,"checks":[],"reports":[]}
def save(name,value):
    with (out/name).open("x",encoding="utf-8") as stream:json.dump(value,stream,indent=2,ensure_ascii=True);stream.write("\n")
def check(name,value,detail=None):
    receipt["checks"].append({"name":name,"passed":bool(value),"detail":detail})
    if not value:raise AssertionError(name)
class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,".mjs":"text/javascript"}
    def log_message(self,*args):pass
server=None; thread=None; fixture_before={}; errors=[]; requests=[]
try:
    server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(source)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    origin="http://127.0.0.1:"+str(server.server_port);url=origin+"/record.html"
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=str(chrome),headless=True)
        receipt["browser"]=browser.version
        context=browser.new_context(viewport={"width":1440,"height":1000},locale="en-US",timezone_id="UTC")
        context.route("**/*",lambda route:route.continue_() if route.request.url.startswith(origin+"/") else route.abort())
        page=context.new_page(); page.on("pageerror",lambda e:errors.append(str(e)));page.on("request",lambda r:requests.append(r.url))
        page.goto(url,wait_until="networkidle")
        if not args.fixtures:
            fixture_root.mkdir()
            fixtures=page.evaluate(r"""async()=> {
          const {createLedger,replayFixture,FIXTURE}=await import('./src/ledger.mjs');
          const {serializeFixtureRecord}=await import('./src/fixture-record.mjs');
          const prefix=replayFixture().events;
          const literal='\nFirst\r\nSecond\rThird\t<&> “literal” 😀\u0080\n<b>review text</b>';
          const full=createLedger();
          for (const [i,cp] of FIXTURE.checkpoints.entries()) {
            full.append('checkpoint.approved',{checkpointId:cp.id,approver:'human-reviewer',acceptedEvidence:literal+' checkpoint '+i});
            full.createOrder(cp.id);full.recordCaptureAttempt(cp.id);
            if(i===0){full.recordLostCaptureResponse(cp.id);full.recordWebhook(cp.id,'WH-LITERAL-0','CAP-LITERAL-0');full.recordWebhook(cp.id,'WH-LITERAL-0','CAP-LITERAL-0');full.reconcile(cp.id,'CAP-LITERAL-0');}
            else full.recordWebhook(cp.id,'WH-LITERAL-'+i,'CAP-LITERAL-'+i);
          }
          const result={unknown:serializeFixtureRecord(prefix.slice(0,6)),captured:serializeFixtureRecord(prefix),full:serializeFixtureRecord(full.events)};
          for(const [name,evidence] of [['nul','NUL \u0000 evidence'],['surrogate','Surrogate \uD800 evidence']]) {
            const l=createLedger();l.append('checkpoint.approved',{checkpointId:'journey',approver:'human-reviewer',acceptedEvidence:evidence});result[name]=serializeFixtureRecord(l.events);
          }
          return result;
        }""")
            for name,text in fixtures.items():(fixture_root/(name+".json")).write_bytes(text.encode("utf-8"))
        fixtures={name:(fixture_root/(name+".json")).read_bytes() for name in ["unknown","captured","full","nul","surrogate"]}
        fixture_before={name:identity(fixture_root/(name+".json")) for name in fixtures}
        receipt["fixtures"]=fixture_before
        # Retain each exact input, including final newline, alongside its outputs.
        (out/"inputs").mkdir()
        for name,data in fixtures.items():(out/"inputs"/(name+".json")).write_bytes(data)
        downloads=[];page.on("download",lambda d:downloads.append(d))
        button=page.get_by_role("button",name="Download record review",exact=True)
        def opened(name,label):
            page.locator("#record-file").set_input_files({"name":label,"mimeType":"application/json","buffer":fixtures[name]})
            page.wait_for_function("(label)=>document.querySelector('#record-status').textContent.startsWith('Opened '+label+'.')",arg=label)
        def stable_view():
            return page.locator("#record-display").evaluate("(e)=>{const c=e.cloneNode(true);c.querySelectorAll('.record-review-download-status').forEach(n=>n.textContent='');return c.innerHTML}")
        def fields_expected(record,label):
            rows=[{"path":"filename","text":label}]
            def visit(value,path):
                if isinstance(value,dict):
                    for key,child in value.items():visit(child,path+"."+key)
                elif isinstance(value,list):
                    for i,child in enumerate(value):visit(child,path+"."+str(i))
                else:rows.append({"path":path,"text":"null" if value is None else ("true" if value is True else "false" if value is False else str(value))})
            for key,value in record.items():visit(value,key if key in ("fixture","summary","checkpoints","events") else "record."+key)
            return rows
        def receive_download(case,name,label,keyboard=False,visual=False):
            current=stable_view()
            with page.expect_download(timeout=10000) as event:
                if keyboard:button.focus();page.keyboard.press("Enter")
                else:button.click()
            item=event.value;dest=out/(case+".html");item.save_as(str(dest))
            check(case+": explicit filename",item.suggested_filename=="scopesignal-record-review.html")
            check(case+": current view unchanged",stable_view()==current)
            offline=browser.new_context(viewport={"width":1440,"height":1000},offline=True,java_script_enabled=False)
            rp=offline.new_page();seen=[];rp.on("request",lambda r:seen.append(r.url))
            rp.goto(dest.as_uri(),wait_until="load")
            rows=rp.locator("[data-field]").evaluate_all("(nodes)=>nodes.map(node=>({path:node.dataset.field,text:node.textContent}))")
            expected=fields_expected(json.loads(fixtures[name]),label)
            check(case+": all ordered scalar fields exact",rows==expected,{"expected":len(expected),"actual":len(rows)})
            check(case+": inert standalone offline document",rp.locator("script,link,img,iframe,object,embed,form,input,button").count()==0 and seen==[dest.as_uri()])
            footer=rp.locator("footer").text_content()
            check(case+": notice and complete-record qualifications", "No payment controls" in footer and "Not payment evidence" in rp.locator(".notice").inner_text() and "Keep the original JSON" in rp.locator("header").inner_text())
            report={"case":case,"fixture":name,"selected_file_label":label,"path":dest.name,"identity":identity(dest),"fields":rows,"footer":footer,"requests":seen}
            if visual:
                page.screenshot(path=str(out/"viewer-desktop.png"),full_page=True)
                page.set_viewport_size({"width":390,"height":844})
                page.screenshot(path=str(out/"viewer-390.png"),full_page=True)
                check("viewer 390px no overflow",page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
                page.set_viewport_size({"width":1440,"height":1000})
                rp.screenshot(path=str(out/"report-desktop.png"),full_page=True)
                rp.set_viewport_size({"width":390,"height":844})
                rp.screenshot(path=str(out/"report-390.png"),full_page=True)
                report["narrow"]=rp.evaluate("({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth})")
                check("report 390px no overflow",report["narrow"]["scrollWidth"]<=390)
                rp.emulate_media(media="print")
                check("print retains all fields and footer",rp.locator("[data-field]").count()==len(expected) and rp.locator("footer").is_visible())
                pdf=out/"full-review.pdf";rp.pdf(path=str(pdf),format="A4",print_background=True,margin={"top":"12mm","right":"12mm","bottom":"12mm","left":"12mm"})
                report["pdf"]=identity(pdf)
                report["print_footer"]={"display":rp.locator("footer").evaluate("(n)=>getComputedStyle(n).display"),"text":rp.locator("footer").text_content()}
            receipt["reports"].append(report);offline.close()
            return report
        check("no download control before a record",button.count()==0)
        opened("unknown","unknown.json")
        check("unknown capture preserved",page.locator('[data-checkpoint-id="journey"] [data-capture-state="unknown"]').count()==1)
        opened("full","review <draft> \u00e9.json")
        check("literal accepted evidence in viewer",page.locator(".accepted-evidence").first.text_content()==json.loads(fixtures["full"])["checkpoints"][0]["approval"]["acceptedEvidence"])
        if args.baseline:
            check("original lacks download action",button.count()==0)
        else:
            check("opened record has one download action",button.count()==1)
            receive_download("full-review","full","review <draft> \u00e9.json",keyboard=True,visual=True)
        old=stable_view()
        page.locator("#record-file").set_input_files({"name":"invalid.json","mimeType":"application/json","buffer":b"{"})
        page.locator("#record-error").wait_for(state="visible")
        check("invalid input preserves opened record",stable_view()==old)
        if not args.baseline:
            before_count=len(downloads)
            page.evaluate("()=>{window.savedCreateObjectURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('Receiving-only preparation failure');};}")
            button.click()
            check("preparation refusal leaves view and emits status",stable_view()==old and "could not be prepared" in page.locator(".record-review-download-status").inner_text() and len(downloads)==before_count)
            page.evaluate("()=>{URL.createObjectURL=window.savedCreateObjectURL;}")
            receive_download("retry-review","full","review <draft> \u00e9.json")
            for name in ("nul","surrogate"):
                opened(name,name+".json");old=stable_view();count=len(downloads);button.click()
                check(name+": HTML-unrepresentable text refused without mutation","cannot be preserved" in page.locator(".record-review-download-status").inner_text() and stable_view()==old and len(downloads)==count)
        opened("unknown","unknown.json");old=stable_view()
        page.evaluate("""()=>{const original=File.prototype.arrayBuffer;window.releaseRecordRead=null;File.prototype.arrayBuffer=function(){if(this.name==='delayed.json')return new Promise(resolve=>{window.releaseRecordRead=()=>original.call(this).then(resolve);});return original.call(this);};}""")
        page.locator("#record-file").set_input_files({"name":"delayed.json","mimeType":"application/json","buffer":fixtures["full"]})
        page.wait_for_function("window.releaseRecordRead!==null")
        check("pending read preserves current record",stable_view()==old)
        if not args.baseline:
            pending=page.locator("#record-status").text_content()
            receive_download("pending-unknown-review","unknown","unknown.json")
            check("download preserves pending read status",page.locator("#record-status").text_content()==pending)
        opened("captured","newer.json");latest=stable_view()
        page.evaluate("window.releaseRecordRead()");page.wait_for_timeout(150)
        check("older read cannot replace newer selection",stable_view()==latest)
        if not args.baseline:receive_download("newer-captured-review","captured","newer.json")
        page.locator("#clear-record").click()
        check("clear removes record and download control",page.locator("#record-display").inner_html()=="" and button.count()==0)
        check("no page errors or remote requests",not errors and all(u.startswith(origin+"/") for u in requests))
        receipt["page_errors"]=errors;receipt["requests"]=requests;receipt["actual_download_count"]=len(downloads)
        context.close();browser.close()
except Exception:
    receipt["failure"]=traceback.format_exc()
finally:
    if server:server.shutdown();server.server_close()
    if thread:thread.join(timeout=3)
    receipt["source_unchanged"]=all(identity(source/name)==value for name,value in before.items())
    receipt["fixtures_unchanged"]=all(identity(fixture_root/(name+".json"))==value for name,value in fixture_before.items())
    receipt["passed"]=sum(row["passed"] for row in receipt["checks"]);receipt["selected"]=len(receipt["checks"])
    receipt["finished_at"]=datetime.now(timezone.utc).isoformat()
    receipt["artifact_manifest"]={str(p.relative_to(out)):identity(p) for p in sorted(out.rglob("*")) if p.is_file()}
    save("receiving.json",receipt)
    print(json.dumps({k:v for k,v in receipt.items() if k not in ("reports","source_before","requests","artifact_manifest")},ensure_ascii=True))
if "failure" in receipt or not receipt["source_unchanged"] or not receipt["fixtures_unchanged"]:raise SystemExit(1)
