import { writeFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import {
  BASE_PATH,
  SITE_URL,
  DESCRIPTION,
  publicMarkdown,
} from '../lib/site.mjs';

const write = (name, data) => writeFile(`public/${name}`, data);
await write(
  'robots.txt',
  `# This file is authoritative only when served at a host's /robots.txt.\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);
await write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}</loc></url></urlset>\n`,
);
await write('index.md', publicMarkdown());
await write('llms-full.txt', publicMarkdown());
await write(
  'llms.txt',
  `# Billbook\n\n> Free, frontend-only invoice and receipt generator by Lowkey Tools. No account required. Documents are stored locally in the user's browser.\n\nCanonical application: ${SITE_URL}\n\nMade by [Shrinath Prabhu](https://shrinath.me), creator of [Owleye Analytics](https://owleye.dev). [Back to Lowkey Tools](https://lowkey.tools).\n\nCreate invoices, shop and food receipts, rent receipts, society maintenance bills, cash vouchers and cash memos. Configure GST, VAT or custom tax manually, customize templates, import Excel/CSV/JSON, and export PDF, PNG or text. Offline use requires an initial online visit and completion of the service worker setup.\n\n## Product documentation\n\n- [Billbook application](${SITE_URL}): Public interface, feature descriptions, instructions and FAQs.\n- [Markdown guide](${SITE_URL}/index.md): The public feature guide and FAQ in plain Markdown, including import limits, tax configuration and local storage behavior.\n- [Full text guide](${SITE_URL}/llms-full.txt): Expanded public product reference.\n\n## Discovery\n\n- [Sitemap](${SITE_URL}/sitemap.xml): Canonical public page.\n\nPrivate bills, customer details, uploaded files and local workspaces are not public documentation and are not included in these files.\n`,
);
await write(
  'manifest.webmanifest',
  JSON.stringify(
    {
      id: BASE_PATH,
      name: 'Billbook — Offline invoice & receipt generator',
      short_name: 'Billbook',
      description: DESCRIPTION,
      lang: 'en',
      dir: 'ltr',
      start_url: BASE_PATH,
      scope: BASE_PATH,
      display: 'standalone',
      background_color: '#f8faf9',
      theme_color: '#227852',
      categories: ['business', 'productivity', 'utilities'],
      icons: [
        {
          src: `${BASE_PATH}/icon-192.png`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `${BASE_PATH}/icon-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `${BASE_PATH}/icon-maskable-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    null,
    2,
  ) + '\n',
);
const icon = await readFile('public/favicon.svg');
await Promise.all(
  [192, 512].map((size) =>
    sharp(icon).resize(size, size).png().toFile(`public/icon-${size}.png`),
  ),
);
await sharp(icon).resize(180, 180).png().toFile('public/apple-touch-icon.png');
// Inset the code-native receipt glyph so it survives circular and squircle masks.
const glyph = await sharp(icon).resize(320, 320).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#227852' },
})
  .composite([{ input: glyph, left: 96, top: 96 }])
  .png()
  .toFile('public/icon-maskable-512.png');
console.log('Generated public guide, crawler files, manifest and app icons.');
