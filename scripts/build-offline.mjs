import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  cp,
  rm,
  rename,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { BASE_PATH, SITE_URL } from '../lib/site.mjs';
import { securityHeaders, vercelRoutes } from './security.mjs';

const root = path.resolve('dist/client');
const appRoot = path.join(root, BASE_PATH);
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
await mkdir(appRoot, { recursive: true });
// Vinext scopes generated HTML/JS/CSS via basePath. Public assets need the same prefix.
for (const name of await readdir('public')) {
  await cp(path.resolve('public', name), path.join(appRoot, name), {
    recursive: true,
  });
  if (
    [
      'robots.txt',
      'sitemap.xml',
      'llms.txt',
      'llms-full.txt',
      'index.md',
    ].includes(name)
  ) {
    await cp(path.resolve('public', name), path.join(root, name));
  } else {
    await rm(path.join(root, name), { recursive: true, force: true });
  }
}
const htmlPath = path.join(appRoot, 'index.html');
// Vinext writes slashless routes as a named HTML file.
await rename(path.join(root, `${BASE_PATH.slice(1)}.html`), htmlPath);
await rm(path.join(root, 'vinext-client-entry-manifest.json'), { force: true });
const html = await readFile(htmlPath, 'utf8');
if (!html.includes(`href="${SITE_URL}"`))
  throw new Error('Missing canonical URL in static export.');
// Actual errors stay errors, with no workspace, hydration code or indexing directives.
const notFound =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Billbook</title></head><body><main><h1>Page not found</h1><p>This address does not contain a Billbook page.</p><a href="/billbook">Open the invoice and receipt generator</a></main></body></html>';
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
const files = (await walk(appRoot)).filter((f) => !f.endsWith('sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) {
  hash.update(path.relative(root, file));
  hash.update(await readFile(file));
}
const version = hash.digest('hex').slice(0, 12);
const urls = [
  BASE_PATH,
  ...files
    .filter((f) => f !== htmlPath)
    .map((f) => '/' + path.relative(root, f).split(path.sep).join('/')),
];
const source = `const BASE=${JSON.stringify(BASE_PATH)};
const PREFIX='billbook-app-v1-';
const CACHE=PREFIX+${JSON.stringify(version)};
const ASSETS=${JSON.stringify(urls)};
const KNOWN=new Set(ASSETS);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Scope uses /billbook to include its slashless canonical URL. Enforce a path boundary here.
 if(request.method!=='GET'||url.origin!==self.location.origin||(url.pathname!==BASE&&!url.pathname.startsWith(BASE+'/')))return;
 const home=url.pathname===BASE||url.pathname===BASE+'/';
 if(!home&&!KNOWN.has(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const match=await cache.match(home?BASE:request,{ignoreSearch:true});
  if(match)return match;
  return fetch(request);
 }));
});\n`;
await writeFile(path.join(appRoot, 'sw.js'), source);
await writeFile(
  'dist/security-headers.json',
  JSON.stringify(headers, null, 2) + '\n',
);
const config = { version: 3, routes: vercelRoutes(headers) };
await writeFile('dist/routing.json', JSON.stringify(config, null, 2) + '\n');
// Build Output API preserves build-specific CSP hashes without a server or middleware.
await rm('.vercel/output', { recursive: true, force: true });
await mkdir('.vercel/output', { recursive: true });
await cp(root, '.vercel/output/static', { recursive: true });
await writeFile(
  '.vercel/output/config.json',
  JSON.stringify(config, null, 2) + '\n',
);
console.log(
  `Offline frontend: ${urls.length} scoped assets, version ${version}. Vercel static output and CSP generated.`,
);
