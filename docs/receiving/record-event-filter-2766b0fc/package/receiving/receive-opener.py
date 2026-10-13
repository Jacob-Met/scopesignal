#!/usr/bin/env python3
"""Receive the focused opener from a new spaced/Unicode directory; no browser."""
from pathlib import Path
import hashlib
import http.client
import json
import os
import re
import selectors
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent


def run():
    pins = json.loads((ROOT / "RUNTIME-PINS.json").read_text())
    started = time.time()
    with tempfile.TemporaryDirectory(prefix="Scope viewer receiving café ", dir=ROOT.parent) as scratch:
        fresh = Path(scratch) / "Fresh source with spaces"
        foreign = Path(scratch) / "Foreign launch folder"
        fresh.mkdir()
        foreign.mkdir()
        (foreign / "record.html").write_text("foreign-folder decoy", encoding="utf-8")
        for name in ["open-record.mjs", "RUNTIME-PINS.json"]:
            shutil.copyfile(ROOT / name, fresh / name)
        for name in pins["files"]:
            dest = fresh / "source/candidate" / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / "source/candidate" / name, dest)
        node = shutil.which("node")
        if not node:
            raise RuntimeError("Node is required")
        child = subprocess.Popen([node, str(fresh / "open-record.mjs")], cwd=foreign,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        observed = []
        stdout = []
        port = None
        selector = selectors.DefaultSelector()
        selector.register(child.stdout, selectors.EVENT_READ)
        try:
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and port is None:
                if child.poll() is not None:
                    raise RuntimeError("opener exited before ready")
                if not selector.select(.2):
                    continue
                line = child.stdout.readline()
                stdout.append(line)
                match = re.search(r"http://127\.0\.0\.1:(\d+)/record\.html", line)
                if match:
                    port = int(match.group(1))
            if port is None:
                raise RuntimeError("opener readiness timeout")
            def request(path, method="GET"):
                conn = http.client.HTTPConnection("127.0.0.1", port, timeout=4)
                try:
                    conn.request(method, path)
                    response = conn.getresponse()
                    data = response.read()
                    return response.status, dict(response.getheaders()), data
                finally:
                    conn.close()
            for name, pin in pins["files"].items():
                status, headers, data = request("/" + name)
                expected = (ROOT / "source/candidate" / name).read_bytes()
                assert status == 200 and data == expected
                assert headers["Content-Length"] == str(pin["bytes"])
                assert headers["Cache-Control"] == "no-store"
                content_type = "text/html" if name.endswith(".html") else "text/css" if name.endswith(".css") else "text/javascript"
                assert headers["Content-Type"].startswith(content_type)
                observed.append({"path": "/" + name, "method": "GET", "status": status,
                                 "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "exact": True})
            for path in ("/", "/record.html?local=1"):
                status, _, data = request(path)
                assert status == 200 and data == (ROOT / "source/candidate/record.html").read_bytes()
                observed.append({"path": path, "method": "GET", "status": status, "exact": True})
            status, headers, data = request("/record.html", "HEAD")
            assert status == 200 and data == b"" and headers["Content-Length"] == str(pins["files"]["record.html"]["bytes"])
            observed.append({"path": "/record.html", "method": "HEAD", "status": status, "emptyBody": True})
            status, _, data = request("/index.html")
            assert status == 404 and b"outside this packet" in data
            observed.append({"path": "/index.html", "method": "GET", "status": status, "scopeExplained": True})
            status, headers, _ = request("/record.html", "POST")
            assert status == 405 and headers["Allow"] == "GET, HEAD"
            observed.append({"path": "/record.html", "method": "POST", "status": status})
            for name in pins["files"]:
                assert (fresh / "source/candidate" / name).read_bytes() == (ROOT / "source/candidate" / name).read_bytes()
        finally:
            selector.close()
            if child.poll() is None:
                child.send_signal(signal.SIGINT)
            try:
                remaining, stderr = child.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                remaining, stderr = child.communicate()
                raise RuntimeError("owned opener required forced termination")
            stdout.append(remaining)
        assert child.returncode == 0 and stderr == ""
        sock = socket.socket()
        try:
            sock.settimeout(1)
            assert sock.connect_ex(("127.0.0.1", port)) != 0
        finally:
            sock.close()
        return {"schema": "scopesignal-focused-opener-receiving/v1", "ok": True,
                "source": pins["source"], "node": subprocess.check_output([node, "--version"], text=True).strip(),
                "pid": child.pid, "exit": child.returncode, "stdout": "".join(stdout), "stderr": stderr,
                "elapsedSeconds": round(time.time() - started, 3), "observations": observed,
                "foreignSpacedUnicodeDirectory": True, "sourceUnchanged": True,
                "ownedProcessClosedAndPortRefused": True,
                "qualification": "Actual local HTTP/source receiving on delivery executor; no new browser or installed application run."}


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
