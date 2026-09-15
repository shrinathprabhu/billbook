import { readdir } from 'node:fs/promises';
import path from 'node:path';

// Build tools write these alongside client assets. They are inputs to deployment,
// never browser assets. Billbook owns its final headers and deployment config.
const buildFiles = new Set([
  '.assetsignore',
  '.dev.vars',
  '_headers',
  '_redirects',
  '_routes.json',
  'wrangler.json',
  'wrangler.jsonc',
  'wrangler.toml',
  'vinext-client-entry-manifest.json',
]);
const comparePaths = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function isBuildArtifact(relativePath) {
  const file = relativePath.split(path.sep).join('/');
  return (
    buildFiles.has(file) ||
    file === '.vite' ||
    file.startsWith('.vite/') ||
    file.endsWith('.map') ||
    path.posix.basename(file) === '.DS_Store'
  );
}

export async function collectPublicAssets(root) {
  const files = [],
    excluded = [],
    unexpected = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      const relative = path.relative(root, filename).split(path.sep).join('/');
      if (isBuildArtifact(relative)) excluded.push(relative);
      else if (entry.isSymbolicLink()) unexpected.push(`${relative} (symlink)`);
      else if (entry.isDirectory()) await walk(filename);
      else if (
        /(?:^|\/)(?:\.|_worker\.js$|_routes\.json$|functions\/|server\/|wrangler\.(?:jsonc?|toml)$)|\.(?:env|sql|bak|log|php|pem|key)$/.test(
          relative,
        )
      )
        unexpected.push(relative);
      else files.push(relative);
    }
  }
  await walk(root);
  if (unexpected.length)
    throw new Error(
      `Unexpected private or server files in static export:\n${unexpected
        .sort(comparePaths)
        .map((file) => `- ${file}`)
        .join('\n')}`,
    );
  return {
    files: files.sort(comparePaths),
    excluded: excluded.sort(comparePaths),
  };
}
