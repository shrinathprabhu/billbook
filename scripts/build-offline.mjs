import { readdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { SITE_URL } from '../lib/site.mjs';
import { serviceWorkerSource } from './service-worker.mjs';
import { securityHeaders } from './security.mjs';

const root = path.resolve('dist/client');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
// The app, public files and hashed assets all live at the domain root.
await cp(path.resolve('public'), root, { recursive: true });
const htmlPath = path.join(root, 'index.html');
await rm(path.join(root, 'vinext-client-entry-manifest.json'), { force: true });
const html = await readFile(htmlPath, 'utf8');
if (!html.includes(`href="${SITE_URL}"`))
  throw new Error('Missing canonical URL in static export.');
// Actual errors stay errors, with no workspace, hydration code or indexing directives.
const notFound =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Billbook</title></head><body><main><h1>Page not found</h1><p>This address does not contain a Billbook page.</p><a href="/">Open the invoice and receipt generator</a></main></body></html>';
await writeFile(path.join(root, '404.html'), notFound);
for (const file of await walk(root)) {
  if (
    file.endsWith('.map') ||
    file.includes('/.vite/') ||
    (file.endsWith('.html') &&
      file !== htmlPath &&
      file !== path.join(root, '404.html'))
  )
    await rm(file, { force: true });
}
const headers = securityHeaders([html, notFound]);
const files = (await walk(root))
  .filter((f) => !f.endsWith('sw.js') && f !== path.join(root, '404.html'))
  .sort();
const hash = createHash('sha256');
for (const file of files) {
  hash.update(path.relative(root, file));
  hash.update(await readFile(file));
}
const version = hash.digest('hex').slice(0, 12);
const urls = [
  '/',
  ...files
    .filter((f) => f !== htmlPath)
    .map((f) => '/' + path.relative(root, f).split(path.sep).join('/')),
];
const source = serviceWorkerSource(urls, version);
await writeFile(path.join(root, 'sw.js'), source);
// Existing standalone installations can update to the root-only app without
// losing their offline shell. New visits register /sw.js; IndexedDB is untouched.
await writeFile(path.join(root, 'standalone-sw.js'), source);
await writeFile(
  'dist/security-headers.json',
  JSON.stringify(headers, null, 2) + '\n',
);
console.log(
  `Offline frontend: ${urls.length} root assets, version ${version}. Static app and CSP prepared.`,
);
