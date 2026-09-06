import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import sharp from 'sharp';
import {
  elements,
  inlineScripts,
  securityHeaders,
  vercelRoutes,
} from '../scripts/security.mjs';
import {
  SITE_URL,
  BASE_PATH,
  TITLE,
  DESCRIPTION,
  OG_IMAGE,
  faqs,
  steps,
  documentUseCases,
  structuredData,
  publicMarkdown,
} from '../lib/site.mjs';

const root = path.resolve('dist/client');
const html = await readFile(`${root}/billbook/index.html`, 'utf8');
const nodes = elements(html);
const attr = (node, name) => node.attrs.find((a) => a.name === name)?.value;
const text = (node) =>
  (node.childNodes || [])
    .filter((n) => !['script', 'style'].includes(n.tagName))
    .map((n) => n.value || text(n))
    .join('');
const visible = text(nodes.find((n) => n.tagName === 'body'));
const config = JSON.parse(await readFile('.vercel/output/config.json', 'utf8'));
const headers = JSON.parse(
  await readFile('dist/security-headers.json', 'utf8'),
);

await test('HTML contains canonical metadata and the complete public guide without executing JavaScript', () => {
  assert.equal(text(nodes.find((n) => n.tagName === 'title')), TITLE);
  assert.equal(
    nodes.filter((n) => n.tagName === 'link' && attr(n, 'rel') === 'canonical')
      .length,
    1,
  );
  assert.equal(
    attr(
      nodes.find((n) => attr(n, 'rel') === 'canonical'),
      'href',
    ),
    SITE_URL,
  );
  const meta = (name) =>
    attr(
      nodes.find(
        (n) => attr(n, 'name') === name || attr(n, 'property') === name,
      ),
      'content',
    );
  assert.equal(meta('description'), DESCRIPTION);
  assert.equal(meta('og:url'), SITE_URL);
  assert.equal(meta('og:image'), OG_IMAGE.url);
  assert.equal(meta('og:image:width'), String(OG_IMAGE.width));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.match(meta('robots'), /index/);
  assert.doesNotMatch(meta('robots'), /noindex|nofollow/);
  assert.equal(nodes.filter((n) => n.tagName === 'h1').length, 1);
  for (const content of [
    ...faqs.flatMap((f) => [f.question, f.answer]),
    ...documentUseCases.flatMap((c) => [c.name, c.text]),
    ...steps.flatMap((s) => [s.name, s.text]),
  ])
    assert.ok(visible.includes(content), `Missing visible content: ${content}`);
  assert.ok(visible.includes('Shrinath Prabhu'));
  assert.ok(visible.includes('Owleye Analytics'));
  assert.ok(visible.includes('Back to Lowkey Tools'));
});

await test('structured data matches visible facts and contains only public product information', () => {
  const scripts = nodes.filter(
    (n) => n.tagName === 'script' && attr(n, 'type') === 'application/ld+json',
  );
  assert.equal(scripts.length, 1);
  const data = JSON.parse(text(scripts[0]));
  assert.deepEqual(data, structuredData());
  const app = data['@graph'].find((n) => n['@type'] === 'WebApplication');
  assert.equal(app.url, SITE_URL);
  assert.equal(app.offers.price, '0');
  assert.equal(app.creator['@id'], 'https://shrinath.me/#person');
  assert.equal(app.aggregateRating, undefined);
  assert.equal(app.review, undefined);
  const faqPage = data['@graph'].find(
    (n) => Array.isArray(n['@type']) && n['@type'].includes('FAQPage'),
  );
  assert.equal(faqPage.mainEntity.length, faqs.length);
  for (const faq of faqPage.mainEntity)
    assert.ok(
      visible.includes(faq.name) && visible.includes(faq.acceptedAnswer.text),
    );
});

await test('skip link, guide anchors and creator links are meaningful HTML links', () => {
  const ids = nodes.map((n) => attr(n, 'id')).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
  assert.ok(
    nodes.some((n) => n.tagName === 'main' && attr(n, 'id') === 'main-content'),
  );
  for (const link of nodes.filter((n) => n.tagName === 'a')) {
    const href = attr(link, 'href');
    if (href?.startsWith('#'))
      assert.ok(ids.includes(href.slice(1)), `Missing anchor: ${href}`);
  }
  for (const url of [
    'https://shrinath.me',
    'https://owleye.dev',
    'https://lowkey.tools',
  ])
    assert.ok(nodes.some((n) => n.tagName === 'a' && attr(n, 'href') === url));
});

await test('all HTML application assets resolve under the proxy prefix', async () => {
  for (const node of nodes) {
    const value =
      attr(node, 'src') ||
      (node.tagName === 'link' ? attr(node, 'href') : undefined);
    if (!value?.startsWith('/') || value.startsWith('//')) continue;
    assert.ok(value.startsWith(`${BASE_PATH}/`), `Unscoped asset: ${value}`);
    assert.ok(
      (await stat(path.join(root, new URL(value, SITE_URL).pathname))).isFile(),
      value,
    );
  }
});

await test('crawler files, Markdown and sitemap agree on one canonical page', async () => {
  for (const base of ['', '/billbook']) {
    const robots = await readFile(`${root}${base}/robots.txt`, 'utf8');
    assert.match(robots, /User-agent: \*\nAllow: \//);
    assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
    const sitemap = await readFile(`${root}${base}/sitemap.xml`, 'utf8');
    assert.deepEqual(
      [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
      [SITE_URL],
    );
    assert.doesNotMatch(sitemap, /lastmod|localhost|billbook\.lowkey/);
    assert.equal(
      await readFile(`${root}${base}/index.md`, 'utf8'),
      publicMarkdown(),
    );
    assert.equal(
      await readFile(`${root}${base}/llms-full.txt`, 'utf8'),
      publicMarkdown(),
    );
    const llms = await readFile(`${root}${base}/llms.txt`, 'utf8');
    assert.ok(llms.startsWith('# Billbook\n\n>'));
    assert.ok(llms.includes(`${SITE_URL}/index.md`));
    assert.ok(
      llms.includes('https://shrinath.me') &&
        llms.includes('https://owleye.dev'),
    );
  }
});

await test('manifest and real raster icons use the canonical app scope', async () => {
  const manifest = JSON.parse(
    await readFile(`${root}/billbook/manifest.webmanifest`, 'utf8'),
  );
  assert.equal(manifest.start_url, BASE_PATH);
  assert.equal(manifest.scope, BASE_PATH);
  assert.equal(manifest.id, BASE_PATH);
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const info = await sharp(path.join(root, icon.src)).metadata();
    assert.equal(`${info.width}x${info.height}`, icon.sizes);
    assert.equal(info.format, 'png');
  }
  const og = await sharp(`${root}/billbook/og.png`).metadata();
  assert.equal(og.width, OG_IMAGE.width);
  assert.equal(og.height, OG_IMAGE.height);
});

await test('strict CSP hashes every actual inline script and allows local export resources', () => {
  const csp = headers['Content-Security-Policy'];
  const scriptRule = csp.split('; ').find((d) => d.startsWith('script-src '));
  assert.doesNotMatch(scriptRule, /unsafe-inline|unsafe-eval|\*/);
  for (const script of inlineScripts(html))
    assert.ok(
      scriptRule.includes(
        `'sha256-${createHash('sha256').update(script).digest('base64')}'`,
      ),
    );
  assert.ok(inlineScripts(html).length > 1);
  for (const directive of [
    "script-src-attr 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data: blob:",
    "connect-src 'self' data: blob:",
  ])
    assert.ok(csp.includes(directive));
  assert.ok(headers['Permissions-Policy'].includes('web-share=(self)'));
  assert.ok(headers['Permissions-Policy'].includes('clipboard-write=(self)'));
  assert.deepEqual(headers, securityHeaders([html, '']));
});

async function route(pathname, method = 'GET') {
  const response = { status: 200, headers: {}, file: null };
  const exists = async (file) => {
    try {
      return (await stat(path.join(root, file))).isFile();
    } catch {
      return false;
    }
  };
  for (const rule of config.routes) {
    if (rule.handle === 'filesystem') {
      if (await exists(pathname)) {
        response.file = pathname;
        return response;
      }
      continue;
    }
    assert.ok(rule.src.startsWith('^') && rule.src.endsWith('$'));
    if (rule.methods && !rule.methods.includes(method)) continue;
    const pattern = new RegExp(rule.src);
    if (!pattern.test(pathname)) continue;
    Object.assign(response.headers, rule.headers);
    if (rule.continue) continue;
    const destination = rule.dest ? pathname.replace(pattern, rule.dest) : null;
    if (rule.check && !(await exists(destination))) continue;
    response.status = rule.status || 200;
    response.file = destination;
    return response;
  }
  throw new Error('No route');
}

await test('Vercel serves both entry paths in place, preserves canonical metadata, and returns real errors', async () => {
  assert.equal(config.version, 3);
  assert.deepEqual(config.routes, vercelRoutes(headers));
  for (const path of [
    '/billbook',
    '/billbook/robots.txt',
    '/robots.txt',
    '/billbook/sitemap.xml',
    '/billbook/llms.txt',
    '/billbook/sw.js',
    '/billbook/og.png',
  ])
    assert.equal((await route(path)).status, 200, path);
  assert.equal((await route('/billbook')).file, '/billbook/index.html');
  assert.ok(
    (await route('/billbook')).headers.Link.startsWith(
      `<${SITE_URL}>; rel="canonical"`,
    ),
  );
  for (const path of [
    '/',
    '/index.html',
    '/billbook',
    '/billbook/',
    '/billbook/index.html',
  ]) {
    const result = await route(path);
    assert.equal(result.status, 200, path);
    assert.equal(result.file, '/billbook/index.html');
    assert.equal(result.headers.Location, undefined, path);
    assert.ok(result.headers.Link.includes(`<${SITE_URL}>; rel="canonical"`));
  }
  for (const path of [
    '/billbook/missing',
    '/missing',
    '/billbook-old',
    '/.env',
    '/.git/config',
    '/billbook/.env',
    '/billbook/source.map',
    '/billbook.html',
    '/404.html',
  ]) {
    const result = await route(path);
    assert.equal(result.status, 404, path);
    assert.equal(result.headers['X-Robots-Tag'], 'noindex');
  }
  assert.equal((await route('/billbook', 'POST')).status, 405);
  assert.equal((await route('/', 'POST')).status, 405);
  assert.equal((await route('/', 'HEAD')).status, 200);
  assert.equal((await route('/billbook', 'HEAD')).status, 200);
  assert.equal(
    (await route('/billbook/sw.js')).headers['Cache-Control'],
    'no-store',
  );
  assert.equal(
    (await route('/billbook/sw.js')).headers['Service-Worker-Allowed'],
    BASE_PATH,
  );
  assert.equal(
    (await route('/billbook/index.txt')).headers['X-Robots-Tag'],
    'noindex',
  );
  const chunks = await readdir(`${root}/billbook/_next/static/chunks`);
  const chunkPath = `/billbook/_next/static/chunks/${chunks[0]}`;
  assert.equal((await route(chunkPath)).file, chunkPath);
  assert.equal(
    (await route(chunkPath)).headers['Cache-Control'],
    'public, max-age=31536000, immutable',
  );
});

await test('standalone and prefix-stripped assets resolve with the same content and security headers', async () => {
  const chunks = await readdir(`${root}/billbook/_next/static/chunks`);
  for (const suffix of [
    'sw.js',
    'manifest.webmanifest',
    'og.png',
    'favicon.svg',
    'icon-192.png',
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
    'index.md',
    'index.txt',
    `_next/static/chunks/${chunks[0]}`,
  ]) {
    const scoped = await route(`${BASE_PATH}/${suffix}`);
    const stripped = await route(`/${suffix}`);
    assert.equal(stripped.status, 200, suffix);
    assert.equal(stripped.headers.Location, undefined, suffix);
    assert.deepEqual(stripped.headers, scoped.headers, suffix);
    assert.deepEqual(
      await readFile(path.join(root, stripped.file)),
      await readFile(path.join(root, scoped.file)),
      suffix,
    );
  }
  for (const url of [
    '/_next/static/missing.js',
    '/billbook/_next/static/missing.js',
    '/billbook/billbook',
    '/missing.png',
  ])
    assert.equal((await route(url)).status, 404, url);
  assert.equal(
    (await route('/standalone-sw.js')).headers['Service-Worker-Allowed'],
    '/',
  );
  assert.equal(
    (await route('/sw.js')).headers['Service-Worker-Allowed'],
    BASE_PATH,
  );
});

await test('parent-domain rewrites work with preserved or stripped prefixes without redirect loops', async () => {
  const parent = JSON.parse(
    await readFile('deploy/lowkey.vercel.example.json', 'utf8'),
  );
  assert.equal(parent.rewrites[0].source, BASE_PATH);
  assert.equal(
    parent.rewrites[0].destination,
    'https://billbook.lowkey.tools/billbook',
  );
  assert.equal(
    parent.rewrites[1].destination,
    'https://billbook.lowkey.tools/billbook/:path*',
  );
  assert.equal(
    (await route(new URL(parent.rewrites[0].destination).pathname)).status,
    200,
  );
  assert.equal((await route('/billbook/sw.js')).status, 200);
  const stripping = JSON.parse(
    await readFile('deploy/lowkey.stripping.vercel.example.json', 'utf8'),
  );
  assert.equal(
    stripping.rewrites[0].destination,
    'https://billbook.lowkey.tools/',
  );
  assert.equal(
    stripping.rewrites[1].destination,
    'https://billbook.lowkey.tools/:path*',
  );
  for (const upstream of ['/', '/billbook', '/sw.js', '/billbook/sw.js']) {
    const result = await route(upstream);
    assert.equal(result.status, 200, upstream);
    assert.equal(result.headers.Location, undefined, upstream);
  }
  assert.ok(
    !config.routes.some((r) => r.has?.some((h) => h.type === 'host')),
    'Host redirects can leak through the proxy',
  );
});

for (const standalone of [false, true]) {
  await test(`${standalone ? 'Standalone' : 'Proxy'} service worker caches its entry page and leaves unrelated URLs alone`, async () => {
    const handlers = {},
      deleted = [],
      matches = [];
    let precached;
    const source = await readFile(
      `${root}${standalone ? '/standalone-sw.js' : '/billbook/sw.js'}`,
      'utf8',
    );
    const context = {
      URL,
      Set,
      self: {
        location: { origin: 'https://lowkey.tools' },
        clients: { claim: async () => {} },
        addEventListener: (type, fn) => {
          handlers[type] = fn;
        },
      },
      caches: {
        open: async () => ({
          addAll: async (urls) => {
            precached = urls;
          },
          match: async (request) => {
            matches.push(request);
            return 'cached-response';
          },
        }),
        keys: async () => [
          'other-app-v1',
          'billbook-local-old',
          'billbook-app-v1-old',
          'billbook-standalone-v1-old',
        ],
        delete: async (key) => {
          deleted.push(key);
        },
      },
      fetch: async () => 'network-response',
    };
    vm.runInNewContext(source, context);
    /** @type {Promise<unknown>} */
    let promise = Promise.resolve();
    handlers.install({
      waitUntil: (p) => {
        promise = p;
      },
    });
    await promise;
    assert.ok(precached.length > 20);
    for (const url of precached) {
      assert.ok(
        (standalone && url === '/') ||
          url === BASE_PATH ||
          url.startsWith(`${BASE_PATH}/`),
        url,
      );
      assert.ok(!url.includes('sw.js'));
      assert.equal((await route(url)).status, 200, url);
    }
    handlers.activate({
      waitUntil: (p) => {
        promise = p;
      },
    });
    await promise;
    assert.deepEqual(deleted, [
      standalone ? 'billbook-standalone-v1-old' : 'billbook-app-v1-old',
    ]);
    for (const url of [
      ...(!standalone
        ? ['https://lowkey.tools/', 'https://lowkey.tools/index.html']
        : []),
      'https://lowkey.tools/superbrain',
      'https://lowkey.tools/billbook-other',
      'https://lowkey.tools/billbook/unknown',
      'https://example.com/billbook',
    ])
      handlers.fetch({
        request: { url, method: 'GET' },
        respondWith: () => assert.fail(`Intercepted unrelated URL: ${url}`),
      });
    handlers.fetch({
      request: { url: 'https://lowkey.tools/billbook', method: 'POST' },
      respondWith: () => assert.fail('Intercepted write'),
    });
    handlers.fetch({
      request: { url: 'https://lowkey.tools/billbook?ref=test', method: 'GET' },
      respondWith: (p) => {
        promise = p;
      },
    });
    assert.equal(await promise, 'cached-response');
    assert.equal(matches.at(-1), BASE_PATH);
    if (standalone) {
      assert.ok(precached.includes('/'));
      for (const pathname of ['/', '/index.html']) {
        handlers.fetch({
          request: {
            url: `https://lowkey.tools${pathname}?ref=test`,
            method: 'GET',
          },
          respondWith: (p) => {
            promise = p;
          },
        });
        assert.equal(await promise, 'cached-response');
        assert.equal(matches.at(-1), '/');
      }
    }
  });
}
