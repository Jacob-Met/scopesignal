from html.parser import HTMLParser
from pathlib import Path
import hashlib,json
root=Path.cwd()
receipt=json.loads((root/"independent-v2/receiving.json").read_text())
class ReviewParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags=[]
        self.text=[]
        self.policies=[]
        self.ids=[]
    def handle_starttag(self,tag,attrs):
        self.tags.append(tag)
        attrs=dict(attrs)
        if "id" in attrs: self.ids.append(attrs["id"])
        assert tag not in {"script","img","iframe","object","embed","form","input","button","link","base","audio","video","source"}, (tag,attrs)
        assert not any(key.startswith("on") or key in {"src","srcset","href","action"} for key in attrs), (tag,attrs)
        if tag=="meta" and attrs.get("http-equiv","").lower()=="content-security-policy":
            self.policies.append(attrs.get("content"))
    def handle_data(self,data): self.text.append(data)
rows=[]
for relative in receipt["htmlPaths"]:
    path=root/relative
    data=path.read_bytes()
    p=ReviewParser()
    p.feed(data.decode("utf-8",errors="strict"))
    p.close()
    assert p.policies==["default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"]
    assert "csv-injected" not in p.ids
    text="".join(p.text)
    assert "Fictional snapshot" in text and "no live payments" in text
    if "accepted-csv/" in relative or "package-command/" in relative:
        assert '<img id="csv-injected" src="https://invalid.test/x" onerror="globalThis.csvInjected=true">' in text
        assert "=SUM(A1:A2)" in text
        assert "  Launch & 雪  " in text
    rows.append({"path":relative,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"parsedStartTags":len(p.tags),"activeResourcesOrControls":0,"CSP":"exact unchanged exporter","literalCSVPayload":"text only" if "accepted-csv/" in relative or "package-command/" in relative else None})
result={"result":"PASS","head":receipt["head"],"htmlArtifacts":len(rows),"rows":rows,"boundary":"Independent Python standard-library HTMLParser on actual native command outputs. Structural parsing and byte identity only; no browser rendering or execution."}
(root/"independent-v2/html-parser.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(result,ensure_ascii=False,indent=2))
