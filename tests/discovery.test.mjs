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
} from '../scripts/security.mjs';
import {
  SITE_URL,
  REPOSITORY_URL,
  relatedTools,
  TITLE,
  DESCRIPTION,
  OG_IMAGE,
  faqs,
  steps,
  documentUseCases,
  structuredData,
  publicMarkdown,
} from '../lib/site.mjs';

const root = path.resolve('dist/workers');
const html = await readFile(`${root}/index.html`, 'utf8');
const nodes = elements(html);
const attr = (node, name) => node.attrs.find((a) => a.name === name)?.value;
const text = (node) =>
  (node.childNodes || [])
    .filter((n) => !['script', 'style'].includes(n.tagName))
    .map((n) => n.value || text(n))
    .join('');
const visible = text(nodes.find((n) => n.tagName === 'body'));
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
  assert.ok(
    nodes.some(
      (node) =>
        node.tagName === 'button' && attr(node, 'aria-label') === 'Install app',
    ),
  );
  for (const content of [
    ...faqs.flatMap((f) => [f.question, f.answer]),
    ...documentUseCases.flatMap((c) => [c.name, c.text]),
    ...steps.flatMap((s) => [s.name, s.text]),
  ])
    assert.ok(visible.includes(content), `Missing visible content: ${content}`);
  assert.ok(visible.includes('Shrinath Prabhu'));
  assert.ok(visible.includes('Owleye Analytics'));
  assert.ok(visible.includes('lowkey.tools'));
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
  assert.deepEqual(app.sameAs, [REPOSITORY_URL]);
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
    REPOSITORY_URL,
    'https://shrinath.me',
    'https://owleye.dev',
    'https://lowkey.tools',
  ])
    assert.ok(nodes.some((n) => n.tagName === 'a' && attr(n, 'href') === url));
});

await test('all HTML application assets resolve at the domain root', async () => {
  for (const node of nodes) {
    const value =
      attr(node, 'src') ||
      (node.tagName === 'link' ? attr(node, 'href') : undefined);
    if (!value?.startsWith('/') || value.startsWith('//')) continue;
    assert.ok(!value.startsWith('/billbook/'), `Old path prefix: ${value}`);
    assert.ok(
      (await stat(path.join(root, new URL(value, SITE_URL).pathname))).isFile(),
      value,
    );
  }
});

await test('crawler files, Markdown and sitemap agree on one canonical page', async () => {
  for (const base of ['']) {
    const robots = await readFile(`${root}${base}/robots.txt`, 'utf8');
    assert.match(robots, /User-agent: \*\nAllow: \//);
    assert.ok(robots.includes(`Sitemap: ${SITE_URL}sitemap.xml`));
    const sitemap = await readFile(`${root}${base}/sitemap.xml`, 'utf8');
    assert.deepEqual(
      [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
      [SITE_URL],
    );
    assert.doesNotMatch(sitemap, /lastmod|localhost|lowkey\.tools\/billbook/);
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
    assert.ok(llms.includes(`${SITE_URL}index.md`));
    assert.ok(
      llms.includes('https://shrinath.me') &&
        llms.includes('https://owleye.dev'),
    );
  }
});

await test('manifest and real raster icons use the canonical app scope', async () => {
  const manifest = JSON.parse(
    await readFile(`${root}/manifest.webmanifest`, 'utf8'),
  );
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.id, '/');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const info = await sharp(path.join(root, icon.src)).metadata();
    assert.equal(`${info.width}x${info.height}`, icon.sizes);
    assert.equal(info.format, 'png');
  }
  const og = await sharp(`${root}/og.png`).metadata();
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

await test('maker credits and related tools are crawlable links with useful context', () => {
  const footer = nodes.find(
    (n) => n.tagName === 'footer' && attr(n, 'class') === 'creator-footer',
  );
  assert.ok(footer);
  const content = text(footer);
  assert.equal(relatedTools.length, 1);
  const recommendations = nodes.find(
    (n) =>
      n.tagName === 'nav' &&
      attr(n, 'aria-label') === 'More tools from Lowkey Tools',
  );
  assert.equal(
    recommendations.childNodes.filter((n) => n.tagName === 'a').length,
    1,
  );
  assert.ok(content.includes('Paperwork’s done. What’s next?'));
  for (const url of [
    'https://shrinath.me',
    'https://owleye.dev',
    'https://lowkey.tools',
    'https://x.com/shrinath_prabhu',
    ...relatedTools.map((tool) => tool.url),
  ])
    assert.ok(
      elements(html).some((n) => n.tagName === 'a' && attr(n, 'href') === url),
      url,
    );
  for (const tool of relatedTools) {
    assert.ok(content.includes(tool.title));
    assert.ok(content.includes(tool.text));
    assert.ok(publicMarkdown().includes(tool.url));
  }
});

await test('discovery output contains the subdomain URL and no old Billbook mount', async () => {
  assert.equal(SITE_URL, 'https://billbook.lowkey.tools/');
  assert.equal(new URL(SITE_URL).href, SITE_URL);
  for (const file of [
    'index.html',
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
    'index.md',
    'manifest.webmanifest',
    'sw.js',
  ]) {
    const content = await readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(content, /https:\/\/billbook\.lowkey\.tools\/\//, file);
    assert.doesNotMatch(
      content,
      /https:\/\/lowkey\.tools\/billbook|(?:href|src)="\/billbook\//,
      file,
    );
  }
  assert.equal((await readdir(root)).includes('billbook'), false);
});

await test('root worker caches only public assets and upgrades the old standalone installation safely', async () => {
  const handlers = {},
    deleted = [],
    matches = [];
  let precached;
  const source = await readFile(`${root}/sw.js`, 'utf8');
  assert.equal(await readFile(`${root}/standalone-sw.js`, 'utf8'), source);
  const context = {
    URL,
    Set,
    self: {
      location: { origin: new URL(SITE_URL).origin },
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
        'billbook-root-v1-old',
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
  let promise = Promise.resolve();
  handlers.install({
    waitUntil: (p) => {
      promise = p;
    },
  });
  await promise;
  assert.ok(precached.length > 20);
  assert.ok(precached.includes('/'));
  for (const url of precached) {
    assert.ok(url.startsWith('/') && !url.startsWith('/billbook'));
    assert.ok(!url.includes('sw.js') && url !== '/404.html');
    assert.ok(
      (await stat(path.join(root, url === '/' ? 'index.html' : url))).isFile(),
      url,
    );
  }
  handlers.activate({
    waitUntil: (p) => {
      promise = p;
    },
  });
  await promise;
  assert.deepEqual(deleted, [
    'billbook-root-v1-old',
    'billbook-app-v1-old',
    'billbook-standalone-v1-old',
  ]);
  for (const url of [
    `${SITE_URL}unknown`,
    `${SITE_URL}billbook`,
    `${SITE_URL}billbook/old.js`,
    `${SITE_URL}404.html`,
    'https://lowkey.tools/',
    'https://example.com/',
  ])
    handlers.fetch({
      request: { url, method: 'GET' },
      respondWith: () => assert.fail(`Intercepted unrelated URL: ${url}`),
    });
  handlers.fetch({
    request: { url: SITE_URL, method: 'POST' },
    respondWith: () => assert.fail('Intercepted write'),
  });
  for (const pathname of ['/', '/index.html']) {
    handlers.fetch({
      request: {
        url: new URL(`${pathname}?ref=test`, SITE_URL).href,
        method: 'GET',
      },
      respondWith: (p) => {
        promise = p;
      },
    });
    assert.equal(await promise, 'cached-response');
    assert.equal(matches.at(-1), '/');
  }
});
