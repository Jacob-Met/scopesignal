import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const actualRoot = await realpath(root);
const publicAsset = name => /^(?:[a-z0-9][a-z0-9_-]*\.(?:html|css|mjs)|src\/[a-z0-9][a-z0-9_-]*\.mjs)$/.test(name);
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('ScopeSignal could not start: PORT must be an integer from 0 to 65535.');
  process.exitCode = 1;
} else {
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' });
      res.end('Method not allowed');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const asset = pathname === '/' ? 'index.html' : pathname.slice(1);
      // Serve browser assets, not project manifests, Git metadata, tests or
      // launch scripts. A URL with encoded separators cannot escape this shape.
      if (!publicAsset(asset)) throw new Error('Not a browser asset');
      const path = join(root, asset);
      const resolved = await realpath(path);
      const inside = relative(actualRoot, resolved);
      // Refuse source-tree symlinks escaping the checkout (and symlinked files).
      if (!inside || inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) {
        throw new Error('Outside application root');
      }
      if (!(await lstat(path)).isFile()) throw new Error('Not a regular asset');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': types[extname(path)], 'cache-control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  server.on('error', error => {
    console.error(`ScopeSignal could not start on 127.0.0.1:${port}: ${error.code || error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`ScopeSignal at http://127.0.0.1:${server.address().port}`);
  });
}
