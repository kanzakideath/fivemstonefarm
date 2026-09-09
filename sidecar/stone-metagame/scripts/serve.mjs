import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 4173;
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
};

const server = createServer((request, response) => {
  const raw = decodeURIComponent((request.url || '/').split('?')[0]);
  const relative = raw === '/' ? 'demo/index.html' : raw.replace(/^\/+/, '');
  const candidate = resolve(join(root, normalize(relative)));
  if (!candidate.startsWith(root + sep) && candidate !== root) {
    response.writeHead(403).end('Forbidden'); return;
  }
  let path = candidate;
  try { if (statSync(path).isDirectory()) path = join(path, 'index.html'); }
  catch { response.writeHead(404).end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  createReadStream(path).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Stone metagame preview: http://127.0.0.1:${port}/demo/?debug=1\n`);
});
