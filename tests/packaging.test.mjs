import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { SITE_URL } from '../lib/site.mjs';

const run = promisify(execFile);
const script = (name) =>
  fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));

async function fixture(t) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'billbook-packaging-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, 'public'));
  await mkdir(path.join(cwd, 'dist/client/_next/static/chunks'), {
    recursive: true,
  });
  await mkdir(path.join(cwd, 'deploy/cloudflare-workers'), { recursive: true });
  await writeFile(
    path.join(cwd, 'deploy/cloudflare-workers/wrangler.jsonc'),
    '{"name":"billbook","assets":{"directory":"../../dist/workers"}}',
  );
  await writeFile(
    path.join(cwd, 'dist/client/index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><link rel="canonical" href="${SITE_URL}"></head><body>Billbook<script>window.ready = true;</script></body></html>`,
  );
  await writeFile(
    path.join(cwd, 'dist/client/_next/static/chunks/app.js'),
    'export const ready = true;',
  );
  return cwd;
}

const offline = (cwd) =>
  run(process.execPath, [script('build-offline.mjs')], { cwd });
const workers = (cwd) =>
  run(process.execPath, [script('build-workers.mjs')], { cwd });

async function precache(filename) {
  let install, urls;
  let pending = Promise.resolve();
  vm.runInNewContext(await readFile(filename, 'utf8'), {
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
  return Array.from(urls);
}

await test('Cloudflare-generated metadata never enters the offline cache or final assets', async (t) => {
  const cwd = await fixture(t);
  await mkdir(path.join(cwd, '.wrangler/deploy'), { recursive: true });
  await writeFile(
    path.join(cwd, '.wrangler/deploy/config.json'),
    JSON.stringify({ configPath: '../../dist/client/wrangler.json' }),
  );
  // The Cloudflare Vite plugin emits .assetsignore and wrangler.json; Vinext
  // adds _headers. These three extra files caused the reported CI failure.
  for (const [name, content] of Object.entries({
    '.assetsignore': 'wrangler.json\n.dev.vars\n.vite\n',
    'wrangler.json': '{"assets":{"directory":"."}}',
    _headers: '/*\n  X-Generated: stale-policy\n',
    _redirects: '/* https://example.invalid 301\n',
    '.dev.vars': 'LOCAL_ONLY=do-not-publish',
  }))
    await writeFile(path.join(cwd, 'dist/client', name), content);
  await offline(cwd);
  await workers(cwd);
  const output = path.join(cwd, 'dist/workers');
  const files = await readdir(output, { recursive: true });
  for (const name of [
    '.assetsignore',
    'wrangler.json',
    '_redirects',
    '.dev.vars',
  ])
    assert.ok(!files.includes(name), name);
  const headers = await readFile(path.join(output, '_headers'), 'utf8');
  assert.match(headers, /Content-Security-Policy:/);
  assert.doesNotMatch(headers, /stale-policy/);
  for (const directory of ['dist/client', 'dist/workers'])
    assert.deepEqual(await precache(path.join(cwd, directory, 'sw.js')), [
      '/',
      '/_next/static/chunks/app.js',
    ]);
  const pointer = JSON.parse(
    await readFile(path.join(cwd, '.wrangler/deploy/config.json'), 'utf8'),
  );
  assert.equal(
    path.resolve(cwd, '.wrangler/deploy', pointer.configPath),
    path.join(cwd, 'deploy/cloudflare-workers/wrangler.jsonc'),
  );
  // Repackaging must not accumulate controls or duplicate the HTML CSP.
  const first = await readFile(path.join(output, 'sw.js'), 'utf8');
  await workers(cwd);
  assert.equal(await readFile(path.join(output, 'sw.js'), 'utf8'), first);
});

await test('unexpected private files fail with their paths, without disclosing contents', async (t) => {
  const cwd = await fixture(t);
  await writeFile(
    path.join(cwd, 'dist/client/.env'),
    'SECRET=never-log-this-value',
  );
  await assert.rejects(offline(cwd), (error) => {
    assert.match(error.stderr, /\.env/);
    assert.doesNotMatch(error.stderr, /never-log-this-value/);
    return true;
  });
});

await test('the final packager independently rejects server files before publishing a partial directory', async (t) => {
  const cwd = await fixture(t);
  await offline(cwd);
  await workers(cwd);
  const original = await readFile(
    path.join(cwd, 'dist/workers/index.html'),
    'utf8',
  );
  await mkdir(path.join(cwd, 'dist/client/functions'));
  await writeFile(
    path.join(cwd, 'dist/client/functions/api.js'),
    'export default {};',
  );
  await assert.rejects(workers(cwd), (error) => {
    assert.match(error.stderr, /functions\/api\.js/);
    return true;
  });
  assert.equal(
    await readFile(path.join(cwd, 'dist/workers/index.html'), 'utf8'),
    original,
  );
});
