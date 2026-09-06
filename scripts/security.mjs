import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { BASE_PATH, SITE_URL } from '../lib/site.mjs';

export function elements(html) {
  const nodes = [];
  const visit = (node) => {
    if (node.tagName) nodes.push(node);
    for (const child of node.childNodes || []) visit(child);
  };
  visit(parse(html));
  return nodes;
}
export function inlineScripts(html) {
  return elements(html)
    .filter(
      (node) =>
        node.tagName === 'script' &&
        !node.attrs.some((attr) => attr.name === 'src'),
    )
    .map((node) => node.childNodes.map((child) => child.value || '').join(''));
}
export function securityHeaders(htmlPages) {
  const hashes = [
    ...new Set(
      htmlPages
        .flatMap(inlineScripts)
        .map(
          (script) =>
            `'sha256-${createHash('sha256').update(script).digest('base64')}'`,
        ),
    ),
  ];
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src 'self' ${hashes.join(' ')}`,
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data: blob:",
      "connect-src 'self' data: blob:",
      "worker-src 'self'",
      "manifest-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=(), clipboard-write=(self), web-share=(self)',
  };
}
export const canonicalHeaders = {
  Link: `<${SITE_URL}>; rel="canonical", <${SITE_URL}/index.md>; rel="alternate"; type="text/markdown", <${SITE_URL}/llms.txt>; rel="describedby"; type="text/plain"`,
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'X-Robots-Tag':
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
};
export const notFoundHeaders = {
  'X-Robots-Tag': 'noindex',
  'Cache-Control': 'no-store',
};
export const denyPattern =
  '/(?:.*/)?(?:\\.[^/]+|[^/]+\\.(?:map|env|sql|bak|log|php|pem|key))(?:/.*)?';

export function vercelRoutes(headers) {
  return [
    { src: '/.*', headers, continue: true },
    {
      src: '/.*',
      methods: [
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
        'TRACE',
        'CONNECT',
      ],
      status: 405,
      headers: { Allow: 'GET, HEAD', ...notFoundHeaders },
    },
    {
      src: denyPattern,
      status: 404,
      dest: '/404.html',
      headers: notFoundHeaders,
    },
    {
      src: '/404\\.html',
      status: 404,
      dest: '/404.html',
      headers: notFoundHeaders,
    },
    {
      src: '/',
      status: 308,
      headers: { Location: SITE_URL, 'Cache-Control': 'public, max-age=3600' },
    },
    {
      src: `${BASE_PATH}/(?:index\\.html)?`,
      status: 308,
      headers: { Location: SITE_URL, 'Cache-Control': 'public, max-age=3600' },
    },
    {
      src: BASE_PATH,
      dest: `${BASE_PATH}/index.html`,
      headers: canonicalHeaders,
    },
    {
      src: `${BASE_PATH}/sw\\.js`,
      headers: {
        'Service-Worker-Allowed': BASE_PATH,
        'Cache-Control': 'no-store',
        'Content-Type': 'text/javascript; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      },
      continue: true,
    },
    {
      src: `${BASE_PATH}/_next/static/.*`,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      continue: true,
    },
    {
      src: '/(?:billbook/)?(?:robots\\.txt|llms(?:-full)?\\.txt)',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
      continue: true,
    },
    {
      src: '/(?:billbook/)?index\\.md',
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
      continue: true,
    },
    {
      src: '/(?:billbook/)?sitemap\\.xml',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
      continue: true,
    },
    {
      src: `${BASE_PATH}/manifest\\.webmanifest`,
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
      continue: true,
    },
    {
      src: `${BASE_PATH}/index\\.txt`,
      headers: {
        'Content-Type': 'text/x-component; charset=utf-8',
        'X-Robots-Tag': 'noindex',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
      continue: true,
    },
    {
      src: `${BASE_PATH}/[^/]+\\.(?:png|svg)`,
      headers: { 'Cache-Control': 'public, max-age=86400' },
      continue: true,
    },
    {
      src: '/.*\\.(?:rsc|html)',
      headers: {
        'X-Robots-Tag': 'noindex',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
      continue: true,
    },
    { handle: 'filesystem' },
    { src: '/.*', dest: '/404.html', status: 404, headers: notFoundHeaders },
  ].map((route) => (route.src ? { ...route, src: `^${route.src}$` } : route));
}
