import { readFile, mkdir, writeFile, chmod } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (b) => createHash('sha1').update(Buffer.from('blob ' + b.length + '\0')).update(b).digest('hex');
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw new Error('Supply a new absolute output directory.');
const outer = JSON.parse(await readFile(new URL('./raw-records.json', import.meta.url), 'utf8'));
const compressed = Buffer.from(outer.payload_gzip_base64, 'base64');
if (compressed.length !== outer.gzip_bytes || sha(compressed) !== outer.gzip_sha256) throw new Error('Compressed payload mismatch.');
const payload = gunzipSync(compressed);
if (payload.length !== outer.payload_bytes || sha(payload) !== outer.payload_sha256) throw new Error('Payload mismatch.');
const records = JSON.parse(payload.toString('utf8'));
const verified = new Map();
for (const [digest, item] of Object.entries(records.blobs)) {
  if (item.publication_path && !/^images\/[A-Za-z0-9-]+\.png$/.test(item.publication_path)) throw new Error('Unsafe image reference.');
  const b = item.publication_path ? await readFile(new URL('./' + item.publication_path, import.meta.url)) : Buffer.from(item.base64, 'base64');
  if (b.length !== item.bytes || sha(b) !== digest || git(b) !== item.git_blob) throw new Error('Blob mismatch: ' + digest);
  verified.set(digest, b);
}
for (const alias of records.aliases) {
  const parts = alias.path.split('/');
  if (path.isAbsolute(alias.path) || parts.some(p => !p || p === '.' || p === '..' || p.includes('\\'))) throw new Error('Unsafe alias.');
  const b = verified.get(alias.sha256);
  if (!b || b.length !== alias.bytes || git(b) !== alias.git_blob || !['100644', '100755'].includes(alias.mode)) throw new Error('Alias mismatch.');
}
await mkdir(destination, { recursive: false });
for (const alias of records.aliases) {
  const target = path.join(destination, alias.path);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, verified.get(alias.sha256), { flag: 'wx' });
  await chmod(target, alias.mode === '100755' ? 0o755 : 0o644);
}
console.log(JSON.stringify({ aliases: records.aliases.length, unique_blobs: verified.size, destination }));
