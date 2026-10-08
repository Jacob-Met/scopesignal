#!/usr/bin/env python3
"""Receive deployed ScopeSignal static assets without running a browser or product code."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
PLAN_PATH = ROOT / "public-assets-plan.json"
INPUT_PATH = ROOT / "postmerge-receiving-input.json"
OUT = ROOT / "public-assets-v1"
ACTOR = "chatgpt:68094585a1c2 / delivery_continuation"

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def digest(data):
    return {
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "git_blob": hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest(),
    }

plan_bytes = PLAN_PATH.read_bytes()
post_bytes = INPUT_PATH.read_bytes()
plan = json.loads(plan_bytes)
post = json.loads(post_bytes)
merge = post["merge_commit"]["sha"]
assert post["merge_commit"]["tree"]["sha"] == plan["expected_source_tree"]
assert post["pull_request"]["merged"] and post["pull_request"]["merge_commit_sha"] == merge
assert post["pull_request"]["head"]["sha"] == plan["source_head"]
assert all(r["status"] == "completed" and r["conclusion"] == "success" and r["head_sha"] == merge for r in post["runs"])
assert post["received_test_jobs"] and all(j["checkout"] == merge and j["conclusion"] == "success" for j in post["received_test_jobs"])
assert post["raw_pages_logs"]
assert any(merge in row["log"] and "Reported success!" in row["log"] for row in post["raw_pages_logs"])
base_url = post["pages_environment_url"]
parts = urllib.parse.urlsplit(base_url)
assert parts.scheme in {"http", "https"} and parts.netloc and not parts.username and not parts.password
if not base_url.endswith("/"):
    base_url += "/"
assert len(plan["expected_assets"]) == 18
OUT.mkdir(exist_ok=False)
started = now()

def receive(expected):
    relative = expected["path"]
    assert not relative.startswith("/") and ".." not in pathlib.PurePosixPath(relative).parts
    url = urllib.parse.urljoin(base_url, relative)
    request = urllib.request.Request(url, headers={
        "User-Agent": "HAMON-asset-receiving/68094585a1c2",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
    })
    result = {"path": relative, "requested_url": url, "started_at": now(), "expected": expected}
    body = b""
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read(2000001)
            result.update({
                "status": response.status,
                "final_url": response.geturl(),
                "headers": dict(response.headers.items()),
                "body_truncated": len(body) > 2000000,
            })
    except urllib.error.HTTPError as error:
        body = error.read(2000001)
        result.update({
            "status": error.code,
            "final_url": error.geturl(),
            "headers": dict(error.headers.items()),
            "body_truncated": len(body) > 2000000,
            "error": type(error).__name__ + ": " + str(error),
        })
    except Exception as error:
        result.update({"status": None, "error": type(error).__name__ + ": " + str(error)})
    destination = OUT / "responses" / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(body)
    result["observed"] = digest(body)
    result["saved_path"] = str(destination.relative_to(ROOT))
    result["exact_expected_git_blob"] = (
        result.get("status") == 200
        and not result.get("body_truncated", False)
        and result["observed"]["git_blob"] == expected["git_blob"]
        and result["observed"]["bytes"] == expected["bytes"]
    )
    result["completed_at"] = now()
    return result

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(receive, row) for row in plan["expected_assets"]]
    for future in concurrent.futures.as_completed(futures):
        row = future.result()
        results.append(row)
        (OUT / "progress.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"path": row["path"], "status": row.get("status"), "exact": row["exact_expected_git_blob"]}), flush=True)

results.sort(key=lambda row: row["path"])
receipt = {
    "format": "scopesignal-public-asset-receiving/1",
    "actor": ACTOR,
    "started_at": started,
    "completed_at": now(),
    "actual_merge": merge,
    "actual_merge_tree": post["merge_commit"]["tree"]["sha"],
    "source_head": plan["source_head"],
    "plan": {"path": str(PLAN_PATH), **digest(plan_bytes)},
    "postmerge_input": {"path": str(INPUT_PATH), **digest(post_bytes)},
    "script": {"path": str(pathlib.Path(__file__).resolve()), **digest(pathlib.Path(__file__).read_bytes())},
    "pages_environment_url": base_url,
    "requested_html_url": urllib.parse.urljoin(base_url, "scope.html"),
    "request_count": len(results),
    "passed": sum(row["exact_expected_git_blob"] for row in results),
    "all_exact": all(row["exact_expected_git_blob"] for row in results),
    "results": results,
    "limits": {
        "browser_runs": 0,
        "product_code_executed": False,
        "rendered_combined_undo_witness": "unobserved",
        "installed_runtime_qualification": False,
        "claim": "Public HTTP status and response bytes only, bound to the actual successful hosted merge.",
    },
}
(OUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"receipt": str(OUT / "receipt.json"), "request_count": len(results), "passed": receipt["passed"], "all_exact": receipt["all_exact"]}), flush=True)
raise SystemExit(0 if receipt["all_exact"] else 1)
