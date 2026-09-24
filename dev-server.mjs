// Optional dependency-free server for development and the browser test harness.
import http from 'node:http';
import {
  readFile,
  stat
} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(new URL('./', import.meta.url).pathname);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8'
};
let appOffline = false;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/offline-toggle') {
      appOffline = url.searchParams.get('state') === '1';
      res.writeHead(200, {
        'Content-Type': 'text/plain'
      });
      res.end(appOffline ? 'offline' : 'online');
      return;
    }
    if (appOffline && url.pathname !== '/offline-toggle') {
      res.writeHead(503);
      res.end('Network unavailable in controlled offline test');
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/repo/')) p = p.slice(5);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.resolve(root, '.' + p);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(Number(process.env.PORT) || 4173, '0.0.0.0', () => console.log(
  'ShadowArchive static preview on port ' + (process.env.PORT || 4173)));
