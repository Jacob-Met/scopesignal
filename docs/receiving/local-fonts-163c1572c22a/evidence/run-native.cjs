const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = __dirname;
const carrier = JSON.parse(fs.readFileSync(path.join(root, 'native-carrier.json'), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const decoded = carrier.files.map(f => {
  if (!/^[A-Za-z0-9_.\/-]+$/.test(f.path) || f.path.split('/').includes('..')) throw Error('Unsafe path');
  const bytes = Buffer.from(f.base64, 'base64');
  if (bytes.length !== f.bytes || sha(bytes) !== f.sha256) throw Error('Carrier mismatch: ' + f.path);
  return {...f, data: bytes};
});
const receiver = Buffer.from(carrier.receiver.base64, 'base64');
if (sha(receiver) !== carrier.receiver.sha256) throw Error('Receiver hash mismatch');
const originalCss = Buffer.from(carrier.originalCss.base64, 'base64');
if (sha(originalCss) !== carrier.originalCss.sha256) throw Error('Original stylesheet hash mismatch');
const receiverPath = path.join(root, 'strict-record-receiver.mjs');
fs.writeFileSync(receiverPath, receiver, {flag: 'wx'});
const results = [];
for (const variant of ['original', 'candidate']) {
  const source = path.join(root, variant);
  fs.mkdirSync(source);
  for (const f of decoded) {
    const target = path.join(source, f.path);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, variant === 'original' && f.path === 'styles.css' ? originalCss : f.data, {flag: 'wx'});
  }
  const before = Object.fromEntries(decoded.map(f => [f.path, sha(fs.readFileSync(path.join(source, f.path)))]));
  const evidence = path.join(root, variant + '-evidence');
  if (fs.existsSync(evidence)) throw Error('Refuse evidence reuse');
  const env = {...process.env,
    SCOPESIGNAL_SOURCE: source,
    SCOPESIGNAL_EVIDENCE: evidence,
    SCOPESIGNAL_SOURCE_COMMIT: variant === 'original' ? carrier.baseCommit : 'reviewed-three-file-working-tree',
    SCOPESIGNAL_EXPECTATION: 'zero-external-requests',
    SCOPESIGNAL_PUPPETEER: 'C:/Users/Veria/AppData/Roaming/npm/node_modules/@wonderwhy-er/desktop-commander/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    SCOPESIGNAL_CHROME: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  };
  const started = new Date().toISOString();
  const child = spawnSync(process.execPath, [receiverPath], {cwd: root, env, encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024});
  fs.writeFileSync(path.join(root, variant + '.stdout.log'), child.stdout || '', {flag: 'wx'});
  fs.writeFileSync(path.join(root, variant + '.stderr.log'), child.stderr || '', {flag: 'wx'});
  const after = Object.fromEntries(decoded.map(f => [f.path, sha(fs.readFileSync(path.join(source, f.path)))]));
  const receiptPath = path.join(evidence, 'receipt.json');
  const receipt = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : null;
  const result = {variant, started, finished: new Date().toISOString(), childExit: child.status, childSignal: child.signal,
    childError: child.error ? String(child.error) : null, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after),
    sourceSha256: before, receiverSha256: sha(receiver), receiptSha256: receipt ? sha(fs.readFileSync(receiptPath)) : null,
    checks: receipt?.checks.length, failures: receipt?.failures, externalRequests: receipt?.externalRequests,
    browser: receipt?.browser, receiptPass: receipt?.passed};
  results.push(result);
  fs.writeFileSync(path.join(root, variant + '-process.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({variant, childExit: result.childExit, checks: result.checks, external: result.externalRequests?.length, sourceUnchanged: result.sourceUnchanged, failures: result.failures}));
  if (child.error || !receipt || !result.sourceUnchanged) break;
}
fs.writeFileSync(path.join(root, 'native-summary.json'), JSON.stringify({at: new Date().toISOString(), node: process.version, results}, null, 2) + '\n', {flag: 'wx'});
process.exitCode = results.length === 2 && results[0].childExit === 1 && results[1].childExit === 0 ? 0 : 1;
