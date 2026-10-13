#!/usr/bin/env python3
"""Verify the exact ScopeSignal saved-reader companion; no server/browser launch."""
from pathlib import Path, PurePosixPath
import base64
import gzip
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = "91a853ce67418147743adc42afea2c97ce5aef83"


def require(ok, message):
    if not ok:
        raise ValueError(message)


def body(name):
    rel = PurePosixPath(name)
    require(not rel.is_absolute() and ".." not in rel.parts and "\\" not in name, "unsafe path: " + name)
    p = ROOT.joinpath(*rel.parts)
    require(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(ROOT), "missing or linked file: " + name)
    return p.read_bytes()


def record(name):
    return json.loads(body(name))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def main():
    manifest = record("MANIFEST.json")
    require(manifest["schema"] == "scopesignal-event-filter-companion/v1", "manifest schema")
    require(len(manifest["files"]) == len({x["path"] for x in manifest["files"]}), "duplicate payload path")
    for item in manifest["files"]:
        b = body(item["path"])
        require(len(b) == item["bytes"] and sha(b) == item["sha256"], "payload mismatch: " + item["path"])
    pins = record("SOURCE-PINS.json")
    require(pins["source"] == SOURCE and pins["branch"] == "estate/record-event-filter-2766b0fc", "source pin")
    for path, pin in pins["files"].items():
        require(git(body(path)) == pin["git_blob"], "Git blob mismatch: " + path)
    packet = record("evidence/source-packet.json")
    require(len(packet["files"]) == 18 and packet["source"] == pins["base"], "source packet")
    for path, text in packet["files"].items():
        require(body("source/" + path) == text.encode("utf-8"), "native source differs: " + path)
    for path, blob in packet["originalBlobs"].items():
        require(git(body("source/original/" + path)) == blob, "original blob differs: " + path)

    envelope = record("evidence/authored-fixtures.gzip.json")
    raw = gzip.decompress(base64.b64decode(envelope["gzipBase64"], validate=True))
    require(len(raw) == envelope["bytes"] and sha(raw) == envelope["sha256"], "fixture envelope")
    fixtures = json.loads(raw)
    require(len(fixtures) == 6, "fixture count")
    for item in fixtures:
        b = item["content"].encode("utf-8")
        require(b == body(item["name"]) and len(b) == item["bytes"] and sha(b) == item["sha256"] and git(b) == item["gitBlob"], "fixture differs: " + item["name"])

    runtime = record("RUNTIME-PINS.json")
    require(runtime["source"] == SOURCE and len(runtime["files"]) == 7, "runtime pins")
    for path, pin in runtime["files"].items():
        b = body("source/candidate/" + path)
        require(len(b) == pin["bytes"] and sha(b) == pin["sha256"], "runtime mismatch: " + path)
    native = record("evidence/native-receipt.json")
    require(native["sourceCommit"] == SOURCE, "native source pin")
    for item in native["receipts"]:
        b = body("evidence/native/" + item["name"])
        require(len(b) == item["bytes"] and sha(b) == item["sha256"] and git(b) == item["gitBlob"], "native receipt mismatch")
    for mode, passed in (("original", 2), ("candidate", 10)):
        r = record("evidence/native/" + mode + "-browser/result.json")
        require(r["passed"] == passed and r["total"] == 10 and len(r["groups"]) == 10, "browser totals")
        require(sum(x["pass"] is True for x in r["groups"]) == passed, "browser group outcomes")
        require(r["sourceUnchanged"] and r["externalRequests"] == [] and r["pageErrors"] == [], "browser source/errors/network")
        for item in r["sources"]:
            b = body("source/" + mode + "/" + item["path"])
            require(len(b) == item["bytes"] and sha(b) == item["sha256"], "browser source hash")
        for item in r["fixtures"]:
            require(sha(body("fixtures/" + item["path"])) == item["sha256"], "browser fixture binding")
    candidate = record("evidence/native/candidate-browser/result.json")
    maximum = next(g for g in candidate["groups"] if g["name"].startswith("maximum admitted"))
    require(maximum["detail"] == {"total": 512, "webhooks": 507, "finalSequence": 512}, "maximum history observation")
    review = record("evidence/independent-review.json")
    require(review["review"] == "PASS" and review["sourceCommit"] == SOURCE, "independent review")
    for path, digest in review["sourceHashes"].items():
        require(sha(body("source/candidate/" + path)) == digest, "reviewed source hash")
    received = record("receiving/opener-result.json")
    require(received["ok"] and received["source"] == SOURCE and received["exit"] == 0 and received["stderr"] == "", "opener receiving")
    require(received["foreignSpacedUnicodeDirectory"] and received["sourceUnchanged"] and received["ownedProcessClosedAndPortRefused"], "opener closure")
    require(len(received["observations"]) == 12, "opener observations")
    for item in received["observations"][:7]:
        path = item["path"].lstrip("/")
        require(item["status"] == 200 and item["sha256"] == runtime["files"][path]["sha256"] and item["exact"], "served runtime differs")
    result = {"ok": True, "payloads": len(manifest["files"]), "publishedGitBlobs": len(pins["files"]),
              "sourcePacketBodies": 18, "authoredFixtures": 6, "runtimeFiles": 7,
              "nativeOriginal": "2/10 passed", "nativeCandidate": "10/10 passed",
              "openerHttpObservations": 12,
              "qualification": "Custody and recorded receiving; no new browser, server or installed application execution."}
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print("Verification failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)
