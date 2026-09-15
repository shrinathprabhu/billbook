import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { elements, inlineScripts } from '../scripts/security.mjs';
import { SITE_URL } from '../lib/site.mjs';

const root = 'dist/pages';
const html = await readFile(`${root}/index.html`, 'utf8');
const original = await readFile('dist/client/index.html', 'utf8');
const headerFile = await readFile(`${root}/_headers`, 'utf8');
const shared = JSON.parse(await readFile('dist/security-headers.json', 'utf8'));
const attr = (node, name) =>
  node.attrs.find((item) => item.name === name)?.value;
const blocks = headerFile.split(/\n\s*\n/).map((block) => {
  const lines = block
    .split('\n')
    .filter((line) => line && !line.startsWith('#'));
  return {
    path: lines[0],
    headers: Object.fromEntries(
      lines.slice(1).map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
      }),
    ),
  };
});
const headersAt = (path) =>
  blocks.find((block) => block.path === path)?.headers;

await test('Pages configuration publishes only the static package and respects header limits', async () => {
  const parsed = ts.parseConfigFileTextToJson(
    'deploy/cloudflare-pages/wrangler.jsonc',
    await readFile('deploy/cloudflare-pages/wrangler.jsonc', 'utf8'),
  );
  assert.equal(parsed.error, undefined);
  const config = parsed.config;
  assert.equal(config.pages_build_output_dir, '../../dist/pages');
  assert.equal(config.main, undefined);
  assert.ok(blocks.length <= 100);
  assert.ok(headerFile.split('\n').every((line) => line.length <= 2000));
  assert.equal(new Set(blocks.map((block) => block.path)).size, blocks.length);
  const files = await readdir(root, { recursive: true });
  assert.ok(files.includes('404.html'));
  assert.ok(
    !files.some((file) =>
      /(?:^|\/)(?:_worker\.js|_routes\.json|functions|server|\.git)(?:\/|$)|\.map$/.test(
        file,
      ),
    ),
  );
  assert.ok(!files.includes('_redirects'));
});

await test('Pages preserves the complete CSP using early HTML policy and HTTP frame protection', async () => {
  const expectedPolicy = shared['Content-Security-Policy']
    .split('; ')
    .filter((directive) => !directive.startsWith('frame-ancestors '))
    .join('; ');
  for (const file of ['index.html', '404.html']) {
    const markup = await readFile(`${root}/${file}`, 'utf8');
    const nodes = elements(markup);
    const head = nodes.find((node) => node.tagName === 'head');
    const children = head.childNodes.filter((node) => node.tagName);
    const policies = children.filter(
      (node) => attr(node, 'http-equiv') === 'Content-Security-Policy',
    );
    assert.equal(policies.length, 1);
    assert.equal(attr(policies[0], 'content'), expectedPolicy);
    assert.ok(
      children
        .slice(0, children.indexOf(policies[0]))
        .every((node) => node.tagName === 'meta' && attr(node, 'charset')),
    );
    for (const script of inlineScripts(markup)) {
      const digest = createHash('sha256').update(script).digest('base64');
      assert.ok(expectedPolicy.includes(`'sha256-${digest}'`));
    }
  }
  assert.deepEqual(inlineScripts(html), inlineScripts(original));
  const globalHeaders = headersAt('/*');
  assert.ok(
    globalHeaders['Content-Security-Policy'].includes("frame-ancestors 'none'"),
  );
  for (const [name, value] of Object.entries(shared)) {
    if (name !== 'Content-Security-Policy')
      assert.equal(globalHeaders[name], value);
  }
  assert.equal(globalHeaders['Cache-Control'], undefined);
});

await test('Pages retains canonicals, public metadata and distinct cache policies', async () => {
  assert.equal(
    attr(
      elements(html).find((node) => attr(node, 'rel') === 'canonical'),
      'href',
    ),
    SITE_URL,
  );
  assert.ok(headersAt('/').Link.startsWith(`<${SITE_URL}>; rel="canonical"`));
  assert.equal(headersAt('/sw.js')['Cache-Control'], 'no-store');
  assert.equal(headersAt('/sw.js')['Service-Worker-Allowed'], '/');
  assert.deepEqual(headersAt('/sw.js'), headersAt('/standalone-sw.js'));
  assert.equal(
    headersAt('/_next/static/*')['Cache-Control'],
    'public, max-age=31536000, immutable',
  );
  assert.equal(
    headersAt('/robots.txt')['Content-Type'],
    'text/plain; charset=utf-8',
  );
  assert.equal(
    headersAt('/manifest.webmanifest')['Content-Type'],
    'application/manifest+json; charset=utf-8',
  );
  assert.equal(headersAt('/404')['X-Robots-Tag'], 'noindex');
  for (const file of [
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
    'index.md',
    'manifest.webmanifest',
    'og.png',
  ]) {
    assert.deepEqual(
      await readFile(`${root}/${file}`),
      await readFile(`dist/client/${file}`),
    );
  }
});

await test('Pages worker versions its own document and never caches deployment control files', async () => {
  const worker = await readFile(`${root}/sw.js`, 'utf8');
  assert.equal(worker, await readFile(`${root}/standalone-sw.js`, 'utf8'));
  assert.notEqual(worker, await readFile('dist/client/sw.js', 'utf8'));
  let install, urls;
  let pending = Promise.resolve();
  vm.runInNewContext(worker, {
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
  assert.ok(urls.includes('/'));
  assert.ok(
    !urls.some((url) =>
      /_headers|_redirects|_worker|sw\.js|404\.html/.test(url),
    ),
  );
  for (const url of urls)
    assert.ok(
      (await stat(`${root}${url === '/' ? '/index.html' : url}`)).isFile(),
      url,
    );
});
