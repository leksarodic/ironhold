/**
 * Static file server for the exported web bundle, used for local testing.
 *
 * Usage: node tools/serve.mjs [port]
 * Serves dist/ with SPA fallback to index.html.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = normalize(new URL('../dist/', import.meta.url).pathname);
const PORT = Number(process.argv[2] ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = decodeURIComponent(url.pathname);
    let file = normalize(join(ROOT, rel));

    // Refuse anything that escapes the bundle directory.
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let body;
    let type = MIME[extname(file)] ?? 'application/octet-stream';
    try {
      const info = await stat(file);
      if (info.isDirectory()) {
        file = join(file, 'index.html');
        type = MIME['.html'];
      }
      body = await readFile(file);
    } catch {
      // SPA fallback.
      body = await readFile(join(ROOT, 'index.html'));
      type = MIME['.html'];
    }

    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
      // Needed if the page is ever embedded or opened from a file:// origin.
      'access-control-allow-origin': '*',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Ironhold web preview → http://127.0.0.1:${PORT}/`);
});
