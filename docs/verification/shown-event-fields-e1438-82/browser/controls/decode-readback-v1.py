"""Decode one complete read-only RDC carrier, preserving whole returned originals."""
import base64
import hashlib
import json
from pathlib import Path
import sys
import zlib

ROOT = r'C:\Users\Veria\hamon-e1438c9d058f-scopesignal-visible-events-82'
ALLOWED = {
    'stage': ['bootstrap-receipt.json', 'browser-config.json', 'stage-receipt.json'],
    'browser': ['browser-v1/receiving.json', 'browser-v1/browser.stdout', 'browser-v1/browser.stderr',
                'browser-v1/events-desktop.png', 'browser-v1/events-narrow.png',
                'browser-v1/downloads/scopesignal-record-review.html'],
    'receipt': ['browser-v1/receiving.json', 'browser-v1/browser.stdout', 'browser-v1/browser.stderr'],
}

def require(ok, message):
    if not ok:
        raise ValueError(message)

def digest(body):
    return hashlib.sha256(body).hexdigest()

def main():
    require(len(sys.argv) >= 4, 'mode, new output directory and original tool responses required')
    mode, target = sys.argv[1], Path(sys.argv[2])
    require(mode in ALLOWED and not target.exists() and target.parent.is_dir(), 'invalid mode or output directory')
    lines = []
    for name in sys.argv[3:]:
        response = json.loads(Path(name).read_bytes())
        require(not response.get('isError'), 'remote tool error')
        for block in response.get('content', []):
            if block.get('type') == 'text':
                lines.extend(block['text'].splitlines())
    headers = [json.loads(line[len('SC82_BEGIN '):]) for line in lines if line.startswith('SC82_BEGIN ')]
    chunks = [line[len('SC82_DATA '):].split(' ', 1) for line in lines if line.startswith('SC82_DATA ')]
    require(len(headers) == 1 and lines.count('SC82_END') == 1, 'incomplete or duplicated carrier')
    framed = [line for line in lines if line.startswith('SC82_')]
    require(framed[0].startswith('SC82_BEGIN ') and framed[-1] == 'SC82_END'
            and all(line.startswith('SC82_DATA ') for line in framed[1:-1]), 'carrier framing order differs')
    h = headers[0]
    require(h['mode'] == mode and len(chunks) == h['chunks'], 'carrier mode or chunk count differs')
    require([int(x[0]) for x in chunks] == list(range(len(chunks))), 'carrier sequence differs')
    encoded = ''.join(x[1] for x in chunks)
    compressed = base64.b64decode(encoded, validate=True)
    carrier_cap = (2 if mode == 'stage' else 16) * 1024**2
    require(len(compressed) == h['gzip_bytes'] <= carrier_cap and digest(compressed) == h['gzip_sha256'], 'carrier whole identity differs')
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    body = decoder.decompress(compressed, 40 * 1024**2 + 1)
    require(len(body) <= 40 * 1024**2 and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail, 'invalid or oversized gzip stream')
    require(len(body) == h['envelope_bytes'] and digest(body) == h['envelope_sha256'], 'envelope whole identity differs')
    e = json.loads(body)
    require(e['schema'] == 'scopesignal.shown-disclosures.readback/1' and e['root'] == ROOT and e['mode'] == mode, 'envelope target differs')
    files, missing, refused = e['files'], e.get('missing', []), e.get('refused', [])
    names = [x['path'] for x in files + missing + refused]
    require(len(names) == len(set(names)) and sorted(names) == sorted(ALLOWED[mode]), 'fixed original coverage differs')
    if mode == 'stage':
        require(not missing and not refused, 'stage readback is incomplete')
    received = []
    total = 0
    for item in files:
        data = base64.b64decode(item['base64'], validate=True)
        require(len(data) == item['bytes'] and digest(data) == item['sha256'], 'original identity differs')
        cap = 8 * 1024**2 if item['path'].endswith('.png') else 4 * 1024**2 if item['path'].endswith(('.stdout', '.stderr')) else 64 * 1024 if item['path'].endswith('.html') else 2 * 1024**2
        require(len(data) <= cap, 'original exceeds fixed cap')
        total += len(data)
        received.append((item, data))
    require(total <= (4 if mode == 'stage' else 27) * 1024**2, 'original set exceeds cap')
    target.mkdir()
    for item, data in received:
        out = target / item['path']
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open('xb') as stream:
            stream.write(data)
        require(out.read_bytes() == data, 'local original readback differs')
    report = {'schema': 'scopesignal.shown-disclosures.decoded-readback/1',
              'status': 'COMPLETE' if not missing and not refused else 'PARTIAL_PRESERVED',
              'mode': mode, 'files': [{k: v for k, v in x.items() if k != 'base64'} for x in files],
              'missing': missing, 'refused': refused, 'original_bytes': total,
              'envelope_sha256': h['envelope_sha256'], 'gzip_sha256': h['gzip_sha256']}
    with (target / 'READBACK.json').open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'status': report['status'], 'mode': mode, 'files': len(files), 'bytes': total,
                      'missing': len(missing), 'refused': len(refused)}))

if __name__ == '__main__':
    main()
