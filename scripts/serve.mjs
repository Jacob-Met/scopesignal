import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('ScopeSignal could not start: PORT must be an integer from 0 to 65535.');
  process.exitCode = 1;
} else {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const safe = normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '');
      const path = join(root, safe || 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
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
