import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { BASE_PATH } from '../lib/site.mjs';

const root = path.resolve('dist/client');
const { routes } = JSON.parse(await readFile('dist/routing.json', 'utf8'));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
async function fileAt(urlPath) {
  const file = path.resolve(root, '.' + urlPath);
  if (!file.startsWith(root + path.sep)) return null;
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}
// Execute the generated static routing rules locally, including CSP, redirects and real 404s.
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    );
    const headers = {};
    let file,
      status = 200;
    for (const route of routes) {
      if (route.handle === 'filesystem') {
        file = await fileAt(pathname);
        if (file) break;
        continue;
      }
      if (route.methods && !route.methods.includes(req.method)) continue;
      const pattern = new RegExp(route.src);
      if (!pattern.test(pathname)) continue;
      Object.assign(headers, route.headers);
      if (route.continue) continue;
      if (route.dest)
        file = await fileAt(pathname.replace(pattern, route.dest));
      if (route.check && !file) continue;
      status = route.status || 200;
      break;
    }
    const data = file ? await readFile(file) : '';
    if (file && !headers['Content-Type'])
      headers['Content-Type'] =
        types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(400, {
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    });
    res.end('Invalid request');
  }
});
const port = Number(process.env.PORT) || 4173;
server.listen(port, '127.0.0.1', () =>
  console.log(
    `Billbook static frontend: http://localhost:${port}/ and http://localhost:${port}${BASE_PATH}`,
  ),
);
