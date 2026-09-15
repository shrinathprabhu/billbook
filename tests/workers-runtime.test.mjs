import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { SITE_URL } from '../lib/site.mjs';

// Run against `npm run preview:workers`, using the real Workers asset runtime.
const origin = 'http://127.0.0.1:8788';
const root = 'dist/workers';
const request = (pathname, options = {}) =>
  fetch(`${origin}${pathname}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    ...options,
  });

await test('Workers serves the current homepage with canonical and security headers', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  // Wrangler's local proxy rewrites response-header URLs for the configured
  // custom domain to localhost. The packaged production Link is tested separately.
  assert.ok(
    response.headers.get('link').includes(`<${origin}/>; rel="canonical"`),
  );
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=0, must-revalidate',
  );
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(
    response.headers
      .get('content-security-policy')
      .includes("frame-ancestors 'none'"),
  );
  const html = await response.text();
  assert.equal(html, await readFile(`${root}/index.html`, 'utf8'));
  assert.ok(html.includes(`href="${SITE_URL}"`));
});

await test('Workers serves every offline asset from the current build', async () => {
  let install, urls;
  let pending = Promise.resolve();
  vm.runInNewContext(await readFile(`${root}/sw.js`, 'utf8'), {
    Set,
    self: {
      addEventListener: (name, handler) => {
        if (name === 'install') install = handler;
      },
    },
    caches: {
      open: async () => ({
        addAll: async (paths) => {
          urls = paths;
        },
      }),
    },
  });
  install({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.ok(urls.length > 20);
  for (const pathname of urls) {
    const response = await request(pathname);
    assert.equal(response.status, 200, pathname);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      await readFile(`${root}${pathname === '/' ? '/index.html' : pathname}`),
      pathname,
    );
    if (pathname.startsWith('/_next/static/'))
      assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=31536000, immutable',
      );
  }
});

await test('Workers preserves manifest, discovery and browser service-worker policies', async () => {
  for (const pathname of ['/sw.js', '/standalone-sw.js']) {
    const response = await request(pathname);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('service-worker-allowed'), '/');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.equal(
      await response.text(),
      await readFile(`${root}${pathname}`, 'utf8'),
    );
  }
  for (const [pathname, type] of [
    ['/manifest.webmanifest', 'application/manifest+json'],
    ['/robots.txt', 'text/plain'],
    ['/llms.txt', 'text/plain'],
    ['/llms-full.txt', 'text/plain'],
    ['/sitemap.xml', 'application/xml'],
    ['/index.md', 'text/markdown'],
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('content-type'),
      `${type}; charset=utf-8`,
    );
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
    await response.arrayBuffer();
  }
});

await test('Workers normalizes the HTML alias and returns actual errors for unknown URLs', async () => {
  const alias = await request('/index.html');
  assert.equal(alias.status, 307);
  assert.equal(new URL(alias.headers.get('location'), origin).pathname, '/');
  await alias.arrayBuffer();
  for (const pathname of [
    '/not-a-page',
    '/billbook',
    '/.env',
    '/.git/config',
    '/source.map',
    '/_headers',
    '/_redirects',
    '/deploy/cloudflare-workers/wrangler.jsonc',
  ]) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
    assert.match(
      await response.text(),
      /name="robots" content="noindex"/,
      pathname,
    );
  }
  const post = await request('/', { method: 'POST' });
  assert.equal(post.status, 405);
  await post.arrayBuffer();
});
