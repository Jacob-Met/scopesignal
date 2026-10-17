"""Ordinary bounded byte receiving of one accepted package; no extraction or execution."""
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse
import json, hashlib, zipfile, io

D = Path(__file__).resolve().parent
PARENT = '1Fa24MIEeJuKgF2jLjEjwvpqY4PDOInp8'
def pin(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())

package_raw = (D/'package.json').read_bytes()
PACKAGE_PIN = {'bytes': 12788, 'sha256': 'ac00d6a71dd551d75e16836263f4cccebcf3693cb77defce9c98c1bfc000df23'}
assert PACKAGE_PIN is not None, 'Exact package manifest binding is required'
assert pin(package_raw) == PACKAGE_PIN
package = json.loads(package_raw)
expected = dict(package['zip'], path=package['path'])
ARCHIVE_PIN = (338191, '5b86a8b3e222d4fe0588eb94ac0d779e2a78ebbdd801a9e083f940d374ed2d7b')
assert ARCHIVE_PIN is not None, 'Exact archive binding is required'
assert (expected['bytes'], expected['sha256']) == ARCHIVE_PIN
uploaded = json.loads((D/'package-upload.json').read_bytes())
assert uploaded['request'] == dict(file_uri=expected['path'], file_name=Path(expected['path']).name, mime_type='application/zip', parent_folder_id=PARENT)
upload = uploaded['response']
assert not upload.get('isError') and upload['structuredContent']['success'] is True
upload_meta = upload['structuredContent']
assert upload_meta['parent_id'] == PARENT and upload_meta['mime_type'] == 'application/zip'
fetched = json.loads((D/'package-fetch.private.json').read_bytes())['response']
assert not fetched.get('isError')
meta = fetched['structuredContent']
assert (meta['id'], meta['mime_type'], meta['file_size_bytes'], meta['parent_ids']) == (upload_meta['id'], 'application/zip', expected['bytes'], [PARENT])
url = meta['file_uri']['download_url']
parsed = urlparse(url)
assert parsed.scheme == 'https' and parsed.hostname.endswith('.oaiusercontent.com')
destination = D/'fresh-ScopeSignal-Shown-Events-dcad391d.zip'
assert not destination.exists() and not (D/'package-delivery.json').exists()
with urlopen(url, timeout=30) as response:
    status = response.status
    body = response.read(expected['bytes'] + 1)
    assert status == 200
assert pin(body) == dict(bytes=expected['bytes'], sha256=expected['sha256'])
assert body == Path(expected['path']).read_bytes()
with destination.open('xb') as stream:
    assert stream.write(body) == len(body)

members = {row['path']: {key:row[key] for key in ('bytes','sha256','git_blob')} for row in package['members']}
payloads = {}
with zipfile.ZipFile(io.BytesIO(body)) as archive:
    assert archive.namelist() == sorted(members) and len(members) == 54
    assert archive.comment == b'' and archive.testzip() is None
    for info in archive.infolist():
        assert not info.is_dir() and info.file_size == members[info.filename]['bytes']
        assert info.date_time == (2026, 10, 17, 6, 0, 0) and info.compress_type == zipfile.ZIP_STORED
        assert info.create_system == 3 and info.external_attr == 0o100644 << 16
        assert info.extra == info.comment == b'' and not info.flag_bits & 1
        raw = archive.read(info.filename)
        assert pin(raw) == {key:members[info.filename][key] for key in ('bytes','sha256')}
        assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == members[info.filename]['git_blob']
        assert raw == (D/'payload'/info.filename).read_bytes()
        payloads[info.filename] = raw
assert sum(map(len, payloads.values())) == package['payload_bytes'] == 331731
practical = json.loads(payloads['SOURCE.json'])
assert len(practical['files']) == 53
assert {row['path']: {key:row[key] for key in ('bytes','sha256')} for row in practical['files']} == {name:pin(raw) for name,raw in payloads.items() if name!='SOURCE.json'}
assert practical['source_revision'] == package['source_revision'] == 'dcad391d11a66a43df32ae1051a48c5ebd22ff34'
assert practical['schema'] == 'scopesignal.shown-events.review-kit.source/1'
assert practical['status'] == 'VERIFIED_NONDEFAULT_SOURCE_PREPARED_TRANSFER_AND_BROWSER_RECEIVING_PENDING'
source_rows=[row for row in practical['files'] if row['source_revision']==package['source_revision']]
assert len(source_rows)==51 and sorted(row['path'] for row in source_rows)==sorted(practical['source_files'])
assert all(row['git_blob']==members[row['path']]['git_blob'] for row in practical['files'])
proof = dict(schema='scopesignal.shown-events.review-kit.package-delivery/1', status='ACCEPT_ONE_ORDINARY_FRESH_PACKAGE_AND_PRACTICAL_SOURCE_MANIFEST', id=meta['id'], url=meta['url'], parent_ids=meta['parent_ids'], http_status=status, fresh_path=str(destination), **pin(body), member_count=54, payload_bytes=331731, members=members, practical_manifest=practical, qualification='One ordinary upload and fresh complete-byte receive of the fifty-four accepted ScopeSignal review-kit files. All whole members, CRCs, exact metadata, fifty-three manifest rows and fifty-one nondefault source Git blobs joined without extraction or server/module/test/browser/native execution. The eight accepted controlled-DOM groups and historical issue80 browser receiving remain separate. This unchanged preparation snapshot keeps kit transfer and issue82 browser receiving pending; this delivery proof closes only its transfer receiving.')
with (D/'package-delivery.json').open('x') as stream:
    json.dump(proof, stream, indent=2)
    stream.write('\n')
print(json.dumps(proof))
