import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { SITE_URL } from '../lib/site.mjs';

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
  Link: `<${SITE_URL}>; rel="canonical", <${SITE_URL}index.md>; rel="alternate"; type="text/markdown", <${SITE_URL}llms.txt>; rel="describedby"; type="text/plain"`,
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'X-Robots-Tag':
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
};
export const notFoundHeaders = {
  'X-Robots-Tag': 'noindex',
  'Cache-Control': 'no-store',
};
// Asset policy shared by the static packager and Workers Static Assets headers.
export function assetHeaders(pathname) {
  if (pathname === '/' || pathname === '/index.html') return canonicalHeaders;
  if (pathname === '/404' || pathname === '/404.html') return notFoundHeaders;
  // The old root worker URL remains so installed copies can update.
  if (pathname === '/sw.js' || pathname === '/standalone-sw.js')
    return {
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-store',
      'Content-Type': 'text/javascript; charset=utf-8',
      'X-Robots-Tag': 'noindex',
    };
  if (pathname.startsWith('/_next/static/'))
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  const contentType = {
    '/robots.txt': 'text/plain',
    '/llms.txt': 'text/plain',
    '/llms-full.txt': 'text/plain',
    '/index.md': 'text/markdown',
    '/sitemap.xml': 'application/xml',
    '/manifest.webmanifest': 'application/manifest+json',
  }[pathname];
  if (contentType)
    return {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Cache-Control': 'public, max-age=3600',
    };
  if (pathname === '/index.txt')
    return {
      'Content-Type': 'text/x-component; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    };
  if (/^\/[^/]+\.(?:png|svg)$/.test(pathname))
    return { 'Cache-Control': 'public, max-age=86400' };
  if (/\.(?:rsc|html)$/.test(pathname))
    return {
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    };
  return {};
}
