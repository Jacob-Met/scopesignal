import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const usage = 'Usage: node scripts/package-offline.mjs --out NEW_DIRECTORY --source-ref COMMIT_OR_VERSION';

async function options(argv) {
  if (argv.length !== 4 || argv[0] !== '--out' || argv[2] !== '--source-ref' || !argv[1] || !argv[3]) throw Error(usage);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(argv[3])) throw Error('Source ref must be a short commit or version label.');
  const requested = resolve(argv[1]);
  // mkdir below requires an existing parent. Resolve it before admission so a
  // directory symlink or junction cannot put the package inside the source.
  const output = join(await realpath(dirname(requested)), basename(requested));
  const within = relative(await realpath(root), output);
  if (!within || (!within.startsWith(`..${sep}`) && within !== '..' && !isAbsolute(within))) throw Error('Choose a new output directory outside the source tree.');
  return { output, sourceRef: argv[3] };
}

async function regular(path) {
  if (!(await lstat(join(root, path))).isFile()) throw Error(`Source is not a regular file: ${path}`);
  return readFile(join(root, path));
}

const verifier = `import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'MANIFEST.json'), 'utf8'));
const walk = async (dir = '') => {
  const paths = [];
  for (const item of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = dir ? dir + '/' + item.name : item.name;
    if (item.isDirectory()) paths.push(...await walk(path));
    else if (item.isFile()) paths.push(path);
    else throw Error('Non-regular package entry: ' + path);
  }
  return paths.sort();
};
if (manifest.schema !== 'scopesignal.offline-package' || manifest.version !== 1 || !Array.isArray(manifest.files)) throw Error('Unsupported package manifest.');
const expected = manifest.files.map(file => file.path).concat('MANIFEST.json').sort();
if (JSON.stringify(await walk()) !== JSON.stringify(expected)) throw Error('Package file inventory differs from its manifest. Extract a fresh copy.');
for (const file of manifest.files) {
  if (!/^[A-Za-z0-9_.-]+(?:\\/[A-Za-z0-9_.-]+)*$/.test(file.path) || file.path.split('/').some(p => p === '.' || p === '..')) throw Error('Invalid package path.');
  const path = join(root, file.path);
  if (!(await lstat(path)).isFile()) throw Error('Non-regular package file: ' + file.path);
  const bytes = await readFile(path);
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error('Package file changed: ' + file.path);
}
console.log('Verified ' + manifest.files.length + ' package files; declared source ' + manifest.sourceRef + '.');
`;

const launcher = `import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
await import('./verify-package.mjs');
const value = process.env.PORT ?? '4173';
if (!/^[0-9]+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) throw Error('PORT must be an integer from 1 to 65535.');
process.env.PORT = String(Number(value));
process.chdir(dirname(fileURLToPath(import.meta.url)));
await import('./scripts/serve.mjs');
`;

try {
  const { output, sourceRef } = await options(process.argv.slice(2));
  const paths = ['LICENSE', 'README.md', 'docs/authored-scope-history.md', 'package.json', 'scripts/serve.mjs'];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (/\.(html|css|mjs)$/.test(entry.name)) paths.push(entry.name);
  }
  for (const entry of await readdir(join(root, 'src'), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mjs')) throw Error(`Unrecognized source entry: src/${entry.name}`);
    paths.push(`src/${entry.name}`);
  }
  paths.sort();
  const payload = new Map();
  for (const path of paths) payload.set(path, await regular(path));
  const pages = paths.filter(path => path.endsWith('.html'));
  if (!pages.includes('index.html')) throw Error('The application entry page is missing.');
  for (const [path, bytes] of payload) {
    if (path.endsWith('.css') && /(?:@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/)/i.test(bytes.toString('utf8'))) throw Error(`External stylesheet resource in ${path}.`);
  }
  const guide = `# ScopeSignal — offline review package\n\nDeclared source: ${sourceRef}\n\nRequires Node.js 24 or newer. Extract every file into one new directory. Run:\n\n    node start-scopesignal.mjs\n\nThe command verifies all packaged files, then prints the loopback URL. Open that URL in a modern browser. From a different working directory, pass the full path to start-scopesignal.mjs. Keep this terminal open; Ctrl+C stops the server. To use another fixed port, set PORT to an integer from 1 to 65535 before launching. Port 0 is deliberately refused by this wrapper because the inherited server does not report its actual ephemeral port. No installation, npm install, account or external font download is needed.\n\n## Pages\n\n${pages.map(page => '- ' + page).join('\n')}\n\nStart with index.html for the deterministic fixture, scope.html to author a fictional scope, record.html to inspect a saved fixture record, scope-csv.html for checkpoint CSV intake, scope-compare.html for paired reviews, or scope-library.html for saved workspace reviews. Use the page's explicit download action to keep your work. Downloads belong outside this application directory so verification continues to match the unchanged package. Browser page memory is cleared on reload. The fixture and simulation are synthetic; no live payment or provider call is enabled.\n\n## Verify and recover\n\n    node verify-package.mjs\n\nMANIFEST.json records every source and generated file's byte count and SHA-256. It identifies a caller-supplied source ref; it is an integrity inventory, not a signed proof of authorship. If any file changes or the inventory differs, extract a fresh copy. Source and usage details are in README.md; source is https://github.com/Jacob-Met/scopesignal.\n`;
  for (const [path, content] of [['START-HERE.md', guide], ['start-scopesignal.mjs', launcher], ['verify-package.mjs', verifier]]) {
    if (payload.has(path)) throw Error(`Generated file collides with source: ${path}`);
    payload.set(path, Buffer.from(content));
  }
  const files = [...payload].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes), origin: paths.includes(path) ? 'source' : 'packaging' })).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const manifest = { schema: 'scopesignal.offline-package', version: 1, sourceRef, sourceRefKind: 'caller-supplied label', pages, files };
  // Admission completes before exclusive output creation. Existing paths are never replaced.
  await mkdir(output);
  for (const [path, bytes] of payload) {
    await mkdir(dirname(join(output, path)), { recursive: true });
    await writeFile(join(output, path), bytes, { flag: 'wx' });
  }
  await writeFile(join(output, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, sourceRef, pages, files: files.length, manifestSha256: sha256(await readFile(join(output, 'MANIFEST.json'))) }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
