# Checkpoint-combine receiving custody

The exact source commit is 746635a3437d2ba57523bc5659238dba968a2d60, parent 6f17ea30fe8659dc4ae47cae6cb3a8e32c1d2508. Its nine changed source files preserve the unchanged native draft codec, money parser and shared modules. This directory is a separate custody addition and does not change the executed source.

The archive has 865,632 bytes and 200 members, SHA-256 4df18906e93708c6815c4ccb46efd0541bc385d728659a3e50159cc830e6e993. It includes original source, the full canonical source inventory, author and receiving scripts/stdout/stderr/receipts, actual physical downloads, four screenshots, the root's original 17-member independent packet and all original setup/receiver negatives. Every member was reopened and checked.

Receiving covered 12 native Node 22 author groups, an independent 17 complete-object / 40-refusal contract, independent source and actual-download review, and the completed browser continuation. The unchanged native workspace explicitly imported and resaved the real 724-byte result with the same complete bytes. Original R2 Buffer/count and R3 width-equality receiver failures are retained with separate corrections.

Node 24 and the full-project gate remain required and unrun. This feature-branch custody is not a PR, deployment, merge or approval claim. Both original workflows remain unchanged.

## Reassemble the frozen archive

Run the following from this directory with Python 3; it performs no network requests or dependency installation and refuses to overwrite an existing archive.

~~~python
from pathlib import Path
import base64, hashlib, json, zipfile

manifest = json.loads(Path("archive-manifest.json").read_text())
chunks = []
for expected in manifest["parts"]:
    raw = Path(expected["path"]).read_bytes()
    assert len(raw) == expected["fileBytes"]
    assert hashlib.sha256(raw).hexdigest() == expected["fileSha256"]
    part = json.loads(raw)
    data = base64.b64decode(part["data"], validate=True)
    assert len(data) == expected["decodedBytes"]
    assert hashlib.sha256(data).hexdigest() == expected["decodedSha256"]
    chunks.append(data)
archive = b"".join(chunks)
assert len(archive) == manifest["archiveBytes"]
assert hashlib.sha256(archive).hexdigest() == manifest["archiveSha256"]
with Path(manifest["archiveName"]).open("xb") as output:
    output.write(archive)
with zipfile.ZipFile(manifest["archiveName"]) as packet:
    assert packet.testzip() is None
    assert len(packet.infolist()) == manifest["archiveMembers"]
~~~

SOURCE-DELIVERY.md and QUALIFICATION.json inside the archive explain the exact evidence boundaries and local reopening instructions. Publication/readback receipts are kept separately so the original receiving archive stays immutable.
