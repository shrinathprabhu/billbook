import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/postcss';

await test('global CSS compiles with default SSR dependency externalization', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'billbook-css-build-'));
  try {
    const entry = path.join(fixture, 'entry.js');
    await writeFile(
      entry,
      `import ${JSON.stringify(path.resolve('app/globals.css'))};\nexport const ok = true;`,
    );
    // Vinext normally disables externalization, which masks Vite's bare CSS
    // package import failure. Exercise that failing resolver path explicitly.
    const result = await build({
      configFile: false,
      root: process.cwd(),
      logLevel: 'silent',
      css: { postcss: { plugins: [tailwindcss()] } },
      build: { ssr: entry, write: false, ssrEmitAssets: true },
    });
    const css = [result]
      .flat()
      .flatMap((bundle) => bundle.output)
      .filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
      .map((file) => String(file.source))
      .join('\n');
    assert.ok(css.length > 0, 'SSR build must emit the compiled stylesheet');
    assert.match(css, /background-color:var\(--background\)/);
    assert.match(css, /border-color:var\(--border\)/);
    assert.doesNotMatch(css, /@(?:import|apply|theme|custom-variant)\b/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
