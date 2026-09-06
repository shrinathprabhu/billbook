# Billbook discovery and Vercel deployment

Billbook is fully usable at **https://billbook.lowkey.tools/** and through the reverse proxy at **https://lowkey.tools/billbook**. Both return the application directly with HTTP 200. Like Credo, the main-site URL remains the SEO canonical in metadata; that does not redirect the browser. This repository builds static files only; the production app has no application server or API.

## Deploy this project

1. Import this repository into Vercel and attach `billbook.lowkey.tools` to the project. Use the checked-in `vercel.json` (`npm ci`, then `npm run build`, framework preset Other). Remove any dashboard build/output-directory overrides left over from a different framework.
2. The build generates `.vercel/output/config.json` and `.vercel/output/static/` using Vercel Build Output API v3. Deploy those outputs through the normal Git integration, or run `vercel build` followed by `vercel deploy --prebuilt`. Do not deploy `dist/server/` or run `vinext start` in production.
3. Merge the two path-preserving rewrites from `deploy/lowkey.vercel.example.json` (or the alternative prefix-stripping pair from `deploy/lowkey.stripping.vercel.example.json`) into the **lowkey.tools parent project**, ahead of any catch-all route. Preserve the existing tools and other parent configuration.
4. Apply the small root discovery-file additions below in the parent project. This app cannot own another project's root files.

The recommended proxy preserves the path:

| Browser URL | Upstream request |
| --- | --- |
| `https://lowkey.tools/billbook` | `https://billbook.lowkey.tools/billbook` |
| `https://lowkey.tools/billbook/sw.js` | `https://billbook.lowkey.tools/billbook/sw.js` |
| `https://lowkey.tools/billbook/_next/static/…` | `https://billbook.lowkey.tools/billbook/_next/static/…` |
| `https://lowkey.tools/billbook/llms.txt` | `https://billbook.lowkey.tools/billbook/llms.txt` |

A proxy that strips the prefix also works, matching [Credo's deployment pattern](https://github.com/shrinathprabhu/credo). Its `/billbook` request goes to the upstream `/`, and `/billbook/:path*` goes to upstream `/:path*`. The origin internally serves `/` from `/billbook/index.html` and resolves unprefixed asset requests to existing files inside `/billbook`. Already-prefixed requests keep their path. Both configurations use rewrites and preserve the visitor's address bar.

There is **no redirect from `/` or any app entry URL**, and no host-based redirect. `/`, `/index.html`, `/billbook`, `/billbook/` and `/billbook/index.html` all serve the application with HTTP 200. This avoids redirect loops with prefix-stripping proxies. The HTML canonical, Open Graph URL, sitemap and HTTP `Link` canonical still consistently identify `https://lowkey.tools/billbook`, just as Credo identifies its main-site path. Canonical metadata is a search-engine hint, not navigation.

Unknown paths return actual HTTP 404 responses instead of the application's HTML. Asset aliases only resolve when a real public file exists. There are no public per-invoice URLs: the document library, editor, templates and imports are local application state. Do not put a host-specific `noindex` header on upstream HTML; it could pass through to the main-site page.

Production routes live in `scripts/security.mjs` and are generated into `.vercel/output/config.json`, because this is a static Vinext export using Vercel Build Output API. `vercel.json` selects the build; it does not contain a second, competing set of routing rules. `next.config.ts` defines the shared base path. `vite.config.ts` internally rewrites development entry URLs before Vite's base middleware can redirect them.

## Additions in the lowkey.tools parent project

The public root files checked on 2026-09-05 already allow all crawlers, including named AI/search bots. Keep those existing rules. Append this sitemap declaration to the parent's **root `/robots.txt`**:

```text
Sitemap: https://lowkey.tools/billbook/sitemap.xml
```

`/billbook/robots.txt` is provided for inspection but is not authoritative for `lowkey.tools`: crawlers read `/robots.txt` at the host root. The upstream project separately serves its own root `/robots.txt`. If the parent later adds crawler-specific blocks, ensure the matching bot groups also allow `/billbook` and its CSS, JavaScript, fonts, images and public text files. A wildcard group does not override a more specific bot group.

Add this entry to the parent's `/sitemap.xml` without replacing existing entries:

```xml
<url><loc>https://lowkey.tools/billbook</loc></url>
```

Add these entries under Tools in the parent's `/llms.txt`:

```markdown
- [Billbook](https://lowkey.tools/billbook): Free offline invoices, receipts, rent receipts, maintenance bills, cash vouchers and cash memos. Local browser storage, manual GST/VAT, customizable templates, Excel/JSON bulk imports and PDF/PNG/text exports.
- [Billbook documentation](https://lowkey.tools/billbook/llms.txt): Public feature guide, instructions, import limits and frequently asked questions.
```

Add a normal HTML link to Billbook in the parent's tools directory. Search engines should be able to reach it by following links, without needing the sitemap alone.

## Security and caching

`scripts/security.mjs` defines the actual generated production rules. They apply equally to ordinary browsers and crawlers; there is no cloaking or bot-only HTML.

- Each production build computes SHA-256 CSP hashes from the final, parsed HTML, including framework hydration scripts and public JSON-LD. Scripts have no `unsafe-inline` or `unsafe-eval` allowance. Do not copy hashes from an older build.
- Inline **styles** remain allowed because document design, React styles and the UI components require them. Local `data:` and `blob:` fonts/images/connections support uploads and image/PDF export. No external script, font or analytics host is enabled. The Owleye link is a creator credit.
- Frames, objects, form submission and script attributes are blocked. The app is not intended for iframe embedding. Camera, microphone, geolocation, payment and other unused permissions are disabled; clipboard write and native sharing remain available to the app.
- Responses set HSTS for one year, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP and CORP. HSTS intentionally does not enroll unrelated subdomains or request preload.
- Content-hashed assets receive a one-year immutable cache policy. HTML revalidates; both service-worker scripts are `no-store`. Public text/manifest files use a one-hour cache; fixed-name images use one day. Errors are `no-store` and `noindex`.
- Known non-read HTTP methods return 405. Dotfiles and common source/secret/backup/scan paths return 404. Source maps and the internal client-entry manifest are excluded from the public output; runtime static manifests remain available to the app. These are static routing defenses, not an application authorization system.

The parent proxy must preserve these response headers. Check that it does not add a second incompatible CSP, a blanket `X-Robots-Tag: noindex`, or a stale HTML cache policy. Multiple CSP headers are enforced together, so an unrelated parent policy can break the app even if this policy is correct. Leave crawlers able to access the public page and assets without authentication or browser challenges. No firewall, rate-limit or bot-challenge settings are changed by this repository.

## Offline and origin behavior

Application assets and install metadata retain the `/billbook` prefix, so they work on either host without rewriting HTML. The installed app opens `/billbook` on the current origin. When opened through `/billbook`, the service worker uses `/billbook` scope and caches only known app URLs; it never intercepts the main-site `/`, other tools, similarly named paths or unknown URLs. When opened directly at `/` or `/index.html`, a separate `/standalone-sw.js` worker uses root scope and additionally caches the standalone entry page, so a reload at the subdomain root works offline too. The stripped `/sw.js` alias always retains the proxy worker and its `/billbook` scope permission. Each worker cleans only its own cache namespace (`billbook-app-v1-` or `billbook-standalone-v1-`). It never caches document exports or uploaded customer data as public application assets.

Browser storage is isolated by origin, not URL path. `billbook.lowkey.tools` and `lowkey.tools` have separate workspaces; use JSON backup/restore to move existing documents between them. Other apps on `lowkey.tools` share that origin's browser security boundary. Clearing that origin's site data can remove the local workspace. User data is never inserted into public HTML, the sitemap, JSON-LD or the LLM files.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:discovery
npm start
```

Open both `http://localhost:4173/` and `http://localhost:4173/billbook`. Neither should navigate to a different URL. The local static server uses the generated production routing and response headers. It is a preview tool, not an application backend.

After both projects are deployed, verify both the origin and the canonical proxy:

```sh
curl -I https://billbook.lowkey.tools/
curl -I https://lowkey.tools/billbook
curl -I https://billbook.lowkey.tools/billbook
curl -I https://billbook.lowkey.tools/sw.js
curl -I https://billbook.lowkey.tools/standalone-sw.js
curl -I https://lowkey.tools/billbook/sw.js
curl -I https://lowkey.tools/billbook/og.png
curl -I https://lowkey.tools/billbook/not-a-page
curl https://lowkey.tools/robots.txt
curl https://lowkey.tools/billbook/sitemap.xml
curl https://lowkey.tools/billbook/llms.txt
```

Expect 200 with no `Location` header for both app entry points and public assets/text, main-domain canonicals in both versions, and 404 for the unknown page. An older deployment sent a permanent 308 from `/` with a one-hour cache lifetime; a browser that cached that response may need its HTTP cache refreshed after redeployment. Do not clear site data or IndexedDB to fix an HTTP redirect cache. Inspect the real response CSP after the proxy, exercise local save/import/PDF/PNG/clipboard flows in a browser, then reload offline. Check the OG card in a social preview debugger. Submit the canonical sitemap and inspect the URL in Google Search Console and Bing Webmaster Tools once the host is live. Deployment, DNS, search-console verification and crawler inclusion are not performed by a local build.

## Discovery approach

The initial HTML contains a public guide, use cases, four creation steps and ten FAQs even without JavaScript. The app remains first on the page. FAQ structured data comes from the same source as the visible answers. The JSON-LD graph includes WebApplication, WebPage/FAQPage, Organization, Person and BreadcrumbList, with no invented reviews or ratings. Creator links point to Shrinath Prabhu and Owleye Analytics; navigation links back to Lowkey Tools.

`lib/site.mjs` is the public fact source. `scripts/generate-discovery.mjs` produces `llms.txt`, `llms-full.txt`, `index.md`, the sitemap, robots file, manifest and raster icons before every build. Metadata is in `app/layout.tsx`; the guide is in `components/billbook/discovery.tsx`. The original OG card is `public/og.png`, 1729 × 910; its generation prompt is recorded in `docs/OG-IMAGE.md`.

Crawlable text, useful answers and consistent canonical metadata make the app eligible for discovery; they do not guarantee indexing, rich results, AI citations or model training inclusion. `llms.txt` is an additional machine-readable project reference, not a Google ranking requirement or crawler access control.

References: [Google's AI search guidance](https://developers.google.com/search/docs/appearance/ai-features), [robots.txt scope](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Build Output API configuration](https://vercel.com/docs/build-output-api/configuration), [CSP script hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), [llms.txt proposal](https://llmstxt.org/).
