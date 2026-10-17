"""Wrap the accepted finite source folder once; never execute its contents."""
from pathlib import Path
import hashlib
import json
import zipfile

D = Path(__file__).resolve().parent

def pin(raw):
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'git_blob': hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()}

selection_raw = (D/'kit-selection.json').read_bytes()
selection = json.loads(selection_raw)
assert selection['regular_files'] == 54 and selection['typed_entries'] == 60
SOURCE_REVISION = 'dcad391d11a66a43df32ae1051a48c5ebd22ff34'
PAYLOAD_BYTES = 331731
assert SOURCE_REVISION and PAYLOAD_BYTES, 'Exact accepted kit binding is required'
assert selection['source_revision'] == SOURCE_REVISION
rows = selection['files']
assert [r['path'] for r in rows] == sorted(r['path'] for r in rows)
payload = D/'payload'
assert {str(p.relative_to(payload)) for p in payload.rglob('*') if p.is_file()} == {r['path'] for r in rows}
bodies = {}
for row in rows:
    path = payload/row['path']
    assert path.is_file() and not path.is_symlink()
    body = path.read_bytes()
    assert pin(body) == {k: row[k] for k in ('bytes', 'sha256', 'git_blob')}
    bodies[row['path']] = body
assert sum(map(len, bodies.values())) == selection['payload_bytes'] == PAYLOAD_BYTES
archive_path = D/('ScopeSignal-Shown-Events-'+SOURCE_REVISION[:8]+'.zip')
with zipfile.ZipFile(archive_path, 'x', compression=zipfile.ZIP_STORED) as archive:
    for name, body in bodies.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 17, 6, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_STORED
        archive.writestr(info, body)
with zipfile.ZipFile(archive_path) as archive:
    assert archive.namelist() == list(bodies) and archive.testzip() is None
    assert archive.comment == b''
    for info in archive.infolist():
        assert not info.is_dir() and info.file_size == len(bodies[info.filename])
        assert info.date_time == (2026, 10, 17, 6, 0, 0)
        assert info.compress_type == zipfile.ZIP_STORED and info.create_system == 3
        assert info.external_attr == 0o100644 << 16 and info.extra == info.comment == b''
        assert not info.flag_bits & 1
        assert archive.read(info.filename) == bodies[info.filename]
for name, body in bodies.items():
    assert (payload/name).read_bytes() == body
package = {'schema': 'scopesignal.shown-events.review-kit.package/1',
           'path': str(archive_path), 'zip': pin(archive_path.read_bytes()),
           'members': rows, 'payload_bytes': selection['payload_bytes'],
           'source_revision': selection['source_revision'], 'source_tree': selection['source_tree'],
           'selection': pin(selection_raw), 'source_bodies_unchanged': True,
           'qualification': 'One ZIP_STORED wrapping of the accepted fifty-four review-kit files. Exact root-relative names, fixed metadata, CRCs and whole-member equality checked. No server, module, test, browser or native invocation.'}
with (D/'package.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(package, stream, indent=2)
    stream.write('\n')
print(json.dumps({k:v for k,v in package.items() if k != 'members'}))
