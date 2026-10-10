import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/model.mjs', ['model.mjs', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
]);
export function createWebServer() {
  return createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const asset = assets.get((req.url || '/').split('?')[0]);
    if (!asset) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const body = await readFile(new URL('../web/' + asset[0], import.meta.url));
      res.writeHead(200, {
        'Content-Type': asset[1] + '; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end('Unable to load app'); }
  });
}
if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) {
  const server = createWebServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('Desktop demo: http://127.0.0.1:4173'));
}
